// Building blocks shared by the collection tabs: page frame + title, filter field, empty state, tab bars.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon } from '@/components/Icon';
import { openMenu, type MenuItem } from '@/components/Menu';
import { CollectionGlyphPaths, CollectionIcon, type CollectionGlyph } from '@/components/icons/collection';
import { nextSort, type Sort, type SortOption } from './sorting';
import s from './Collection.module.css';

/** Page frame: `page-title-container` grid with the h1 row (and an optional "…" options button). */
export function CollectionPage({
  title,
  onOptions,
  testId = 'page-title-container',
  className,
  children,
}: {
  title: string;
  onOptions?: (anchor: HTMLElement) => void;
  testId?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`${s.page} ${className ?? ''}`} data-test={testId}>
      <div className={s.header}>
        <h1 className={s.h1}>{title}</h1>
        {onOptions && (
          <div className={s.titleActions}>
            <button type="button" className={s.optionsBtn} aria-label="Show options" title="Show options" onClick={(e) => onOptions(e.currentTarget)}>
              <Icon name="more" size={24} />
            </button>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/** Sort menu as in the real app: the active option carries a direction arrow; picking it again flips it. */
export function sortMenuItems(options: SortOption[], cur: Sort, onChange: (s: Sort) => void): MenuItem[] {
  return options.map((o) => ({
    label: o.label,
    checked: cur.key === o.key,
    trail:
      cur.key === o.key ? (
        <CollectionIcon
          name={cur.dir === 'DESC' ? 'chevron-down' : 'chevron-up'}
          size={24}
          stroke={2.2}
          className={s.sortArrow}
          testId={cur.dir === 'DESC' ? 'icon--general__arrow-down' : 'icon--general__arrow-up'}
        />
      ) : undefined,
    testId: `sort-${o.key}`,
    onClick: () => onChange(nextSort(cur, o.key, o.dir)),
  }));
}

export function openSortMenu(anchor: HTMLElement, options: SortOption[], cur: Sort, onChange: (s: Sort) => void, extra: MenuItem[] = []) {
  openMenu(anchor, extra.length ? [...extra, { label: 'Sorting', submenu: sortMenuItems(options, cur, onChange), testId: 'sort' }] : sortMenuItems(options, cur, onChange), {
    testId: 'contextmenu',
  });
}

/** Client-side filter field ("Filter albums"). */
export function FilterInput({ placeholder, value, onChange, className }: { placeholder: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={`${s.filter} ${className ?? ''}`}>
      <CollectionIcon name="search" size={16} stroke={2} />
      <input
        type="search"
        className={s.filterInput}
        data-test="playlist-filter-input"
        aria-label="Search"
        placeholder={placeholder}
        value={value}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onChange('')}
      />
    </label>
  );
}

/** TIDAL's empty collection state: big glyph, muted line, and a link to editorial picks. */
export function EmptyState({
  icon,
  text,
  action,
  to,
  testId = 'empty-state',
  badge,
  className,
}: {
  icon: CollectionGlyph;
  text: string;
  action?: string;
  to?: string;
  testId?: string;
  /** purchases style: glyph inside a rounded plate */
  badge?: boolean;
  className?: string;
}) {
  return (
    <div className={`${s.empty} ${className ?? ''}`} data-test={testId}>
      {badge ? (
        <span className={s.emptyBadge} data-test="empty-state-purchase-badge">
          <svg width="100%" height="100%" viewBox="0 0 96 96" aria-hidden="true">
            <rect x="0" y="0" width="96" height="96" rx="24" fill="rgba(255,255,255,0.03)" />
            <g transform="translate(14 14) scale(2.84)">
              <CollectionGlyphPaths name={icon} stroke={1.35} />
            </g>
          </svg>
        </span>
      ) : (
        <CollectionIcon name={icon} size={96} stroke={2.2} className={s.emptyIcon} />
      )}
      <h3 className={s.emptyText}>{text}</h3>
      {action && to && (
        <Link to={to} className={s.emptyAction}>
          {action}
        </Link>
      )}
    </div>
  );
}

/** Save for Later style filter chips. */
export function Chips<T extends string>({ items, value, onChange, testPrefix }: { items: { id: T; label: string }[]; value: T; onChange: (id: T) => void; testPrefix: string }) {
  return (
    <div className={s.chips} role="tablist">
      {items.map((c) => (
        <button
          key={c.id}
          type="button"
          role="tab"
          aria-selected={c.id === value}
          className={`${s.chip} ${c.id === value ? s.chipOn : ''}`}
          data-test={`${testPrefix}-${c.id}`}
          onClick={() => onChange(c.id)}
        >
          <span>{c.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Purchases style underlined tabs. */
export function UnderlineTabs<T extends string>({ items, value, onChange, testId }: { items: { id: T; label: string; testId: string }[]; value: T; onChange: (id: T) => void; testId: string }) {
  return (
    <div className={s.tabs} role="tablist" data-test={testId}>
      {items.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={t.id === value} className={`${s.tab} ${t.id === value ? s.tabOn : ''}`} data-test={t.testId} onClick={() => onChange(t.id)}>
          <span>{t.label}</span>
          {t.id === value && <div className={s.tabLine} />}
        </button>
      ))}
    </div>
  );
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={s.empty} data-test="collection-error">
      <h3 className={s.emptyText}>Something went wrong while loading your collection.</h3>
      <button type="button" className={s.emptyAction} onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
