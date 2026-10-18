// Track table (album / playlist / mix / collection / search / artist top tracks).
// Geometry follows TIDAL's media table: 42px index, 54px cover cell (42px art), flex title/artist/album,
// 140px date, 77px time, 100px action column (130px with the radio "Block" button).
import { useVirtualizer } from '@tanstack/react-virtual';
import { memo, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { coverUrl } from '@/api/images';
import { formatDuration, type Playlist, type Track, type Video } from '@/api/models';
import { useContentAllowed } from '@/lib/content';
import { toggleFavorite, useIsFavorite } from '@/state/favorites';
import { currentTrack, player, usePlayer, type PlaySource } from '@/state/player';
import { Artwork } from './Artwork';
import { ExplicitBadge, UploadedBadge } from './Badges';
import { Icon } from './Icon';
import { addToPlaylistMenu, blockTrack, trackMenu } from './menus';
import s from './MediaTable.module.css';

export type Column = 'index' | 'cover' | 'title' | 'artist' | 'album' | 'dateAdded' | 'time';

const HEAD: Record<Column, string> = { index: '#', cover: '', title: 'Title', artist: 'Artist', album: 'Album', dateAdded: 'Date added', time: 'Time' };
const CELL: Record<Column, string> = { index: 'index', cover: 'cover', title: 'title', artist: 'artist', album: 'album', dateAdded: 'date', time: 'time' };

export interface MediaTableProps {
  items: (Track | Video)[];
  columns?: Column[];
  source: PlaySource | null;
  showHeader?: boolean;
  testId?: string;
  /** playlist context enables "Remove from playlist" */
  playlist?: Playlist;
  onRemove?: (index: number) => void;
  /** first row number (albums restart numbering per volume) */
  numbering?: 'position' | 'trackNumber';
  /** album tables: "Volume N" sections (each with its own column header) when tracks span several volumes */
  volumes?: boolean;
  /** "last week" / "More than a month" (editorial playlists) instead of "Mar 14, 2023" */
  dateStyle?: 'absolute' | 'relative';
  /** row action set: default (… + ♡), radio (adds Block), suggested (… and "add to this playlist") */
  rowActions?: 'default' | 'radio' | 'suggested';
  /** suggested rows: the add button */
  onAddSuggested?: (item: Track | Video, index: number) => void;
  /** extra context for the row menu (album page: no "Go to album") */
  menuContext?: { albumId?: number };
  /** keep the index column but leave it blank (suggested rows) */
  hideNumbers?: boolean;
  /** sortable column headers (collection tracks); the active column shows a direction arrow */
  sort?: { column: Column; dir: 'ASC' | 'DESC'; onSort: (column: Column) => void };
  /** custom "Date added" label (e.g. relative dates in My Collection) */
  formatDate?: (iso?: string) => string;
}

const DAY = 86_400_000;

/** TIDAL timestamps come as "…+0000"; make them ISO-8601 for Date. */
const parseDate = (iso: string) => new Date(iso.replace(/([+-]\d\d)(\d\d)$/, '$1:$2'));

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
/** Monday-based week start. */
const startOfWeek = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.getTime();
};

/**
 * Date-added label. User playlists: Today / Yesterday / This week / Last week / This month / Last month,
 * then "Mar 14, 2023" (same rules as My Collection). Editorial playlists ('relative') never show a date:
 * … This month, then "More than a month".
 */
export function formatDateAdded(iso: string | undefined, style: 'absolute' | 'relative' = 'absolute', now = new Date()): string {
  if (!iso) return '';
  const d = parseDate(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = startOfDay(d);
  const today = startOfDay(now);
  if (day >= today) return 'Today';
  if (day >= today - DAY) return 'Yesterday';
  const week = startOfWeek(now);
  if (day >= week) return 'This week';
  if (day >= week - 7 * DAY) return 'Last week';
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return 'This month';
  if (style === 'relative') return 'More than a month';
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  if (d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth()) return 'Last month';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const titleDate = (iso?: string) => (iso ? parseDate(iso).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : undefined);

function AddToPlaylistButton({ track }: { track: Track | Video }) {
  return (
    <button
      type="button"
      className={`${s.rowBtn} ${s.addBtn}`}
      data-test="add-to-playlist-button"
      aria-label="Add to playlist"
      title="Add to playlist"
      onClick={(e) => {
        e.stopPropagation();
        void addToPlaylistMenu(e.currentTarget, [track.id]);
      }}
    >
      <Icon name="plus" size={24} />
    </button>
  );
}

/** Radio/mix rows: the Ø "Block" button. */
function BlockIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth={1.4} />
      <path d="M3.6 12.4 12.4 3.6" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  );
}

