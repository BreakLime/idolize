// Grid cells of the collection pages (TIDAL's "cell" articles): cover with hover controls, title, subtitle, meta.
import { Link } from 'react-router';
import { artistUrl, coverUrl, squareUrl, videoImageUrl } from '@/api/images';
import { formatDuration, itemPath, trackTitle, type Album, type Artist, type Folder, type MediaItem, type Playlist, type Track, type Video } from '@/api/models';
import { Artwork } from '@/components/Artwork';
import { ExplicitBadge } from '@/components/Badges';
import { Icon } from '@/components/Icon';
import { MediaCard, openItemMenu } from '@/components/MediaCard';
import { folderMenu } from '@/components/menus';
import { playItem, useIsPlayingSource } from '@/lib/play';
import { toggleFavorite, useIsFavorite } from '@/state/favorites';
import { useSession } from '@/state/session';
import { CollectionIcon } from '@/components/icons/collection';
import s from './Collection.module.css';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Artists({ item }: { item: Album | Track | Video }) {
  return (
    <span>
      {item.artists.map((a, i) => (
        <span key={`${a.id}-${i}`}>
          {i > 0 && ', '}
          <Link to={`/artist/${a.id}`} className={s.artistLink} data-test="grid-item-detail-text-title-artist" title={a.name} onClick={(e) => e.stopPropagation()}>
            {a.name}
          </Link>
        </span>
      ))}
    </span>
  );
}

function PlayButton({ item, size = 40 }: { item: MediaItem; size?: number }) {
  const playing = useIsPlayingSource(item);
  return (
    <button
      type="button"
      className={s.playBtn}
      style={{ width: size, height: size }}
      data-test="play-button"
      aria-label={playing ? 'Pause' : 'Play'}
      title={playing ? 'Pause' : 'Play'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void playItem(item);
      }}
    >
      <span className={s.playDisc}>
        <Icon name={playing ? 'pause' : 'play'} size={size > 40 ? 22 : 16} />
      </span>
    </button>
  );
}

function MenuButton({ item }: { item: MediaItem }) {
  return (
    <button
      type="button"
      className={s.roundBtn}
      data-test="context-menu-button"
      aria-label="Show options"
      title="Show options"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (item.kind === 'folder') folderMenu(e.currentTarget, item);
        else openItemMenu(e.currentTarget, item);
      }}
    >
      <Icon name="more" size={20} />
    </button>
  );
}

function FavoriteButton({ item }: { item: MediaItem }) {
  const fav = useIsFavorite(item);
  return (
    <button
      type="button"
      className={s.roundBtn}
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
      <Icon name={fav ? 'heart-filled' : 'heart'} size={20} />
    </button>
  );
}

/** Folder context menu: TIDAL's (rename, delete, create playlist), shared with sidebar rows. */
export { folderMenu };

/** Bottom row of hover controls: play on the left, options + heart on the right. */
function HoverControls({ item, play = true, favorite = true }: { item: MediaItem; play?: boolean; favorite?: boolean }) {
  const playing = useIsPlayingSource(item);
  return (
    <div className={`${s.hover} ${playing ? s.hoverOn : ''}`}>
      <div className={s.hoverRow}>
        {play ? <PlayButton item={item} /> : <span />}
        <div className={s.hoverRight}>
          <MenuButton item={item} />
          {favorite && <FavoriteButton item={item} />}
        </div>
      </div>
    </div>
  );
}

function Title({ item, to, title, centered }: { item: MediaItem; to: string; title: string; centered?: boolean }) {
  const explicit = (item.kind === 'album' || item.kind === 'track' || item.kind === 'video') && item.explicit;
  return (
    <Link to={to} className={s.titleLink} data-test="grid-item-detail-text-title-link" aria-label={title} title={title}>
      <span className={`${s.titleRow} ${centered ? s.centered : ''}`}>
        <span className={s.titleText}>{title}</span>
        {explicit && <ExplicitBadge />}
      </span>
    </Link>
  );
}

const releaseYear = (d?: string | null) => (d ? d.slice(0, 4) : '');

function AlbumCell({ item }: { item: Album }) {
  const to = itemPath(item);
  return (
    <article className={s.cell} data-test="grid-item-album" onContextMenu={(e) => openItemMenu(e, item)} onDoubleClick={() => void playItem(item)}>
      <div className={s.coverWrap}>
        <Link to={to} className={s.cover} data-test="cell-cover" aria-label={item.title} draggable={false}>
          <Artwork src={coverUrl(item.cover, 320)} className={s.coverImg} />
          <HoverControls item={item} />
        </Link>
      </div>
      <Title item={item} to={to} title={trackTitle(item)} />
      <span className={s.desc}>
        <Artists item={item} />
      </span>
      <div className={s.meta}>
        <span data-test="meta-release-date">{releaseYear(item.releaseDate)}</span>
      </div>
    </article>
  );
}

