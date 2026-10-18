// Generic renderer for TIDAL v1 "pages" (explore, genre/mood/decade pages, single-module "View all" pages).
// Known module types render with the measured legacy layout; unknown types render nothing.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { artistUrl, coverUrl, mixImageUrl, squareUrl, videoImageUrl } from '@/api/images';
import { formatDuration, itemKey, itemPath, toAlbum, toArtist, toMix, toPlaylist, toTrack, toVideo, trackTitle, type MediaItem, type Track, type Video } from '@/api/models';
import { api, pageModuleItems, type PageModule } from '@/api/tidal';
import { AiBadge, ExplicitBadge } from './Badges';
import { Icon } from './Icon';
import { MediaTable } from './MediaTable';
import { openItemMenu } from './MediaCard';
import hs from './HorizontalList.module.css';
import { toMagazine, type Magazine } from './home/api';
import { MagazineCard } from './home/HomeModules';
import { PageLinkIcon } from './icons/home';
import { playItem, useIsPlayingSource } from '@/lib/play';
import { toggleFavorite, useIsFavorite } from '@/state/favorites';
import s from './pageModules.module.css';

/** `pages/genre_hip_hop` → `/view/pages/genre_hip_hop` */
export const pageRoute = (apiPath: string) => `/view/${apiPath.replace(/^\/+/, '').replace(/^(?!pages\/)/, 'pages/')}`;

// ── items ───────────────────────────────────────────────────────────────────

const MAPPERS: Record<string, (x: any) => MediaItem | null> = {
  ALBUM: toAlbum,
  ARTIST: toArtist,
  PLAYLIST: toPlaylist,
  MIX: toMix,
  VIDEO: toVideo,
  TRACK: toTrack,
};

/** Items of any v1 media module (incl. MIXED_TYPES_LIST / HIGHLIGHT_MODULE envelopes). */
export function moduleItems(m: PageModule): MediaItem[] {
  if (m.type === 'MIXED_TYPES_LIST') {
    return (m.raw.pagedList?.items ?? []).map((x: any) => MAPPERS[x.type]?.(x.item) ?? null).filter(Boolean) as MediaItem[];
  }
  if (m.type === 'HIGHLIGHT_MODULE') {
    return (m.raw.highlights ?? []).map((h: any) => MAPPERS[h.item?.type]?.(h.item?.item) ?? null).filter(Boolean) as MediaItem[];
  }
  return pageModuleItems(m);
}

const cardImage = (i: MediaItem, px: number) => {
  switch (i.kind) {
    case 'album':
      return coverUrl(i.cover, px);
    case 'playlist':
      return squareUrl(i.squareImage ?? i.image, px);
    case 'mix':
      return mixImageUrl(i, px);
    case 'artist':
      return artistUrl(i.picture, px);
    case 'video':
      return videoImageUrl(i.imageId, px * 1.78);
    case 'track':
      return coverUrl(i.album.cover, px);
    default:
      return undefined;
  }
};

const yearOf = (d?: string | null) => (d ? d.slice(0, 4) : '');

function metaText(i: MediaItem): string {
  if (i.kind === 'playlist') {
    if (!i.numberOfTracks && i.numberOfVideos) return `${i.numberOfVideos} ${i.numberOfVideos === 1 ? 'video' : 'videos'}`;
    return `${i.numberOfTracks} ${i.numberOfTracks === 1 ? 'track' : 'tracks'}`;
  }
  if (i.kind === 'album') return yearOf(i.releaseDate);
  if (i.kind === 'video') return formatDuration(i.duration);
  return '';
}

function Artists({ artists }: { artists: { id: number; name: string }[] }) {
  return (
    <>
      {artists.map((a, i) => (
        <Link key={`${a.id}-${i}`} to={`/artist/${a.id}`} className={s.artistLink} data-test="grid-item-detail-text-title-artist" title={a.name} onClick={(e) => e.stopPropagation()}>
          {a.name}
        </Link>
      ))}
    </>
  );
}