/** Suggested rows: note + plus. */
function AddSuggestedIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 15.5V4.5l3.5-1" />
      <circle cx="5.75" cy="15.5" r="2.25" />
      <path d="M15.5 9v7M12 12.5h7" />
    </svg>
  );
}

interface RowProps {
  t: Track | Video;
  i: number;
  num: number;
  columns: Column[];
  active: boolean;
  playing: boolean;
  onPlay: (i: number) => void;
  ctx: Pick<MediaTableProps, 'playlist' | 'onRemove' | 'dateStyle' | 'rowActions' | 'onAddSuggested' | 'menuContext' | 'hideNumbers' | 'formatDate'>;
}

const Row = memo(function Row({ t, i, num, columns, active, playing, onPlay, ctx }: RowProps) {
  const fav = useIsFavorite(t);
  const allowed = useContentAllowed();
  const unavailable = (t.kind === 'track' && !t.streamable) || !allowed(t);
  const hasIndex = columns.includes('index');
  const actions = ctx.rowActions ?? 'default';
  const menu = (at: HTMLElement | { clientX: number; clientY: number }) =>
    void trackMenu(at, t, {
      ...ctx.menuContext,
      radio: actions === 'radio',
      ...(ctx.playlist && ctx.onRemove ? { playlist: ctx.playlist, index: i, onRemove: () => ctx.onRemove!(i) } : {}),
    });
  const playBtn = (
    <button
      type="button"
      data-test="play-button"
      aria-label={active && playing ? 'Pause' : 'Play'}
      title={active && playing ? 'Pause' : 'Play'}
      className={s.play}
      onClick={(e) => {
        e.stopPropagation();
        if (active) player.toggle();
        else if (!unavailable) onPlay(i);
      }}
    >
      <Icon name={active && playing ? 'pause' : 'play'} size={16} />
    </button>
  );

  return (
    <div
      className={`${s.row} ${active ? s.active : ''} ${unavailable ? s.unavailable : ''} ${hasIndex ? '' : s.noIndex}`}
      role="row"
      data-test="tracklist-row"
      data-track-id={t.id}
      onDoubleClick={() => !unavailable && onPlay(i)}
      onContextMenu={(e) => {
        e.preventDefault();
        menu({ clientX: e.clientX, clientY: e.clientY });
      }}
    >
      {columns.map((c) => {
        switch (c) {
          case 'index':
            return (
              <div key={c} className={`${s.cell} ${s.index}`} role="cell">
                <span data-test="mt-index-col" className={s.num}>
                  {active && playing ? <span className={s.bars} aria-label="Playing" /> : !ctx.hideNumbers && <span className={s.numText}>{num}</span>}
                  <span className={s.playOverlay}>{playBtn}</span>
                </span>
              </div>
            );
          case 'cover':
            return (
              <div key={c} className={`${s.cell} ${s.cover}`} role="cell">
                <figure data-test="mt-cover-col" className={s.coverFig}>
                  <Artwork src={coverUrl(t.kind === 'track' ? t.album.cover : null, 42)} size={42} radius={0} className={s.coverImg} />
                  <span className={s.coverOverlay}>{playBtn}</span>
                </figure>
              </div>
            );
          case 'title':
            return (
              <div key={c} className={`${s.cell} ${s.title}`} role="cell" data-test="table-row-title">
                <div className={s.titleInner}>
                  <span data-test="table-cell-title" className={s.titleText} title={t.title}>
                    {t.title}
                    {t.version && !t.title.includes(t.version) ? <span className={s.version}> ({t.version})</span> : ' '}
                  </span>
                  {t.explicit && <ExplicitBadge />}
                  {t.kind === 'track' && t.upload && <UploadedBadge />}
                </div>
              </div>
            );
          case 'artist':
            return (
              <div key={c} className={`${s.cell} ${s.artist}`} role="cell" data-test="track-row-artist">
                <span className={s.textBlock}>
                  {t.artists.map((a, k) => (
                    <Link key={`${a.id}-${k}`} to={`/artist/${a.id}`} className={`link ${s.artistLink}`} data-test="grid-item-detail-text-title-artist" aria-label={a.name} title={a.name}>
                      {a.name}
                    </Link>
                  ))}
                </span>
              </div>
            );
          case 'album':
            return (
              <div key={c} className={`${s.cell} ${s.album}`} role="cell" data-test="track-row-album">
                {t.kind === 'track' && (
                  <Link to={`/album/${t.album.id}`} className={`link ${s.textBlock}`} data-test="table-cell-album" title={t.album.title}>
                    {t.album.title}
                  </Link>
                )}
              </div>
            );
          case 'dateAdded': {
            const iso = t.kind === 'track' ? t.dateAdded : undefined;
            return (
              <div key={c} className={`${s.cell} ${s.date}`} role="cell" data-test="track-row-date-added">
                {iso && (
                  <time dateTime={iso} title={titleDate(iso)} className={s.dateText}>
                    {ctx.formatDate ? ctx.formatDate(iso) : formatDateAdded(iso, ctx.dateStyle)}
                  </time>
                )}
              </div>
            );
          }
          case 'time':
            return (
              <div key={c} className={`${s.cell} ${s.time}`} role="cell" data-test="duration">
                <time className={s.timeText}>{formatDuration(t.duration)}</time>
              </div>
            );
        }
      })}
      <div className={`${s.cell} ${s.actions} ${actions === 'radio' ? s.actionsWide : ''}`} role="cell">
        <div className={s.actionsInner}>
          <button
            type="button"
            className={`${s.rowBtn} ${s.more}`}
            data-test="context-menu-button"
            aria-label="Show options"
            title="Show options"
            onClick={(e) => {
              e.stopPropagation();
              menu(e.currentTarget);
            }}
          >
            <Icon name="more" size={20} />
          </button>
          {actions === 'suggested' ? (
            <button
              type="button"
              className={`${s.rowBtn} ${s.addSuggested}`}
              data-test="add-suggested-item-to-playlist-button"
              aria-label="Add to playlist"
              title="Add to playlist"
              onClick={(e) => {
                e.stopPropagation();
                ctx.onAddSuggested?.(t, i);
              }}
            >
              <AddSuggestedIcon />
            </button>
          ) : (
            <>
              <AddToPlaylistButton track={t} />
              <button
                type="button"
                className={`${s.rowBtn} ${s.favBtn} ${fav ? s.favOn : ''}`}
                data-test="add-to-favorites-button"
                role="switch"
                aria-checked={fav}
                aria-label={fav ? 'Remove from My Collection' : 'Add to My Collection'}
                onClick={(e) => {
                  e.stopPropagation();
                  void toggleFavorite(t);
                }}
              >
                <Icon name={fav ? 'heart-filled' : 'heart'} size={14} testId={fav ? 'icon--general__heart-filled' : 'icon--general__heart'} />
              </button>
              {actions === 'radio' && (
                <button
                  type="button"
                  className={`${s.rowBtn} ${s.blockBtn}`}
                  data-test="block"
                  aria-label="Block"
                  title="Block"
                  onClick={(e) => {
                    e.stopPropagation();
                    void blockTrack(t);
                  }}
                >
                  <BlockIcon />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});

function SortArrow({ dir }: { dir: 'ASC' | 'DESC' }) {
  return (
    <span className={s.sortIcon}>
      <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true" data-test={dir === 'DESC' ? 'icon--general__arrow-down' : 'icon--general__arrow-up'}>
        <path d={dir === 'DESC' ? 'm4 6.5 4 4 4-4' : 'm4 9.5 4-4 4 4'} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function HeaderRow({ columns, wide, sort }: { columns: Column[]; wide: boolean; sort?: MediaTableProps['sort'] }) {
  // like TIDAL, the cover column has no header of its own when there is an index: "Title" spans cover + title
  const merge = columns.includes('index') && columns.includes('cover');
  return (
    <div className={s.head} role="row">
      {columns
        .filter((c) => !(merge && c === 'cover'))
        .map((c) => (
          <span key={c} className={`${s.cell} ${s[CELL[c]]} ${merge && c === 'title' ? s.titleWithCover : ''} ${s.headCell}`} role="columnheader">
            {sort && HEAD[c] ? (
              <button type="button" className={s.sortable} onClick={() => sort.onSort(c)}>
                <span className="ellipsis">{HEAD[c]}</span>
                {sort.column === c && <SortArrow dir={sort.dir} />}
              </button>
            ) : (
              HEAD[c] && <span className={s.headLabel}>{HEAD[c]}</span>
            )}
          </span>
        ))}
      <div className={`${s.cell} ${s.actions} ${wide ? s.actionsWide : ''} ${s.headCell}`} />
    </div>
  );
}

function VolumeHeader({ n, columns, wide }: { n: number; columns: Column[]; wide: boolean }) {
  return (
    <div className={s.volumeHeader} data-test="volume-header">
      <div className={s.volumeSeparator}>
        <span className={s.volumeLabel}>Volume {n}</span>
      </div>
      <HeaderRow columns={columns} wide={wide} />
    </div>
  );
}

const ROW_H = 48;
const VOLUME_H = 92;

export function MediaTable(props: MediaTableProps) {
  const { items, source, showHeader = true, testId = 'media-table' } = props;
  const columns = props.columns ?? ['index', 'title', 'artist', 'time'];
  const cur = usePlayer(currentTrack);
  const playing = usePlayer((st) => st.playing);
  const curSource = usePlayer((st) => st.source);
  const sameSource = !source || (curSource?.type === source.type && curSource.id === source.id);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const [onPlay] = useState(() => (i: number) => player.playList(itemsRef.current, i, sourceRef.current));
  const wide = props.rowActions === 'radio';
  const ctx = useMemo(
    () => ({ playlist: props.playlist, onRemove: props.onRemove, dateStyle: props.dateStyle, rowActions: props.rowActions, onAddSuggested: props.onAddSuggested, menuContext: props.menuContext, hideNumbers: props.hideNumbers, formatDate: props.formatDate }),
    [props.playlist, props.onRemove, props.dateStyle, props.rowActions, props.onAddSuggested, props.menuContext, props.hideNumbers, props.formatDate],
  );

  // volume sections: index of the first row of each volume (only when the album really has several)
  const volumeStarts = useMemo(() => {
    const m = new Map<number, number>();
    if (!props.volumes) return m;
    let prev = -1;
    items.forEach((t, i) => {
      const v = t.kind === 'track' ? t.volumeNumber : prev;
      if (v !== prev) m.set(i, v);
      prev = v;
    });
    return m.size > 1 ? m : new Map<number, number>();
  }, [items, props.volumes]);
  const sectioned = volumeStarts.size > 0;

  const listRef = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);
  const virtual = items.length > 100;
  const scrollEl = () => document.getElementById('main-scroll');
  useLayoutEffect(() => {
    const el = listRef.current;
    const sc = scrollEl();
    if (!el || !sc || !virtual) return;
    const m = Math.round(el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop);
    if (m !== margin) setMargin(m);
  });
  const v = useVirtualizer({
    count: items.length,
    getScrollElement: scrollEl,
    estimateSize: (i) => ROW_H + (volumeStarts.has(i) ? VOLUME_H : 0),
    overscan: 12,
    scrollMargin: margin,
    enabled: virtual,
  });

  const row = (i: number): ReactNode => {
    const t = items[i];
    const num = props.numbering === 'trackNumber' && t.kind === 'track' ? t.trackNumber : i + 1;
    const vol = volumeStarts.get(i);
    return (
      <div key={`${t.kind}-${t.id}-${i}`} className={s.rowWrap}>
        {vol !== undefined && <VolumeHeader n={vol} columns={columns} wide={wide} />}
        <Row t={t} i={i} num={num} columns={columns} active={!!cur && sameSource && cur.id === t.id} playing={playing} onPlay={onPlay} ctx={ctx} />
      </div>
    );
  };

  return (
    <div className={s.table} data-test={testId}>
      <div role="table" aria-label="Tracklist">
        {showHeader && !sectioned && <HeaderRow columns={columns} wide={wide} sort={props.sort} />}
        <div ref={listRef} style={virtual ? { height: v.getTotalSize(), position: 'relative' } : undefined}>
          {virtual
            ? v.getVirtualItems().map((vi) => (
                <div key={vi.key} style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${vi.start - margin}px)` }}>
                  {row(vi.index)}
                </div>
              ))
            : items.map((_, i) => row(i))}
        </div>
      </div>
    </div>
  );
}
