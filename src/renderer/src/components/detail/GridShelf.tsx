// Detail-page carousels ("More Albums by …", "Related Albums", "Related Artists"): TIDAL's grid-item cells,
// 6 columns with 24px gaps at the reference width, arrows + "View all" in the header.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { itemKey, itemPath, trackTitle, type MediaItem } from '@/api/models';
import { playItem, useIsPlayingSource } from '@/lib/play';
import { toggleFavorite, useIsFavorite } from '@/state/favorites';
import { Artwork } from '../Artwork';
import { ExplicitBadge } from '../Badges';
import { Icon } from '../Icon';
import { cardImage, openItemMenu } from '../MediaCard';
import s from './GridShelf.module.css';

const GAP = 24;
/** Cards per view for the card row's width, measured in TIDAL on album pages (row 364→1, 414–514→2, 564–664→3,
 *  764→4, 1158→6 columns): a ~172px minimum card, down to a single card at the narrowest widths. */
const colsFor = (w: number) => Math.max(1, Math.floor((w + GAP) / (172 + GAP)));

function year(item: MediaItem): string | null {
  if (item.kind === 'album') return item.releaseDate?.slice(0, 4) ?? null;
  return null;
}

/** `folder` variant (folder page): playlists show "N TRACKS" instead of the creator. */
export function GridCell({ item, variant = 'shelf' }: { item: MediaItem; variant?: 'shelf' | 'folder' }) {
  const fav = useIsFavorite(item);
  const playing = useIsPlayingSource(item);
  if (item.kind === 'folder') return null;
  const artist = item.kind === 'artist';
  const title = artist ? item.name : item.kind === 'track' || item.kind === 'video' ? trackTitle(item) : item.title;
  const y = year(item);
  const count = variant === 'folder' && item.kind === 'playlist' ? item.numberOfTracks + item.numberOfVideos : null;
  return (
    <article className={`${s.cell} ${artist ? s.artistCell : ''} ${variant === 'folder' ? s.folderCell : ''}`} data-test={`grid-item-${item.kind}`} onContextMenu={(e) => openItemMenu(e, item)}>
      <div className={s.coverWrap}>
        <Link to={itemPath(item)} className={s.cover} data-test="cell-cover" role="group" aria-label={title} draggable={false}>
          <Artwork src={cardImage(item, 173)} round={artist} radius={artist ? undefined : 3} className={s.image} fallbackIcon={artist ? 'artist' : 'album'} style={{ display: 'flex' }} />
          <div className={`${s.hover} ${playing ? s.hoverOn : ''}`}>
            {artist ? (
              <button
                type="button"
                className={s.playBig}
                data-test="play-button"
                aria-label="Play"
                title="Play"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void playItem(item);
                }}
              >
                <Icon name="play" size={22} />
              </button>
            ) : (
              <div className={s.controls}>
                <button
                  type="button"
                  className={s.play}
                  data-test="play-button"
                  aria-label={playing ? 'Pause' : 'Play'}
                  title={playing ? 'Pause' : 'Play'}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void playItem(item);
                  }}
                >
                  <Icon name={playing ? 'pause' : 'play'} size={18} />
                </button>
                <div className={s.right}>
                  {item.kind !== 'track' && item.kind !== 'video' && (
                    <button
                      type="button"
                      className={s.small}
                      role="switch"
                      aria-checked={fav}
                      aria-label={fav ? 'Remove from My Collection' : 'Add to My Collection'}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void toggleFavorite(item);
                      }}
                    >
                      <Icon name={fav ? 'heart-filled' : 'heart'} size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    className={s.small}
                    aria-label="Show options"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openItemMenu(e.currentTarget, item);
                    }}
                  >
                    <Icon name="more" size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </Link>
      </div>
      <Link to={itemPath(item)} className={s.titleLink} data-test="grid-item-detail-text-title-link" aria-label={title} title={title}>
        <div className={s.titleRow}>
          <span className={`${s.title} ellipsis`}>{title}</span>
          {(item.kind === 'album' || item.kind === 'track' || item.kind === 'video') && item.explicit && <ExplicitBadge />}
        </div>
      </Link>
      <span className={`${s.desc} ellipsis`}>
        {(item.kind === 'album' || item.kind === 'track' || item.kind === 'video') &&
          item.artists.map((a) => (
            <Link key={a.id} to={`/artist/${a.id}`} className={`${s.descLink} link`} data-test="grid-item-detail-text-title-artist" aria-label={a.name} title={a.name}>
              {a.name}
            </Link>
          ))}
        {item.kind === 'playlist' && variant !== 'folder' && (item.creatorName ?? '')}
        {item.kind === 'mix' && item.subTitle}
      </span>
      {y && (
        <div className={s.meta}>
          <span className={s.metaText} data-test="meta-release-date">
            {y}
          </span>
        </div>
      )}
      {count !== null && (
        <div className={s.meta}>
          <span className={s.metaText} data-test="grid-item-meta-item-count">
            {count} {count === 1 ? 'TRACK' : 'TRACKS'}
          </span>
        </div>
      )}
    </article>
  );
}

export function GridShelf({ title, items, viewAll, testId }: { title: string; items: MediaItem[]; viewAll?: string; testId?: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(6);
  const [edges, setEdges] = useState({ start: true, end: true });
  const hasItems = items.length > 0;
  useEffect(() => {
    // the card row itself (the shelf around it carries the header's 48px side margins)
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setCols(colsFor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasItems]);
  const update = useCallback(() => {
    const el = scroller.current;
    if (el) setEdges({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  }, []);
  useEffect(update, [update, items.length, cols]);
  if (!items.length) return null;
  const page = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * (scroller.current.clientWidth + GAP), behavior: 'smooth' });
  const arrows = items.length > cols;

  return (
    <div className={s.shelf}>
      <div className={s.header}>
        <h2 className={s.heading}>{title}</h2>
        <div className={s.headerRight}>
          {arrows && (
            <>
              <button type="button" className={s.arrow} title="Back" disabled={edges.start} onClick={() => page(-1)}>
                <Icon name="chevron-left" size={16} />
              </button>
              <button type="button" className={s.arrow} title="Next" disabled={edges.end} onClick={() => page(1)}>
                <Icon name="chevron-right" size={16} />
              </button>
            </>
          )}
          {viewAll && (
            <Link to={viewAll} className={s.viewAll} data-test="view-all-link">
              <span>View all</span>
            </Link>
          )}
        </div>
      </div>
      <div className={s.module} data-test={testId ?? 'occluded-module'}>
        <section
          ref={scroller}
          className={s.scroll}
          data-test="occluded-hscroll"
          onScroll={update}
          style={{ gridAutoColumns: `calc((100% - ${(cols - 1) * GAP}px) / ${cols})` }}
        >
          {items.map((it) => (
            <div key={itemKey(it)} className={s.slot}>
              <GridCell item={it} />
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
