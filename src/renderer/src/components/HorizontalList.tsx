// Titled carousel ("Custom mixes  ‹ ›  View all") and the responsive card grid used by view-all/collection pages.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { itemKey, type MediaItem } from '@/api/models';
import { Icon } from './Icon';
import { MediaCard } from './MediaCard';
import s from './HorizontalList.module.css';

const MIN_CARD = 160;
const GAP = 16;

/** Number of columns TIDAL fits for a given content width. */
export const columnsFor = (width: number, minCard = MIN_CARD) => Math.max(2, Math.floor((width + GAP) / (minCard + GAP)));

/** Cards per view in TIDAL's carousels (--numberOfCardsToDisplay): measured at window widths 800–2200
 *  (content 496→2, 680→3, 864→4, 1134→6, 1416→7, 1500→8 cards) ⇒ ~170px minimum card + 16px gap. */
export const carouselColumnsFor = (width: number) => Math.max(2, Math.floor((width + GAP) / (170 + GAP)));

/** Column count for the element's content width; `fit` maps width → columns (re-read on every resize). */
function useColumns<T extends HTMLElement>(fit: (width: number) => number = columnsFor, initial = 6): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [cols, setCols] = useState(initial);
  const fitRef = useRef(fit);
  fitRef.current = fit;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setCols(fitRef.current(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, cols];
}

export function SectionHeader({ title, testId, viewAll, arrows, children }: { title: ReactNode; testId?: string; viewAll?: string; arrows?: ReactNode; children?: ReactNode }) {
  return (
    <div className={s.header} data-test={testId}>
      <h2 className={s.title}>{title}</h2>
      <div className={s.headerRight}>
        {children}
        {arrows}
        {viewAll && (
          <Link to={viewAll} className={s.viewAll} data-test="view-all-link">
            <span>View all</span>
          </Link>
        )}
      </div>
    </div>
  );
}

export function HorizontalList({
  title,
  items,
  moduleId,
  viewAll,
  renderItem,
  header,
  columns,
}: {
  title: ReactNode;
  items: MediaItem[];
  moduleId: string;
  viewAll?: string;
  renderItem?: (item: MediaItem) => ReactNode;
  /** replaces the default title row (e.g. the "Because you liked" context header) */
  header?: ReactNode;
  /** cards per view for a given content width (default `columnsFor`) */
  columns?: (width: number) => number;
}) {
  const [wrap, cols] = useColumns<HTMLDivElement>(columns ?? carouselColumnsFor);
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const update = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  }, []);
  useEffect(update, [update, items.length, cols]);
  const page = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * (scroller.current.clientWidth - 12 + GAP), behavior: 'smooth' });
  const showArrows = items.length > cols;

  return (
    <section className={s.section} ref={wrap}>
      {header ?? (
        <SectionHeader
          title={title}
          testId={`horizontal-list--${moduleId}-header`}
          viewAll={viewAll}
          arrows={
            showArrows && (
              <>
                <button type="button" className={s.arrow} disabled={edges.start} aria-label="Previous" onClick={() => page(-1)}>
                  <Icon name="chevron-left" size={16} />
                </button>
                <button type="button" className={s.arrow} disabled={edges.end} aria-label="Next" onClick={() => page(1)}>
                  <Icon name="chevron-right" size={16} />
                </button>
              </>
            )
          }
        />
      )}
      <div ref={scroller} className={s.scroll} data-test={`horizontal-list--${moduleId}-scroll`} onScroll={update} style={{ '--cols': cols } as React.CSSProperties}>
        {items.map((it) => (
          <div key={itemKey(it)} className={s.cell}>
            {renderItem ? renderItem(it) : <MediaCard item={it} />}
          </div>
        ))}
      </div>
    </section>
  );
}

export function MediaGrid({
  items,
  renderItem,
  testId = 'grid',
  minItemWidth,
  gap,
}: {
  items: MediaItem[];
  renderItem?: (item: MediaItem) => ReactNode;
  testId?: string;
  /** narrowest cell before a column is dropped (default: carousel card width) */
  minItemWidth?: number;
  /** CSS gap override (TIDAL's cell grids use a uniform 16px) */
  gap?: number;
}) {
  const [ref, cols] = useColumns<HTMLDivElement>((w) => columnsFor(w, minItemWidth), minItemWidth ? 5 : 6);
  return (
    <div ref={ref} className={s.grid} data-test={testId} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap }}>
      {items.map((it) => (
        <div key={itemKey(it)}>{renderItem ? renderItem(it) : <MediaCard item={it} />}</div>
      ))}
    </div>
  );
}

export function PillTabs<T extends string>({ tabs, value, onChange, testId = 'tab-bar' }: { tabs: { id: T; label: string; testId?: string }[]; value: T; onChange: (id: T) => void; testId?: string }) {
  return (
    <div className={s.pills} role="tablist" data-test={testId}>
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={t.id === value} className={`${s.pill} ${t.id === value ? s.pillActive : ''}`} data-test={t.testId} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