/** The pre-2024 TIDAL grid cell used on v1 pages ("grid-item-album" …). */
export function LegacyCard({ item }: { item: MediaItem }) {
  const fav = useIsFavorite(item);
  const playing = useIsPlayingSource(item);
  if (item.kind === 'folder') return null;
  const round = item.kind === 'artist';
  const title = item.kind === 'artist' ? item.name : item.kind === 'track' || item.kind === 'video' ? trackTitle(item) : item.title;
  const path = itemPath(item);
  const meta = metaText(item);
  const explicit = (item.kind === 'album' || item.kind === 'track' || item.kind === 'video') && item.explicit;
  const play = () => void playItem(item);
  return (
    <article className={`${s.cell} ${round ? s.artistCell : ''} ${item.kind === 'video' ? s.videoCell : ''}`} data-test={`grid-item-${item.kind}`} onContextMenu={(e) => openItemMenu(e, item)}>
      <div className={s.coverWrap}>
        <Link to={path} className={s.cover} data-test="cell-cover" aria-label={title} draggable={false}>
          <span className={s.coverImg}>{cardImage(item, 220) && <img src={cardImage(item, 220)} alt="" loading="lazy" draggable={false} />}</span>
          <span className={`${s.hover} ${playing ? s.hoverOn : ''}`}>
            {round ? (
              <span className={s.centerControls}>
                <PlayButton size={56} playing={playing} onClick={play} />
              </span>
            ) : (
              <span className={s.controls}>
                <PlayButton size={40} playing={playing} onClick={play} />
                <span className={s.controlsRight}>
                  <button
                    type="button"
                    className={s.ctrlBtn}
                    data-test="context-menu-button"
                    aria-label="Show options"
                    title="Show options"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openItemMenu(e.currentTarget, item);
                    }}
                  >
                    <Icon name="more" size={20} />
                  </button>
                  {item.kind !== 'track' && (
                    <button
                      type="button"
                      className={s.ctrlBtn}
                      data-test="favorite-button"
                      role="switch"
                      aria-checked={fav}
                      aria-label={fav ? 'Remove from My Collection' : 'Add to My Collection'}
                      title={fav ? 'Remove from My Collection' : 'Add to My Collection'}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void toggleFavorite(item);
                      }}
                    >
                      <Icon name={fav ? 'heart-filled' : 'heart'} size={16} />
                    </button>
                  )}
                </span>
              </span>
            )}
          </span>
        </Link>
      </div>
      <Link to={path} className={s.titleLink} data-test="grid-item-detail-text-title-link" title={title}>
        <span className={`${s.titleRow} ${round ? s.centered : ''}`}>
          <span className={`${s.title} ellipsis`}>{title}</span>
          {explicit && <ExplicitBadge />}
          {item.kind === 'album' && item.ai && <AiBadge />}
        </span>
      </Link>
      {!round && (
        <span className={s.desc}>
          {item.kind === 'album' || item.kind === 'track' || item.kind === 'video' ? (
            <span className={s.descInner}>
              <Artists artists={item.artists} />
            </span>
          ) : item.kind === 'playlist' ? (
            <span className={`${s.descInner} ellipsis`} data-test="playlist-creator-text">
              {item.creatorName ?? 'TIDAL'}
            </span>
          ) : item.kind === 'mix' ? (
            <span className={`${s.descInner} ellipsis`}>{item.subTitle}</span>
          ) : null}
        </span>
      )}
      {meta && (
        <div className={s.meta}>
          <span data-test={item.kind === 'playlist' ? 'grid-item-meta-item-count' : 'grid-item-meta'}>{meta}</span>
        </div>
      )}
    </article>
  );
}

