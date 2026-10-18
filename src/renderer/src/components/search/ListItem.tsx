// TIDAL's list cell ("list-item-album" …): cover (64px in results, 48px in the popover), title + badges,
// "Album · Artist" line and an optional meta line (release year). Used by search top results and recents.
import { useState } from 'react';
import { Link } from 'react-router';
import { coverUrl } from '@/api/images';
import { trackTitle, type MediaItem } from '@/api/models';
import { ExplicitBadge } from '@/components/Badges';
import { Icon } from '@/components/Icon';
import { cardImage, openItemMenu } from '@/components/MediaCard';
import { playItem, useIsPlayingSource } from '@/lib/play';
import { player } from '@/state/player';
import s from './ListItem.module.css';

const ALBUM_TYPE: Record<string, string> = { ALBUM: 'Album', EP: 'EP', SINGLE: 'Single', COMPILATION: 'Album' };

/** Search links: tracks open the track page (/track/:id) like the real app; videos have no page. */
export function searchPath(item: MediaItem): string | undefined {
  switch (item.kind) {
    case 'track':
      return `/track/${item.id}`;
    case 'video':
      return undefined;
    case 'album':
      return `/album/${item.id}`;
    case 'artist':
      return `/artist/${item.id}`;
    case 'playlist':
      return `/playlist/${item.uuid}`;
    case 'mix':
      return `/mix/${item.id}`;
    default:
      return undefined;
  }
}

export const itemTitle = (i: MediaItem) => (i.kind === 'artist' || i.kind === 'folder' ? i.name : i.kind === 'track' || i.kind === 'video' || i.kind === 'album' ? trackTitle(i) : i.title);

export function kindLabel(i: MediaItem): string {
  switch (i.kind) {
    case 'album':
      return ALBUM_TYPE[i.type] ?? 'Album';
    case 'track':
      return 'Track';
    case 'video':
      return 'Video';
    case 'playlist':
      return 'Playlist';
    case 'mix':
      return 'Mix';
    default:
      return '';
  }
}

/** Artist links (or the playlist creator) for subtitle lines. */
export function ItemArtists({ item, onNavigate }: { item: MediaItem; onNavigate?: () => void }) {
  if (item.kind === 'playlist') return <span data-test="playlist-creator-text">{item.creatorName ?? (item.type === 'EDITORIAL' ? 'TIDAL' : '')}</span>;
  if (item.kind === 'mix') return <span>{item.subTitle}</span>;
  if (item.kind !== 'album' && item.kind !== 'track' && item.kind !== 'video') return null;
  return (
    <span className="artist-link">
      {item.artists.map((a, k) => (
        <span key={`${a.id}-${k}`}>
          {k > 0 && ', '}
          <Link to={`/artist/${a.id}`} className={s.artistLink} data-test="grid-item-detail-text-title-artist" aria-label={a.name} title={a.name} onClick={onNavigate}>
            {a.name}
          </Link>
        </span>
      ))}
    </span>
  );
}

export const isExplicit = (i: MediaItem) => (i.kind === 'album' || i.kind === 'track' || i.kind === 'video') && i.explicit;

/** Play an item from a search cell (tracks/videos play alone, collections play from the top). */
export function playFromSearch(item: MediaItem, query: string) {
  if (item.kind === 'track' || item.kind === 'video') return player.playList([item], 0, { type: 'search', id: query, title: query });
  return playItem(item);
}

export function ListItem({
  item,
  size = 64,
  meta,
  query = '',
  menuButton,
  onOpen,
}: {
  item: MediaItem;
  size?: 64 | 48;
  meta?: boolean;
  query?: string;
  /** "…" button revealed on hover (popover recents) */
  menuButton?: boolean;
  /** called when a link inside the cell is followed (records the recent search, closes the popover) */
  onOpen?: () => void;
}) {
  const playing = useIsPlayingSource(item);
  const path = searchPath(item);
  const title = itemTitle(item);
  const round = item.kind === 'artist';
  const label = kindLabel(item);
  const year = meta && item.kind === 'album' ? item.releaseDate?.slice(0, 4) : undefined;
  const play = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onOpen?.();
    void playFromSearch(item, query);
  };

  return (
    <article className={`${s.cell} ${size === 48 ? s.small : ''}`} data-test={`list-item-${item.kind}`} onContextMenu={(e) => openItemMenu(e, item)}>
      <div className={s.cover}>
        {path ? (
          <Link to={path} className={s.coverLink} data-test="cell-cover" aria-label={title} role="group" onClick={onOpen} draggable={false}>
            <CoverImage item={item} round={round} />
            <span className={`${s.hover} ${round ? s.round : ''} ${playing ? s.forceShow : ''}`}>
              <button type="button" className={s.play} data-test="play-button" aria-label={playing ? 'Pause' : 'Play'} title="Play" onClick={play}>
                <Icon name={playing ? 'pause' : 'play'} size={16} />
              </button>
            </span>
          </Link>
        ) : (
          <a className={s.coverLink} data-test="cell-cover" aria-label={title} role="group" onClick={play}>
            <CoverImage item={item} round={round} />
            <span className={`${s.hover} ${playing ? s.forceShow : ''}`}>
              <button type="button" className={s.play} data-test="play-button" aria-label="Play" title="Play" onClick={play}>
                <Icon name="play" size={16} />
              </button>
            </span>
          </a>
        )}
      </div>
      <div className={`${s.text} ${round ? s.textArtist : year ? s.textMeta : ''}`}>
        <div className={s.textGrid}>
          {path ? (
            <Link to={path} className={s.titleLink} data-test="grid-item-detail-text-title-link" aria-label={title} title={title} onClick={onOpen}>
              <span className={s.titleContainer}>
                <span className={`${s.title} ellipsis`}>{title}</span>
                {isExplicit(item) && <ExplicitBadge />}
              </span>
            </Link>
          ) : (
            <a className={s.titleLink} data-test="grid-item-detail-text-title-link" aria-label={title} title={title} onClick={play}>
              <span className={s.titleContainer}>
                <span className={`${s.title} ellipsis`}>{title}</span>
                {isExplicit(item) && <ExplicitBadge />}
              </span>
            </a>
          )}
        </div>
        <span className={s.subtitle}>
          {!round && (
            <span className={s.desc}>
              <span className={s.detail}>
                <span className={s.kind}>{label}</span>
                <span className={s.dot}>·</span>
                <span className={`${s.artists} ellipsis`}>
                  <ItemArtists item={item} onNavigate={onOpen} />
                </span>
              </span>
            </span>
          )}
        </span>
        {size === 64 && (
          <div className={s.spacer}>
            {year && (
              <div className={s.meta}>
                <span className={s.metaText} data-test="meta-release-date">
                  {year}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
      <div className={s.buttons}>
        {menuButton && (
          <button
            type="button"
            className={`${s.menuBtn} context-menu-button`}
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
        )}
      </div>
    </article>
  );
}

export function CoverImage({ item, round, px = 64 }: { item: MediaItem; round?: boolean; px?: number }) {
  // artists without a portrait carry an album cover id (selectedAlbumCoverFallback): retry with cover sizes
  const fallback = item.kind === 'artist' ? coverUrl(item.picture, px) : undefined;
  const [failed, setFailed] = useState(0);
  const src = failed === 0 ? cardImage(item, px) : failed === 1 ? fallback : undefined;
  const cls = `${s.img} ${round ? s.imgRound : ''}`;
  return src ? <img className={cls} src={src} alt="" draggable={false} loading="lazy" onError={() => setFailed((n) => n + 1)} /> : <span className={cls} />;
}
