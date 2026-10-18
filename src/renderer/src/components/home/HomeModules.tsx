// v2 home-feed modules (shortcuts, carousels, compact grids, context carousels, magazine promos) and the vibe tabs.
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { artistUrl, coverUrl, mixImageUrl, squareUrl, videoImageUrl, wideUrl } from '@/api/images';
import { itemKey, itemPath, toMediaItem, trackTitle, type MediaItem, type Track, type Video } from '@/api/models';
import type { FeedModule } from '@/api/tidal';
import { AiBadge, ExplicitBadge } from '@/components/Badges';
import { Icon } from '@/components/Icon';
import { HorizontalList, SectionHeader, carouselColumnsFor } from '@/components/HorizontalList';
import hs from '@/components/HorizontalList.module.css';
import { openItemMenu } from '@/components/MediaCard';
import { PaygatedBadge, PauseGlyph, PlayGlyph, SpotlightedBadge, UploadedBadge } from '@/components/icons/home';
import { showDialog } from '@/components/Dialog';
import { playItem, sourceOf } from '@/lib/play';
import { currentTrack, player, usePlayer, type PlaySource } from '@/state/player';
import { magazinePath, magazinesOf, type Magazine } from './api';
import s from './Home.module.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── helpers ─────────────────────────────────────────────────────────────────

export const viewAllPath = (viewAll?: string | null) => (viewAll ? `/${viewAll.replace(/^\/+/, '')}` : undefined);

export function itemTitle(i: MediaItem): string {
  if (i.kind === 'artist') return i.name;
  if (i.kind === 'track' || i.kind === 'video') return trackTitle(i);
  if (i.kind === 'folder') return i.name;
  return i.title;
}

/** Artwork for small rows (44–56px). */
export function smallImage(i: MediaItem, px = 56): string | undefined {
  switch (i.kind) {
    case 'album':
      return coverUrl(i.cover, px);
    case 'track':
      return coverUrl(i.album.cover, px);
    case 'video':
      return videoImageUrl(i.imageId, px * 1.78);
    case 'playlist':
      return squareUrl(i.squareImage, px) ?? wideUrl(i.image, px * 1.5);
    case 'mix':
      return mixImageUrl(i, px);
    case 'artist':
      return artistUrl(i.picture, px);
    default:
      return undefined;
  }
}

/** "Track radio" / "Artist radio" for radio mixes, else the mix subtitle. */
export function mixSubtitle(m: Extract<MediaItem, { kind: 'mix' }>): string {
  if (m.mixType === 'TRACK_MIX') return 'Track radio';
  if (m.mixType === 'ARTIST_MIX') return 'Artist radio';
  if (m.mixType === 'VIDEO_MIX') return 'Video radio';
  return m.subTitle;
}

const isPlayable = (i: MediaItem): i is Track | Video => i.kind === 'track' || i.kind === 'video';

/** Is this item (collection or single track) what the player is playing right now? */
function usePlaying(item: MediaItem): boolean {
  return usePlayer((st) => {
    if (!st.playing) return false;
    if (isPlayable(item)) return currentTrack(st)?.id === item.id;
    const src = sourceOf(item);
    return !!src && st.source?.type === src.type && st.source.id === src.id;
  });
}

/** Play a collection, or a track list starting at `item` (home rows of tracks). */
function playFrom(item: MediaItem, list: MediaItem[], source: PlaySource) {
  if (isPlayable(item)) {
    const st = usePlayer.getState();
    if (currentTrack(st)?.id === item.id) return player.toggle();
    const tracks = list.filter(isPlayable);
    player.playList(tracks, Math.max(0, tracks.indexOf(item)), source);
    return;
  }
  void playItem(item);
}

/** Error boundary per module: a malformed module never takes the page down. */
export class ModuleBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.error('[home] module failed to render', e);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// ── vibe tabs ───────────────────────────────────────────────────────────────

