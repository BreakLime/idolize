// Global popover/context menu. openMenu(anchorOrEvent, items) from anywhere; <MenuHost/> renders it.
// Styled like TIDAL's menu: 240px panel, 42px text-only rows, optional artwork header, hover submenus.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { Artwork } from './Artwork';
import { Icon, type IconName } from './Icon';
import s from './Menu.module.css';

export interface MenuHeader {
  /** artwork (track/album/playlist header); without it the header is a compact info block (Share submenu) */
  image?: string;
  imageTestId?: string;
  round?: boolean;
  /** drawn tile instead of artwork (folder menus) */
  glyph?: ReactNode;
  title: string;
  subtitle?: string;
}

export interface MenuItem {
  label?: string;
  /** kept for compatibility; TIDAL menus are text-only, so plain icons are not drawn */
  icon?: IconName;
  /** leading visual that IS drawn (Share submenu link icons, "Create new playlist" circle) */
  leading?: ReactNode;
  onClick?: () => void;
  submenu?: MenuItem[];
  disabled?: boolean;
  checked?: boolean;
  separator?: boolean;
  testId?: string;
  /** custom row content (e.g. a header with artwork) */
  render?: ReactNode;
  /** artwork/title header row */
  header?: MenuHeader;
  /** small uppercase section label ("Recent") */
  section?: string;
  /** muted group heading ("Sort", "Filter" in the sidebar sort menu) */
  heading?: string;
  /** separator spanning the whole panel with 12px air (sort menu) */
  wide?: boolean;
  /** current choice: the row keeps its highlight */
  selected?: boolean;
  /** taller row (48px, "Create new playlist") */
  tall?: boolean;
  /** custom trailing element (e.g. the sort-direction arrow of collection sort menus) */
  trail?: ReactNode;
  /** navigation item (TIDAL renders these as links: 20px line height) */
  link?: boolean;
}

interface MenuState {
  x: number;
  y: number;
  /** anchor rect to flip around when space is short */
  anchor?: DOMRect;
  align?: 'start' | 'end';
  items: MenuItem[];
  testId?: string;
  /** panel width (default 240) */
  width?: number;
}

const useMenu = create<{ menu: MenuState | null }>(() => ({ menu: null }));

export function openMenu(
  at: { clientX: number; clientY: number } | HTMLElement,
  items: MenuItem[],
  opts: { align?: 'start' | 'end'; testId?: string; width?: number } = {},
) {
  if (at instanceof HTMLElement) {
    const r = at.getBoundingClientRect();
    useMenu.setState({ menu: { x: opts.align === 'end' ? r.right : r.left, y: r.bottom + 6, anchor: r, items, ...opts } });
  } else {
    useMenu.setState({ menu: { x: at.clientX, y: at.clientY, items, ...opts } });
  }
}
export const closeMenu = () => useMenu.setState({ menu: null });
export const isMenuOpen = () => useMenu.getState().menu !== null;