function PlaylistCell({ item }: { item: Playlist }) {
  const me = useSession((st) => st.auth?.userId);
  const to = itemPath(item);
  const own = me !== undefined && item.creatorId === me;
  const creator = item.creatorName ?? (own ? 'me' : item.type === 'EDITORIAL' ? 'TIDAL' : '');
  return (
    <article className={s.cell} data-test="grid-item-playlist" onContextMenu={(e) => openItemMenu(e, item)} onDoubleClick={() => void playItem(item)}>
      <div className={s.coverWrap}>
        <Link to={to} className={s.cover} data-test="cell-cover" aria-label={item.title} draggable={false}>
          <Artwork src={squareUrl(item.squareImage ?? item.image, 320)} className={s.coverImg} fallbackIcon="playlist" />
          <HoverControls item={item} favorite={!own} />
        </Link>
      </div>
      <Title item={item} to={to} title={item.title} />
      <span className={s.desc}>
        <span className={s.creator} data-test="playlist-creator-text">
          {creator}
        </span>
      </span>
      <div className={s.meta}>
        <span data-test="grid-item-meta-item-count">{plural(item.numberOfTracks + item.numberOfVideos, 'track')}</span>
      </div>
    </article>
  );
}

function FolderCell({ item }: { item: Folder }) {
  const to = itemPath(item);
  return (
    <article className={s.cell} data-test="grid-item-folder" onContextMenu={(e) => (e.preventDefault(), folderMenu(e, item))}>
      <div className={s.coverWrap}>
        <Link to={to} className={s.cover} data-test="folder-cover" aria-label={item.name} draggable={false}>
          <div className={s.folderTile}>
            <CollectionIcon name="folder" size={66} stroke={1.8} />
          </div>
          <HoverControls item={item} play={false} favorite={false} />
        </Link>
      </div>
      <Title item={item} to={to} title={item.name} />
      <span className={`${s.desc} ${s.descEmpty}`} />
      <div className={s.meta}>
        <span data-test="grid-item-meta-item-count">{plural(item.numberOfItems, 'playlist')}</span>
      </div>
    </article>
  );
}

function ArtistCell({ item }: { item: Artist }) {
  const to = itemPath(item);
  return (
    <article className={`${s.cell} ${s.artistCell}`} data-test="grid-item-artist" onContextMenu={(e) => openItemMenu(e, item)}>
      <div className={s.coverWrap}>
        <Link to={to} className={`${s.cover} ${s.round}`} data-test="cell-cover" aria-label={item.name} draggable={false}>
          <Artwork src={artistUrl(item.picture, 320)} round className={s.coverImg} fallbackIcon="artist" />
          <div className={s.artistHover}>
            <PlayButton item={item} size={56} />
          </div>
        </Link>
      </div>
      <Title item={item} to={to} title={item.name} centered />
    </article>
  );
}

function VideoCell({ item }: { item: Video }) {
  const to = itemPath(item);
  return (
    <article className={s.cell} data-test="grid-item-video" onContextMenu={(e) => openItemMenu(e, item)} onDoubleClick={() => void playItem(item)}>
      <div className={s.coverWrap}>
        <Link to={to} className={`${s.cover} ${s.wide}`} data-test="cell-cover" aria-label={item.title} draggable={false}>
          <Artwork src={videoImageUrl(item.imageId, 320)} className={s.coverImg} fallbackIcon="video" style={{ aspectRatio: '16 / 9' }} />
          <HoverControls item={item} />
        </Link>
      </div>
      <Title item={item} to={to} title={trackTitle(item)} />
      <span className={s.desc}>
        <Artists item={item} />
      </span>
      <div className={s.meta}>
        <span data-test="grid-item-meta-duration">{`${Math.max(1, Math.round(item.duration / 60))} min`}</span>
      </div>
    </article>
  );
}

function TrackCell({ item }: { item: Track }) {
  const to = `/album/${item.album.id}`;
  return (
    <article className={s.cell} data-test="grid-item-track" onContextMenu={(e) => openItemMenu(e, item)} onDoubleClick={() => void playItem(item)}>
      <div className={s.coverWrap}>
        <Link to={to} className={s.cover} data-test="cell-cover" aria-label={item.title} draggable={false}>
          <Artwork src={coverUrl(item.album.cover, 320)} className={s.coverImg} />
          <HoverControls item={item} />
        </Link>
      </div>
      <Title item={item} to={to} title={trackTitle(item)} />
      <span className={s.desc}>
        <Artists item={item} />
      </span>
      <div className={s.meta}>
        <span>{formatDuration(item.duration)}</span>
      </div>
    </article>
  );
}

/** Wrapper that reserves TIDAL's per-kind cell height (cover + text + bottom gap). */
export function GridCell({ item }: { item: MediaItem }) {
  const ratio = item.kind === 'artist' ? s.ratioArtist : item.kind === 'video' ? s.ratioVideo : item.kind === 'mix' ? s.ratioMix : s.ratioAlbum;
  let cell: React.ReactNode;
  switch (item.kind) {
    case 'album':
      cell = <AlbumCell item={item} />;
      break;
    case 'playlist':
      cell = <PlaylistCell item={item} />;
      break;
    case 'folder':
      cell = <FolderCell item={item} />;
      break;
    case 'artist':
      cell = <ArtistCell item={item} />;
      break;
    case 'video':
      cell = <VideoCell item={item} />;
      break;
    case 'track':
      cell = <TrackCell item={item} />;
      break;
    case 'mix':
      cell = <MediaCard item={item} />;
      break;
  }
  return (
    <div className={`${s.staticCell} ${ratio}`} role="row">
      <div role="gridcell">{cell}</div>
    </div>
  );
}