export function VibeSwitcher({ vibes, value, onChange }: { vibes: { name: string; type: string }[]; value: string; onChange: (type: string) => void }) {
  return (
    <div className={s.vibes} data-test="vibe-switcher">
      <div className={s.tabList} role="tablist">
        {vibes.map((v) => {
          const selected = v.type === value;
          return (
            <div key={v.type} className={`${s.tab} ${selected ? s.tabSelected : ''}`} data-test={`vibe-tab-${v.type.toLowerCase()}`}>
              <button type="button" role="tab" aria-selected={selected} className={s.tabButton} onClick={() => onChange(v.type)}>
                {v.name}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SHORTCUT_LIST ───────────────────────────────────────────────────────────

function shortcutSubtitle(i: MediaItem): string | null {
  switch (i.kind) {
    case 'album':
    case 'track':
    case 'video':
      return i.artists.map((a) => a.name).join(', ');
    case 'playlist':
      return `Created by ${i.creatorName ?? 'TIDAL'}`;
    case 'mix':
      return mixSubtitle(i);
    default:
      return null;
  }
}

function Shortcut({ item }: { item: MediaItem }) {
  const playing = usePlaying(item);
  const round = item.kind === 'artist';
  const sub = shortcutSubtitle(item);
  const id = item.kind === 'playlist' ? item.uuid : String(item.id);
  const imgTest = item.kind === 'mix' ? 'cover-art' : item.kind === 'artist' ? 'artist-image' : undefined;
  return (
    <div className={s.shortcut} onContextMenu={(e) => openItemMenu(e, item)}>
      <Link to={itemPath(item)} className={s.shortcutLink} draggable={false}>
        <div className={s.shortcutItem}>
          <ArtImg src={smallImage(item, 44)} className={`${s.shortcutImg} ${round ? s.round : item.kind === 'mix' ? s.noBg : ''}`} testId={imgTest} />
          {sub ? (
            <div className={s.shortcutText}>
              <div className={`${s.shortcutTitle} ellipsis`}>{itemTitle(item)}</div>
              <div className={`${s.shortcutSub} ellipsis`} data-test={item.kind === 'mix' ? `mix-subtitle-${id}` : undefined}>
                {sub}
              </div>
            </div>
          ) : (
            <div className={`${s.shortcutTitle} ${s.shortcutSolo} ellipsis`}>{itemTitle(item)}</div>
          )}
        </div>
      </Link>
      <div className={`${s.shortcutOverlay} ${playing ? s.overlayOn : ''}`}>
        <button
          type="button"
          className={s.overlayButton}
          data-test="shortcut-play-button"
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void playItem(item);
          }}
        >
          {playing ? <PauseGlyph /> : <PlayGlyph />}
        </button>
      </div>
    </div>
  );
}

/** <img> with TIDAL's dark placeholder background (keeps the box when the image is missing). */
function ArtImg({ src, className, testId }: { src?: string; className?: string; testId?: string }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <img src={src} alt="" className={className} data-test={testId} draggable={false} loading="lazy" onError={() => setFailed(true)} />
  ) : (
    <span className={className} data-test={testId} />
  );
}

export function ShortcutList({ module: m }: { module: FeedModule }) {
  if (!m.items.length) return null;
  return (
    <div className={s.shortcuts} data-test="shortcut-list">
      {m.items.slice(0, 6).map((it) => (
        <Shortcut key={itemKey(it)} item={it} />
      ))}
    </div>
  );
}

// ── COMPACT_GRID_CARD ───────────────────────────────────────────────────────

function ArtistLinks({ item }: { item: Extract<MediaItem, { artists: unknown }> }) {
  return (
    <>
      {item.artists.map((a, i) => (
        <span key={`${a.id}-${i}`}>
          {i > 0 && ', '}
          <Link to={`/artist/${a.id}`} className="link" data-test="grid-item-detail-text-title-artist" title={a.name} onClick={(e) => e.stopPropagation()}>
            {a.name}
          </Link>
        </span>
      ))}
    </>
  );
}

function CompactSubtitle({ item }: { item: MediaItem }) {
  switch (item.kind) {
    case 'album':
    case 'track':
    case 'video':
      return <ArtistLinks item={item} />;
    case 'playlist':
      return <span data-test="playlist-creator-text">{item.creatorName ?? 'TIDAL'}</span>;
    case 'mix':
      return <span data-test={`mix-subtitle-${item.id}`}>{mixSubtitle(item)}</span>;
    default:
      return null;
  }
}

function CompactRow({ item, list, source }: { item: MediaItem; list: MediaItem[]; source: PlaySource }) {
  const nav = useNavigate();
  const playing = usePlaying(item);
  const round = item.kind === 'artist';
  const hasSub = item.kind !== 'artist';
  // TIDAL: album rows get explicit/uploaded/paygated badges; track rows show the bare title (no version,
  // no explicit badge) plus the upload marker — gold "spotlighted" for editor picks, grey "uploaded" otherwise
  const explicit = item.kind === 'album' && item.explicit;
  const spotlighted = item.kind === 'track' && !!item.spotlighted;
  const uploaded = (item.kind === 'album' || item.kind === 'track') && !!item.upload && !spotlighted;
  const paygated = item.kind === 'album' && !!item.payToStream;
  const aiGen = item.kind === 'album' && !!item.ai;
  const play = () => playFrom(item, list, source);
  // row click / double-click start the track; only the overlay button toggles pause
  const start = () => {
    const st = usePlayer.getState();
    if (isPlayable(item) && st.playing && currentTrack(st)?.id === item.id && st.source?.id === source.id) return;
    play();
  };
  return (
    <div className={s.row} data-test={isPlayable(item) ? 'compact-track-row' : undefined} onContextMenu={(e) => openItemMenu(e, item)}>
      <div
        className={s.rowInner}
        role="link"
        tabIndex={-1}
        onClick={() => (isPlayable(item) ? start() : nav(itemPath(item)))}
        onDoubleClick={() => isPlayable(item) && start()}
      >
        <div className={`${s.rowArt} ${round ? s.round : ''}`}>
          <ArtImg src={smallImage(item, 56)} className={s.rowImg} />
          <div className={`${s.rowOverlay} ${playing ? s.overlayOn : ''}`}>
            <button
              type="button"
              className={s.overlayButton}
              aria-label={playing ? 'Pause' : 'Play'}
              title={playing ? 'Pause' : 'Play'}
              onClick={(e) => {
                e.stopPropagation();
                play();
              }}
              onDoubleClick={(e) => e.stopPropagation()}
            >
              {playing ? <PauseGlyph /> : <PlayGlyph />}
            </button>
          </div>
        </div>
        <div className={s.rowText}>
          <div className={s.rowTitleLine}>
            <div className={`${s.rowTitle} ellipsis`}>
              <Link to={itemPath(item)} className={s.titleLink} onClick={(e) => e.stopPropagation()}>
                {isPlayable(item) ? item.title : itemTitle(item)}
              </Link>
            </div>
            {(explicit || aiGen || uploaded || paygated || spotlighted) && (
              <span className={s.badges}>
                {explicit && <ExplicitBadge />}
                {aiGen && <AiBadge />}
                {spotlighted && <SpotlightedBadge />}
                {uploaded && <UploadedBadge />}
                {paygated && <PaygatedBadge />}
              </span>
            )}
          </div>
          {hasSub && (
            <div className={`${s.rowSub} ellipsis`}>
              <CompactSubtitle item={item} />
            </div>
          )}
        </div>
        <div className={s.rowButtons}>
          <button
            type="button"
            className={s.menuButton}
            aria-label="More options"
            onClick={(e) => {
              e.stopPropagation();
              openItemMenu(e.currentTarget, item);
            }}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <Icon name="more" size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}

const showSpotlightInfo = () =>
  void showDialog(
    'Spotlight',
    <p style={{ margin: 0, color: 'var(--c-text-2)', lineHeight: '22px' }}>
      Spotlighted tracks are uploads from independent artists, hand-picked by TIDAL’s editors. They are marked with a gold badge.
    </p>,
  );

export function ModuleTitle({ title, subtitle, viewAll, info }: { title: string; subtitle?: string | null; viewAll?: string; info?: () => void }) {
  return (
    <div className={s.moduleHeader}>
      <div className={s.moduleHeaderText}>
        <div className={s.moduleTitleRow}>
          <h2 className={s.moduleTitle}>{title}</h2>
          {info && (
            <button type="button" className={s.infoButton} aria-label="Spotlight" onClick={info}>
              <Icon name="info" size={16} />
            </button>
          )}
        </div>
        {subtitle && <p className={s.moduleSubtitle}>{subtitle}</p>}
      </div>
      {viewAll && (
        <Link to={viewAll} className={s.viewAll} data-test="view-all-link">
          <span>View all</span>
        </Link>
      )}
    </div>
  );
}

export function CompactGrid({ module: m }: { module: FeedModule }) {
  if (!m.items.length) return null;
  const items = m.items.slice(0, 9);
  const source: PlaySource = { type: 'home', id: m.moduleId, title: m.title, path: '/' };
  return (
    <div className={s.compact}>
      <ModuleTitle title={m.title} subtitle={m.subtitle} viewAll={viewAllPath(m.viewAll)} info={(m.raw?.icons ?? []).includes('SPOTLIGHT_INFO') ? showSpotlightInfo : undefined} />
      <div className={s.grid}>
        {items.map((it) => (
          <CompactRow key={itemKey(it)} item={it} list={items} source={source} />
        ))}
      </div>
    </div>
  );
}

// ── HORIZONTAL_LIST_WITH_CONTEXT ("Because you liked …") ───────────────────

function ContextHeader({ module: m }: { module: FeedModule }) {
  const h = m.raw?.header;
  const ctx: MediaItem | null = h?.data ? toMediaItem(h.type, h.data) : null;
  const id = ctx ? (ctx.kind === 'playlist' ? ctx.uuid : String(ctx.id)) : '';
  const kind = ctx?.kind ?? 'album';
  const body = (
    <div className={s.ctxWrap}>
      {ctx && <ArtImg src={smallImage(ctx, 48)} className={`${s.ctxImg} ${ctx.kind === 'artist' ? s.round : ''}`} testId={`horizontal-list-${kind}-header-image--${id}`} />}
      <div className={s.ctxText} title={m.title} aria-label={m.title}>
        <div className={s.ctxPre}>
          <span>{m.title}</span>
        </div>
        {ctx && <div className={`${s.ctxTitle} ellipsis`}>{itemTitle(ctx)}</div>}
      </div>
    </div>
  );
  return (
    <div className={s.ctxHeader}>
      {ctx ? (
        <Link to={itemPath(ctx)} className={s.ctxCard}>
          {body}
        </Link>
      ) : (
        body
      )}
      {m.viewAll && (
        <Link to={viewAllPath(m.viewAll)!} className={s.viewAll} data-test="view-all-link">
          <span>View all</span>
        </Link>
      )}
    </div>
  );
}


// ── MAGAZINE promos (Uploads → Featured) ────────────────────────────────────

export function MagazineCard({ m }: { m: Magazine }) {
  const nav = useNavigate();
  const to = magazinePath(m);
  const img = m.imageId ? `https://resources.tidal.com/images/${m.imageId.replace(/-/g, '/')}/550x400.jpg` : (m.imageUrl ?? undefined);
  return (
    <article className={s.promo} data-test="promo-cell" role="link" onClick={() => to && nav(to)}>
      <ArtImg src={img} className={s.promoImg} />
      <div className={s.promoText}>
        {m.header && <span className={`${s.promoHeader} ellipsis`}>{m.header}</span>}
        <span className={`${s.promoTitle} ellipsis`}>{m.title}</span>
        {m.subtitle && <span className={s.promoSub}>{m.subtitle}</span>}
      </div>
    </article>
  );
}

const promoColumns = (w: number) => Math.max(1, Math.round(carouselColumnsFor(w) / 2));

function MagazineList({ module: m }: { module: FeedModule }) {
  const items = magazinesOf(m.raw);
  const wrap = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(3);
  const [edges, setEdges] = useState({ start: true, end: true });
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setCols(promoColumns(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const update = useCallback(() => {
    const el = scroller.current;
    if (el) setEdges({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  }, []);
  useEffect(update, [update, items.length, cols]);
  if (!items.length) return null;
  const page = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * (scroller.current.clientWidth - 12 + 16), behavior: 'smooth' });
  return (
    <section className={hs.section} ref={wrap}>
      <SectionHeader
        title={m.title}
        testId={`horizontal-list--${m.moduleId}-header`}
        viewAll={viewAllPath(m.viewAll)}
        arrows={
          items.length > cols && (
            <>
              <button type="button" className={hs.arrow} disabled={edges.start} aria-label="Previous" onClick={() => page(-1)}>
                <Icon name="chevron-left" size={16} />
              </button>
              <button type="button" className={hs.arrow} disabled={edges.end} aria-label="Next" onClick={() => page(1)}>
                <Icon name="chevron-right" size={16} />
              </button>
            </>
          )
        }
      />
      <div ref={scroller} className={hs.scroll} data-test={`horizontal-list--${m.moduleId}-scroll`} onScroll={update} style={{ '--cols': cols } as React.CSSProperties}>
        {items.map((it) => (
          <div key={it.id} className={hs.cell}>
            <MagazineCard m={it} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ── dispatcher ──────────────────────────────────────────────────────────────

export function HomeModule({ module: m }: { module: FeedModule }) {
  const allTracks = m.items.length > 0 && m.items.every(isPlayable);
  switch (m.type) {
    case 'SHORTCUT_LIST':
      return <ShortcutList module={m} />;
    case 'COMPACT_GRID_CARD':
      return <CompactGrid module={m} />;
    case 'HORIZONTAL_LIST_WITH_CONTEXT':
      if (!m.items.length) return null;
      return <HorizontalList title={m.title} items={m.items} moduleId={m.moduleId} viewAll={viewAllPath(m.viewAll)} header={<ContextHeader module={m} />} />;
    default:
      if ((m.raw?.items ?? []).some((i: any) => i?.type === 'MAGAZINE')) return <MagazineList module={m} />;
      if (!m.items.length) return null;
      if (allTracks) return <CompactGrid module={m} />;
      return <HorizontalList title={m.title} items={m.items} moduleId={m.moduleId} viewAll={viewAllPath(m.viewAll)} />;
  }
}