function PlayButton({ size, playing, onClick }: { size: number; playing: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={s.play}
      style={{ width: size, height: size }}
      data-test="play-button"
      aria-label={playing ? 'Pause' : 'Play'}
      title={playing ? 'Pause' : 'Play'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      <span className={s.playDisc}>
        <Icon name={playing ? 'pause' : 'play'} size={Math.round(size * 0.45)} />
      </span>
    </button>
  );
}

// ── page title & module chrome ──────────────────────────────────────────────

export function PageTitle({ title, testId = 'page-title-container' }: { title: ReactNode; testId?: string }) {
  return (
    <div className={s.pageTitle} data-test={testId}>
      <div className={s.pageTitleRow}>
        <h1 className={s.pageTitleText}>{title}</h1>
      </div>
    </div>
  );
}

function ModuleHeader({ title, viewAll, arrows }: { title: string; viewAll?: string; arrows?: ReactNode }) {
  return (
    <div className={`${s.box} ${s.header}`}>
      {(title || viewAll || arrows) && (
        <div className={s.headerRow}>
          <div className={s.headerTitle}>
            <h2>{title}</h2>
          </div>
          {(viewAll || arrows) && (
            <div className={s.headerRight}>
              {arrows}
              {viewAll && (
                <Link to={viewAll} className={s.viewAll} data-test="view-all-link">
                  <span>View all</span>
                </Link>
              )}
            </div>
          )}
        </div>
      )}
      <div className={s.headerSpacer} />
    </div>
  );
}

// min-heights TIDAL reserves per module type (keeps the page from jumping while images load)
const MIN_HEIGHT: Record<string, number> = {
  ALBUM_LIST: 260,
  ARTIST_LIST: 226,
  MIX_LIST: 265,
  PLAYLIST_LIST: 278,
  VIDEO_LIST: 295,
  MIXED_TYPES_LIST: 260,
  FEATURED_PROMOTIONS: 308,
  MULTIPLE_TOP_PROMOTIONS: 308,
  HIGHLIGHT_MODULE: 360,
};

function ModuleBox({ m, children, minHeight = true }: { m: PageModule; children: ReactNode; minHeight?: boolean }) {
  return (
    <div className={`${s.box} ${s.module} ${m.type}`} data-test="occluded-module" style={minHeight && MIN_HEIGHT[m.type] ? { minHeight: MIN_HEIGHT[m.type] } : undefined}>
      {children}
    </div>
  );
}

// ── horizontal carousels (legacy) ───────────────────────────────────────────

const LEGACY_GAP = 24;
// measured at window widths 800–2200: 464→2, 664→3, 864→4, 1158→6, 1464→7, 1472→8 cards ⇒ 163px min + 24px gap
const legacyColumns = (w: number) => Math.max(2, Math.floor((w + LEGACY_GAP) / (163 + LEGACY_GAP)));

function useScroller(count: number) {
  const ref = useRef<HTMLElement>(null);
  const [cols, setCols] = useState(6);
  const [edges, setEdges] = useState({ start: true, end: true });
  const update = useCallback(() => {
    const el = ref.current;
    if (el) setEdges({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setCols(legacyColumns(el.clientWidth));
      update();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);
  useEffect(update, [update, count, cols]);
  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ left: el.scrollLeft + dir * (el.clientWidth + LEGACY_GAP), behavior: 'smooth' });
    setTimeout(update, 400);
  };
  return { ref, cols, edges, page, update };
}

function Arrows({ edges, page }: { edges: { start: boolean; end: boolean }; page: (d: 1 | -1) => void }) {
  return (
    <>
      <button type="button" className={hs.arrow} disabled={edges.start} aria-label="Previous" title="Previous" onClick={() => page(-1)}>
        <Icon name="chevron-left" size={16} />
      </button>
      <button type="button" className={hs.arrow} disabled={edges.end} aria-label="Next" title="Next" onClick={() => page(1)}>
        <Icon name="chevron-right" size={16} />
      </button>
    </>
  );
}

/** Module items; vertical (single-module "View all") pages page in the rest of the list. */
function usePagedItems(m: PageModule, vertical: boolean): MediaItem[] {
  const [items, setItems] = useState(() => moduleItems(m));
  useEffect(() => {
    const pl = m.raw.pagedList;
    if (!vertical || !pl?.dataApiPath || (pl.totalNumberOfItems ?? 0) <= (pl.items?.length ?? 0)) return;
    let alive = true;
    (async () => {
      const all = [...(pl.items ?? [])];
      for (let off = all.length; off < Math.min(pl.totalNumberOfItems, 1000) && alive; off += 50) {
        const r = await api('v1', pl.dataApiPath, { offset: off, limit: 50 }).catch(() => null);
        if (!r?.items?.length) break;
        all.push(...r.items);
        if (alive) setItems(moduleItems({ ...m, raw: { ...m.raw, pagedList: { ...pl, items: [...all] } } }));
      }
    })();
    return () => {
      alive = false;
    };
  }, [m, vertical]);
  return items;
}

function MediaListModule({ m, vertical }: { m: PageModule; vertical: boolean }) {
  const items = usePagedItems(m, vertical);
  const sc = useScroller(items.length);
  const viewAll = m.raw.showMore?.apiPath ? pageRoute(m.raw.showMore.apiPath) : undefined;

  if (!items.length) return null;
  if (vertical) {
    return (
      <>
        <ModuleHeader title={m.title} viewAll={viewAll} />
        <ModuleBox m={m} minHeight={false}>
          <section className={s.vgrid} data-test="grid">
            {items.map((it) => (
              <div key={itemKey(it)} className={`${s.vcell} ${it.kind === 'artist' ? s.vArtist : it.kind === 'video' ? s.vVideo : it.kind === 'mix' ? s.vMix : ''}`}>
                <LegacyCard item={it} />
              </div>
            ))}
          </section>
        </ModuleBox>
      </>
    );
  }
  const showArrows = items.length > sc.cols;
  return (
    <>
      <ModuleHeader title={m.title} viewAll={viewAll} arrows={showArrows ? <Arrows edges={sc.edges} page={sc.page} /> : undefined} />
      <ModuleBox m={m}>
        <section
          ref={sc.ref as React.RefObject<HTMLElement>}
          className={s.hscroll}
          data-test="occluded-hscroll"
          onScroll={sc.update}
          style={{ gridAutoColumns: `calc((100% - ${sc.cols - 1} * ${LEGACY_GAP}px) / ${sc.cols})` }}
        >
          {items.map((it) => (
            <div key={itemKey(it)} className={s.hcell}>
              <LegacyCard item={it} />
            </div>
          ))}
        </section>
      </ModuleBox>
    </>
  );
}

function TrackListModule({ m }: { m: PageModule }) {
  const loc = useLocation();
  const items = usePagedItems(m, m.raw.scroll === 'VERTICAL').filter((t): t is Track | Video => t.kind === 'track' || t.kind === 'video');
  if (!items.length) return null;
  const viewAll = m.raw.showMore?.apiPath ? pageRoute(m.raw.showMore.apiPath) : undefined;
  return (
    <>
      <ModuleHeader title={m.title} viewAll={viewAll} />
      <ModuleBox m={m}>
        <MediaTable items={items} columns={['cover', 'title', 'artist', 'album', 'time']} source={{ type: 'home', id: `page:${m.raw.id ?? m.title}`, title: m.title, path: loc.pathname }} />
      </ModuleBox>
    </>
  );
}

// ── page links ──────────────────────────────────────────────────────────────

interface PageLinkItem {
  title: string;
  icon: string | null;
  apiPath: string;
}

function PageLinksCloud({ m }: { m: PageModule }) {
  const links: PageLinkItem[] = m.raw.pagedList?.items ?? m.raw.items ?? [];
  const lines = Math.max(1, Number(m.raw.lines) || 1);
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const update = useCallback(() => {
    const el = ref.current;
    if (el) setEdges({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update, links.length]);
  if (!links.length) return null;
  const perRow = Math.ceil(links.length / lines);
  const rows = Array.from({ length: lines }, (_, i) => links.slice(i * perRow, (i + 1) * perRow)).filter((r) => r.length);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(200, el.clientWidth - 150), behavior: 'smooth' });
  };
  const viewAll = m.raw.showMore?.apiPath ? pageRoute(m.raw.showMore.apiPath) : undefined;
  return (
    <>
      <ModuleHeader title={m.title} viewAll={viewAll} />
      <ModuleBox m={m}>
        <section>
          <div className={`${s.cloud} ${edges.start ? s.noPrevious : ''} ${edges.end ? s.noNext : ''}`}>
            <button type="button" className={`${s.cloudBtn} ${s.cloudLeft}`} aria-label="Scroll left" tabIndex={-1} onClick={() => scroll(-1)}>
              <Icon name="chevron-left" size={30} />
            </button>
            <button type="button" className={`${s.cloudBtn} ${s.cloudRight}`} aria-label="Scroll right" tabIndex={-1} onClick={() => scroll(1)}>
              <Icon name="chevron-right" size={30} />
            </button>
            <div ref={ref} className={s.cloudItems} onScroll={update}>
              <div className={s.cloudItem}>
                <div className={s.cloudRows} data-test="page-links-cloud">
                  {rows.map((row, i) => (
                    <div key={i} className={s.cloudRow} data-test="page-links-cloud-row">
                      {row.map((l) => (
                        <Link key={l.apiPath} to={pageRoute(l.apiPath)} className={s.pill} data-test="page-links-cloud-btn">
                          {l.title}
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </ModuleBox>
    </>
  );
}

function PageLinks({ m }: { m: PageModule }) {
  const links: PageLinkItem[] = m.raw.pagedList?.items ?? m.raw.items ?? [];
  if (!links.length) return null;
  return (
    <>
      <ModuleHeader title={m.title} />
      <ModuleBox m={m}>
        <section className={s.links} role="menu">
          {links.map((l) => (
            <Link key={l.apiPath} to={pageRoute(l.apiPath)} className={s.link} role="menuitem" data-test={`page-link-${l.title}`}>
              {l.icon && <PageLinkIcon icon={l.icon} />}
              <span className={s.linkText}>{l.title}</span>
            </Link>
          ))}
        </section>
      </ModuleBox>
    </>
  );
}

// ── promotions ──────────────────────────────────────────────────────────────

function PromotionsModule({ m }: { m: PageModule }) {
  const items: Magazine[] = (m.raw.items ?? m.raw.pagedList?.items ?? []).map(toMagazine);
  const sc = useScroller(items.length);
  if (!items.length) return null;
  const cols = Math.max(1, Math.round(sc.cols / 2));
  return (
    <>
      <ModuleHeader title={m.title} arrows={items.length > cols ? <Arrows edges={sc.edges} page={sc.page} /> : undefined} />
      <ModuleBox m={m}>
        <section
          ref={sc.ref as React.RefObject<HTMLElement>}
          className={s.hscroll}
          data-test="occluded-hscroll"
          onScroll={sc.update}
          style={{ gridAutoColumns: `calc((100% - ${cols - 1} * ${LEGACY_GAP}px) / ${cols})` }}
        >
          {items.map((it) => (
            <div key={`${it.id}-${it.artifactId}`} className={s.hcell}>
              <MagazineCard m={it} />
            </div>
          ))}
        </section>
      </ModuleBox>
    </>
  );
}

// ── dispatcher ──────────────────────────────────────────────────────────────

const MEDIA_LISTS = new Set(['ALBUM_LIST', 'PLAYLIST_LIST', 'MIX_LIST', 'ARTIST_LIST', 'VIDEO_LIST', 'MIXED_TYPES_LIST', 'HIGHLIGHT_MODULE']);

export function PageModuleView({ m }: { m: PageModule }) {
  if (m.type === 'PAGE_LINKS_CLOUD') return <PageLinksCloud m={m} />;
  if (m.type === 'PAGE_LINKS') return <PageLinks m={m} />;
  if (m.type === 'TRACK_LIST') return <TrackListModule m={m} />;
  if (m.type === 'FEATURED_PROMOTIONS' || m.type === 'MULTIPLE_TOP_PROMOTIONS') return <PromotionsModule m={m} />;
  if (MEDIA_LISTS.has(m.type)) return <MediaListModule m={m} vertical={m.raw.scroll === 'VERTICAL'} />;
  return null;
}

export function PageModules({ modules }: { modules: PageModule[] }) {
  return (
    <>
      {modules.map((m, i) => (
        <PageModuleView key={`${m.raw.id ?? i}-${m.type}`} m={m} />
      ))}
    </>
  );
}

