// TIDAL's grid cell ("grid-item-album" …) used by the search tabs: cover with hover controls
// (play / options / favourite, or a centred play for profiles), title, artist line and a meta line.
import { Link } from 'react-router';
import type { MediaItem } from '@/api/models';
import { ExplicitBadge } from '@/components/Badges';
import { Icon } from '@/components/Icon';
import { openItemMenu } from '@/components/MediaCard';
import { useIsPlayingSource } from '@/lib/play';
import { toggleFavorite, useIsFavorite } from '@/state/favorites';
import { CoverImage, isExplicit, ItemArtists, itemTitle, playFromSearch, searchPath } from './ListItem';
import s from './GridItem.module.css';

function metaOf(item: MediaItem): { text: string; testId?: string } | null {
  switch (item.kind) {
    case 'album':
      return item.releaseDate ? { text: item.releaseDate.slice(0, 4), testId: 'meta-release-date' } : null;
    case 'playlist': {
      const n = item.numberOfTracks + item.numberOfVideos;
      return { text: `${n} ${n === 1 ? 'track' : 'tracks'}`, testId: 'grid-item-meta-item-count' };
    }
    case 'video':
      return { text: `${Math.max(1, Math.round(item.duration / 60))} min` };
    default:
      return null;
  }
}

export function GridItem({ item, query = '', onOpen }: { item: MediaItem; query?: string; onOpen?: () => void }) {
  const fav = useIsFavorite(item);
  const playing = useIsPlayingSource(item);
  const path = searchPath(item);
  const title = itemTitle(item);
  const round = item.kind === 'artist';
  const meta = metaOf(item);
  const play = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onOpen?.();
    void playFromSearch(item, query);
  };
  const cover = (
    <>
      <CoverImage item={item} round={round} px={224} />
      {round ? (
        <span className={`${s.hover} ${s.hoverRound} ${playing ? s.forceShow : ''}`}>
          <button type="button" className={`${s.playBtn} ${s.big}`} data-test="play-button" aria-label={playing ? 'Pause' : 'Play'} title="Play" onClick={play}>
            <span className={s.disc}>
              <Icon name={playing ? 'pause' : 'play'} size={20} />
            </span>
          </button>
        </span>
      ) : (
        <span className={`${s.hover} ${playing ? s.forceShow : ''}`}>
          <span className={s.controls}>
            <button type="button" className={s.playBtn} data-test="play-button" aria-label={playing ? 'Pause' : 'Play'} title="Play" onClick={play}>
              <span className={s.disc}>
                <Icon name={playing ? 'pause' : 'play'} size={14} />
              </span>
            </button>
            <span className={s.right}>
              <button
                type="button"
                className={s.round}
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
              <button
                type="button"
                className={s.round}
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
            </span>
          </span>
        </span>
      )}
    </>
  );

  return (
    <article className={`${s.cell} ${item.kind === 'video' ? s.video : ''} ${round ? s.artist : ''}`} data-test={`grid-item-${item.kind}`} onContextMenu={(e) => openItemMenu(e, item)}>
      <div className={s.coverContainer}>
        {path ? (
          <Link to={path} className={s.coverLink} data-test="cell-cover" aria-label={title} role="group" onClick={onOpen} draggable={false}>
            {cover}
          </Link>
        ) : (
          <a className={s.coverLink} data-test="cell-cover" aria-label={title} role="group" onClick={play}>
            {cover}
          </a>
        )}
      </div>
      {path ? (
        <Link to={path} className={s.header} data-test="grid-item-detail-text-title-link" aria-label={title} title={title} onClick={onOpen}>
          <span className={s.titleContainer}>
            <span className={`${s.title} ellipsis`}>{title}</span>
            {isExplicit(item) && <ExplicitBadge />}
          </span>
        </Link>
      ) : (
        <a className={s.header} data-test="grid-item-detail-text-title-link" aria-label={title} title={title} onClick={play}>
          <span className={s.titleContainer}>
            <span className={`${s.title} ellipsis`}>{title}</span>
            {isExplicit(item) && <ExplicitBadge />}
          </span>
        </a>
      )}
      <span className={s.description}>{!round && <ItemArtists item={item} onNavigate={onOpen} />}</span>
      {meta && (
        <div className={s.meta}>
          <span className={s.metaText} data-test={meta.testId}>
            {meta.text}
          </span>
        </div>
      )}
    </article>
  );
}