function Header({ h }: { h: MenuHeader }) {
  if (!h.image && !h.glyph)
    return (
      <div className={s.infoHeader}>
        <div className={s.infoTitle}>{h.title}</div>
        {h.subtitle && <div className={s.infoSub}>{h.subtitle}</div>}
      </div>
    );
  return (
    <div className={s.header}>
      {h.glyph ?? <Artwork src={h.image} size={38} radius={h.round ? undefined : 2} round={h.round} testId={h.imageTestId ?? 'context-menu-album-image'} />}
      <div className={s.headerText}>
        <div className={`${s.headerTitle} ellipsis`} data-test="contextmenu-title">
          {h.title}
        </div>
        {h.subtitle && (
          <div className={`${s.headerSub} ellipsis`} data-test="contextmenu-subtitle">
            {h.subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

interface ListProps extends MenuState {
  depth: number;
  /** submenus: the parent panel's rect (to open beside it) */
  parent?: DOMRect;
}

function MenuList({ items, x, y, anchor, align, testId, width, depth, parent }: ListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y, visible: false });
  const [sub, setSub] = useState<{ index: number; rect: DOMRect; panel: DOMRect } | null>(null);
  const openSub = (index: number, el: HTMLElement) => setSub({ index, rect: el.getBoundingClientRect(), panel: ref.current!.getBoundingClientRect() });

  useLayoutEffect(() => {
    const el = ref.current!;
    const { width, height } = el.getBoundingClientRect();
    let left: number;
    let top = y;
    if (parent) {
      // beside the parent panel, overlapping it by 2px; flip to the left when there is no room
      left = parent.right - 2;
      if (left + width > innerWidth - 8) left = parent.left + 2 - width;
    } else {
      left = align === 'end' ? x - width : x;
      if (left + width > innerWidth - 8) left = anchor ? Math.max(8, anchor.right - width) : x - width;
    }
    if (top + height > innerHeight - 8) top = anchor && !depth ? Math.max(8, anchor.top - height - 6) : Math.max(8, innerHeight - height - 8);
    setPos({ left: Math.max(8, left), top: Math.max(8, top), visible: true });
  }, [x, y, align, anchor, depth, parent]);

  return (
    <>
      <div
        ref={ref}
        className={`${s.menu} ${depth ? s.submenu : ''}`}
        role="menu"
        data-test={testId ?? (depth ? 'context-submenu' : 'contextmenu')}
        style={{ left: pos.left, top: pos.top, width, visibility: pos.visible ? 'visible' : 'hidden' }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {items.map((it, i) =>
          it.separator ? (
            <div key={i} className={it.wide ? s.divider : s.separator} />
          ) : it.heading ? (
            <span key={i} className={s.heading} onMouseEnter={() => setSub(null)}>
              {it.heading}
            </span>
          ) : it.header ? (
            <Header key={i} h={it.header} />
          ) : it.section ? (
            <div key={i} className={s.section} onMouseEnter={() => setSub(null)}>
              <span>{it.section}</span>
            </div>
          ) : it.render ? (
            <div key={i} className={s.custom}>
              {it.render}
            </div>
          ) : (
            <div key={i} className={`${s.itemWrap} ${it.tall ? s.tall : ''} ${sub?.index === i || it.selected ? s.open : ''} ${it.disabled ? s.disabled : ''}`}>
            <button
              type="button"
              role="menuitem"
              className={`${s.item} ${it.link ? s.link : ''}`}
              disabled={it.disabled}
              data-test={it.testId}
              onMouseEnter={(e) => (it.submenu ? openSub(i, e.currentTarget) : setSub(null))}
              onClick={(e) => {
                if (it.submenu) return openSub(i, e.currentTarget);
                closeMenu();
                it.onClick?.();
              }}
            >
              {it.leading && <span className={s.leading}>{it.leading}</span>}
              <span className={`${s.label} ${it.leading ? s.labelAfterLeading : ''}`}>{it.label}</span>
              {it.checked && !it.trail && <Icon name="check" size={16} className={s.trail} />}
              {it.trail && <span className={s.trail}>{it.trail}</span>}
              {it.submenu && (
                <span className={s.trail}>
                  <Icon name="chevron-right" size={16} />
                </span>
              )}
            </button>
            </div>
          ),
        )}
      </div>
      {sub && items[sub.index]?.submenu && (
        <MenuList key={sub.index} items={items[sub.index].submenu!} x={0} y={sub.rect.top - 8} parent={sub.panel} depth={depth + 1} />
      )}
    </>
  );
}

export function MenuHost() {
  const menu = useMenu((st) => st.menu);
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(`.${s.menu}`)) closeMenu();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeMenu();
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', closeMenu);
    window.addEventListener('wheel', closeMenu, { passive: true });
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', closeMenu);
      window.removeEventListener('wheel', closeMenu);
    };
  }, [menu]);
  if (!menu) return null;
  return (
    <>
      {/* like TIDAL (pointer events off outside the menu): rows underneath lose hover, outside clicks only close */}
      <div
        className={s.backdrop}
        aria-hidden="true"
        onMouseDown={closeMenu}
        onContextMenu={(e) => {
          e.preventDefault();
          closeMenu();
          // right-click elsewhere opens that element's menu right away
          const { clientX, clientY } = e;
          const below = document.elementsFromPoint(clientX, clientY).find((n) => !n.classList.contains(s.backdrop) && !n.closest(`.${s.menu}`));
          below?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX, clientY, button: 2 }));
        }}
      />
      <MenuList key={`${menu.x},${menu.y}`} {...menu} depth={0} />
    </>
  );
}
