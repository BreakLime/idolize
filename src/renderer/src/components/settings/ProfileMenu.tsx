// The header's profile popover (TIDAL's account context menu).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { user } from '@/api/tidal';
import { confirmDialog, showDialog } from '@/components/Dialog';
import { Icon } from '@/components/Icon';
import { idol } from '@/lib/bridge';
import { navigate } from '@/lib/navigation';
import s from './ProfileMenu.module.css';

const useProfileMenu = create<{ anchor: DOMRect | null }>(() => ({ anchor: null }));

export function openProfileMenu(el: HTMLElement) {
  const open = useProfileMenu.getState().anchor;
  useProfileMenu.setState({ anchor: open ? null : el.getBoundingClientRect() });
}
const close = () => useProfileMenu.setState({ anchor: null });
const external = (url: string) => window.open(url, '_blank');

const SHORTCUTS: [string, string][] = [
  ['Play / pause', 'Space'],
  ['Next / previous track', 'Ctrl + → / ←'],
  ['Seek forward / backward 10s', 'Ctrl + Shift + → / ←'],
  ['Volume up / down', 'Ctrl + ↑ / ↓'],
  ['Shuffle', 'Ctrl + S'],
  ['Repeat', 'Ctrl + R'],
  ['Search', 'Ctrl + F'],
  ['Home', 'Ctrl + H'],
  ['Settings', 'Ctrl + P'],
  ['Back / forward', 'Backspace / Shift + Backspace'],
  ['Zoom in / out / reset', 'Ctrl + + / − / 0'],
  ['Log out', 'Ctrl + Shift + L'],
];

function showShortcuts() {
  void showDialog(
    'Keyboard shortcuts',
    <table className={s.shortcuts}>
      <tbody>
        {SHORTCUTS.map(([what, keys]) => (
          <tr key={what}>
            <td>{what}</td>
            <td>
              <kbd>{keys}</kbd>
            </td>
          </tr>
        ))}
      </tbody>
    </table>,
  );
}

interface Item {
  label: string;
  test?: string;
  onClick?: () => void;
  externalLink?: boolean;
  danger?: boolean;
  disabled?: boolean;
  submenu?: Item[];
  /** rendered as a link (TIDAL's Profile entry is an anchor) */
  href?: string;
}

const ITEMS: Item[] = [
  {
    label: 'Profile',
    test: 'view-profile',
    href: '/settings/account',
    onClick: () =>
      void user
        .profile()
        .then((p: { artistId?: number }) => navigate(p.artistId ? `/artist/${p.artistId}` : '/settings/account'))
        .catch(() => navigate('/settings/account')),
  },
  { label: 'Manage subscription', test: 'manage-subscription', onClick: () => external('https://account.tidal.com/subscription') },
  { label: 'Settings', test: 'open-settings', onClick: () => navigate('/settings/general') },
  {
    label: 'Help',
    test: 'help-submenu',
    submenu: [
      { label: 'Reload app', test: 'restart-app', onClick: () => window.location.reload() },
      { label: 'Keyboard shortcuts', test: 'view-shortcuts', onClick: showShortcuts },
      { label: 'Get Support', test: 'get-help', externalLink: true, onClick: () => external('https://support.tidal.com/hc/en-us') },
    ],
  },
  {
    label: 'Legal',
    test: 'legal-submenu',
    submenu: [
      { label: 'Terms and Conditions', test: 'terms', externalLink: true, onClick: () => external('https://tidal.com/terms') },
      { label: 'Privacy Notice', test: 'privacy-notice', externalLink: true, onClick: () => external('https://tidal.com/privacy') },
      {
        label: 'Marketplace Terms and Conditions',
        test: 'terms-marketplace',
        externalLink: true,
        onClick: () => external('https://tidal.com/terms-marketplace'),
      },
    ],
  },
  {
    label: 'Log out',
    test: 'log-out',
    danger: true,
    onClick: async () => {
      if (await confirmDialog('Log out', 'Are you sure you want to log out of Idolize?', 'Log out', true)) await idol.auth.logout();
    },
  },
];

function Row({ it, hot, onHover }: { it: Item; hot: boolean; onHover: (el: HTMLElement | null) => void }) {
  return (
    <li role="none">
      <div
        className={`${s.item} ${hot ? s.hot : ''} ${it.disabled ? s.disabled : ''}`}
        role="menuitem"
        aria-haspopup={!!it.submenu}
        onMouseEnter={(e) => onHover(e.currentTarget)}
      >
        {it.href ? (
          <a
            href={it.href}
            className={`${s.action} ${s.link}`}
            data-test={it.test}
            onClick={(e) => {
              e.preventDefault();
              close();
              it.onClick?.();
            }}
          >
            <span className={s.text}>{it.label}</span>
          </a>
        ) : (
          <button
            type="button"
            className={s.action}
            data-test={it.test}
            disabled={it.disabled}
            onClick={() => {
              if (it.submenu) return;
              close();
              it.onClick?.();
            }}
          >
            <span className={`${s.text} ${it.danger ? s.danger : ''}`}>{it.label}</span>
            {it.submenu && (
              <span className={s.subIcon}>
                <Icon name="chevron-right" size={16} />
              </span>
            )}
            {it.externalLink && <Icon name="external-link" size={16} className={s.extIcon} />}
          </button>
        )}
      </div>
    </li>
  );
}

function Submenu({ items, anchor }: { items: Item[]; anchor: DOMRect }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current!;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    // open to the left when there is no room on the right (TIDAL's menu sits at the window edge)
    const left = anchor.right + 2 + w < innerWidth - 8 ? anchor.right + 2 : anchor.left - w - 2;
    const top = Math.min(anchor.top - 8, innerHeight - h - 8);
    setPos({ left, top });
  }, [anchor]);
  return (
    <div ref={ref} className={s.subContainer} style={{ left: pos?.left ?? -9999, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}>
      <div className={s.menu} role="menu">
        <ul>
          {items.map((it) => (
            <Row key={it.label} it={it} hot={false} onHover={() => {}} />
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ProfileMenuHost() {
  const anchor = useProfileMenu((st) => st.anchor);
  const [sub, setSub] = useState<{ index: number; rect: DOMRect } | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!anchor) return setSub(null);
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest(`.${s.menu}`) || t.closest('[data-test="header-profile-menu-button"]')) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, [anchor]);

  if (!anchor) return null;
  return (
    <div ref={root} className={s.layer}>
      <div className={s.menu} role="menu" data-test="contextmenu" style={{ top: anchor.bottom + 10, right: innerWidth - anchor.right }}>
        <ul>
          {ITEMS.map((it, i) => (
            <Row
              key={it.label}
              it={it}
              hot={sub?.index === i}
              onHover={(el) => setSub(it.submenu && el ? { index: i, rect: el.getBoundingClientRect() } : null)}
            />
          ))}
        </ul>
      </div>
      {sub && ITEMS[sub.index]?.submenu && <Submenu items={ITEMS[sub.index].submenu!} anchor={sub.rect} />}
    </div>
  );
}
