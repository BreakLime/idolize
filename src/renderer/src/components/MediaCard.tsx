// Grid/carousel card for albums, playlists, mixes, artists and videos (176px wide at TIDAL's default layout).
import { Link } from 'react-router';
import { artistUrl, coverUrl, mixImageUrl, squareUrl, videoImageUrl } from '@/api/images';
import { itemPath, trackTitle, type MediaItem } from '@/api/models';
import { playItem, useIsPlayingSource } from '@/lib/play';
import { toggleFavorite, useIsFavorite } from '@/state/favorites';
import { Artwork } from './Artwork';
import { AiBadge, ExplicitBadge } from './Badges';
import { PlayCircle } from './Buttons';
import { Icon } from './Icon';
import { PaygatedBadge, UploadedBadge } from './icons/home';
import { albumMenu, artistMenu, folderMenu, mixMenu, playlistMenu, trackMenu } from './menus';
import s from './MediaCard.module.css';

const idOf = (i: MediaItem) => (i.kind === 'playlist' ? i.uuid : String(i.id));

export function cardImage(item: MediaItem, px = 176): string | undefined {
  switch (item.kind) {
    case 'album':
      return coverUrl(item.cover, px);
    case 'track':
      return coverUrl(item.album.cover, px);
    case 'playlist':
      return squareUrl(item.squareImage ?? item.image, px);
    case 'mix':
      return mixImageUrl(item, px);
    case 'artist':
      return artistUrl(item.picture, px);
    case 'video':
      return videoImageUrl(item.imageId, px * 1.78);
    default:
      return undefined;
  }
}

export function openItemMenu(e: React.MouseEvent | HTMLElement, item: MediaItem) {
  const at = e instanceof HTMLElement ? e : { clientX: e.clientX, clientY: e.clientY };
  if (!(e instanceof HTMLElement)) e.preventDefault();
  if (item.kind === 'album') albumMenu(at, item);
  else if (item.kind === 'playlist') playlistMenu(at, item);
  else if (item.kind === 'mix') mixMenu(at, item);
  else if (item.kind === 'artist') void artistMenu(at, item);
  else if (item.kind === 'folder') folderMenu(at, item);
  else if (item.kind === 'track' || item.kind === 'video') void trackMenu(at, item);
}

function Subtitle({ item }: { item: MediaItem }) {
  switch (item.kind) {
    case 'album':
    case 'track':
    case 'video':
      return (
        <>
          {item.artists.map((a, i) => (
            <span key={a.id}>
              {i > 0 && ', '}
              <Link to={`/artist/${a.id}`} className="link" data-test="grid-item-detail-text-title-artist" onClick={(e) => e.stopPropagation()}>
                {a.name}
              </Link>
            </span>
          ))}
        </>
      );
    case 'playlist':
      return <span data-test="playlist-creator-text">{item.creatorName ?? (item.type === 'EDITORIAL' ? 'TIDAL' : '')}</span>;
    case 'mix':
      return <span data-test={`mix-subtitle-${item.id}`}>{item.subTitle}</span>;
    default:
      return null;
  }
}

/** `subtitle` replaces the default artist/creator line (e.g. "2025 • Album" on artist pages). */
export function MediaCard({ item, testPrefix, subtitle }: { item: MediaItem; testPrefix?: string; subtitle?: React.ReactNode }) {
  const fav = useIsFavorite(item);
  const playing = useIsPlayingSource(item);
  if (item.kind === 'folder') return null;
  const kind = testPrefix ?? item.kind;
  const id = idOf(item);
  const round = item.kind === 'artist';
  const title = item.kind === 'artist' ? item.name : item.kind === 'track' || item.kind === 'video' ? trackTitle(item) : item.title;
  const playTest = item.kind === 'mix' ? `mix-card-${id}-play-button` : item.kind === 'playlist' ? `playlist-play-button-${id}` : item.kind === 'video' ? `video-play-button-${id}` : `play-button-${id}`;

  return (
    <div className={`${s.card} ${round ? s.artist : ''} ${item.kind === 'video' ? s.video : ''}`} data-test={`${kind}-card-${id}`} role="presentation" onContextMenu={(e) => openItemMenu(e, item)}>
      <Link to={itemPath(item)} className={s.imageWrap} draggable={false}>
        <Artwork src={cardImage(item)} round={round} radius={round ? undefined : 2} className={s.image} imgTestId={item.kind === 'mix' ? 'mix-image' : undefined} fallbackIcon={round ? 'artist' : 'album'} />
        <div className={`${s.overlay} ${round ? s.overlayRound : ''} ${playing ? s.forceShow : ''}`}>
          <div className={s.play}>
            <PlayCircle size={36} playing={playing} testId={playTest} onClick={() => void playItem(item)} />
          </div>
          {!round && item.kind !== 'track' && (
            <button
              type="button"
              className={s.fav}
              role="switch"
              aria-checked={fav}
              aria-label={fav ? 'Remove from My Collection' : 'Add to My Collection'}
              data-test={`favorite-button-${id}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void toggleFavorite(item);
              }}
            >
              <Icon name={fav ? 'heart-filled' : 'heart'} size={12} testId="icon--general__heart" />
            </button>
          )}
        </div>
      </Link>
      <div className={s.details}>
        <div className={s.titleRow}>
          <Link to={itemPath(item)} className={`${s.title} ellipsis link`} title={title}>
            {title}
          </Link>
          {(item.kind === 'album' || item.kind === 'track' || item.kind === 'video') && item.explicit && <ExplicitBadge />}
          {item.kind === 'album' && item.ai && <AiBadge />}
          {(item.kind === 'album' || item.kind === 'track') && item.upload && <UploadedBadge />}
          {item.kind === 'album' && item.payToStream && <PaygatedBadge />}
        </div>
        {!round && (
          <div className={s.subtitle}>
            {subtitle ?? <Subtitle item={item} />}
          </div>
        )}
      </div>
    </div>
  );
}
