// The <table> track list TIDAL uses on artist pages (Top Tracks, Credits card, Top Tracks view-all):
// 42px cover with hover play, title + badges, artist, album, time, "… + ♡" buttons.
import { memo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { coverUrl } from '@/api/images';
import { formatDuration, type Track, type Video } from '@/api/models';
import { ExplicitBadge } from '@/components/Badges';
import { Icon } from '@/components/Icon';
import { addToPlaylistMenu, trackMenu } from '@/components/menus';
import { useContentAllowed } from '@/lib/content';
import { toggleFavorite, useIsFavorite } from '@/state/favorites';
import { currentTrack, player, usePlayer, type PlaySource } from '@/state/player';
import s from './ArtistTrackTable.module.css';

type Row = Track | Video;

/** extra columns inserted after the title (e.g. "Role" / "Year" on the credits page) */
export interface ExtraColumn {
  head: string;
  cell: (t: Row, i: number) => ReactNode;
  className?: string;
}

const Row = memo(function Row({ t, i, active, playing, onPlay, extra }: { t: Row; i: number; active: boolean; playing: boolean; onPlay: (i: number) => void; extra?: ExtraColumn[] }) {
  const fav = useIsFavorite(t);
  const cover = t.kind === 'track' ? coverUrl(t.album.cover, 42) : undefined;
  const allowed = useContentAllowed();
  const unavailable = (t.kind === 'track' && !t.streamable) || !allowed(t);
  const play = () => (active ? player.toggle() : !unavailable && onPlay(i));
  return (
    <tr
      className={`${s.row} ${active ? s.active : ''} ${unavailable ? s.unavailable : ''}`}
      data-test="tracklist-row--selected-false"
      data-track-id={t.id}
      onDoubleClick={() => !unavailable && onPlay(i)}
      onContextMenu={(e) => {
        e.preventDefault();
        void trackMenu({ clientX: e.clientX, clientY: e.clientY }, t);
      }}
    >
      <td className={s.imageCol}>
        <button type="button" className={s.image} data-test={`image-container-track-${t.id}`} aria-label={active && playing ? 'Pause' : 'Play'} onClick={play}>
          {cover ? <img src={cover} alt="" draggable={false} /> : <span className={s.noImage} />}
          <span className={s.iconWrap}>
            <Icon name={active && playing ? 'pause' : 'play'} size={20} className={s.playIcon} testId={`play-button-${t.title}`} />
          </span>
        </button>
      </td>
      <td className={s.titleCol}>
        <div className={s.textAndBadges}>
          <span className={`${s.title} ellipsis`}>{t.title}</span>
          {t.explicit && <ExplicitBadge />}
        </div>
        <div className={s.titleArtist}>
          <span>{t.artists.map((a) => a.name).join(', ')}</span>
        </div>
      </td>
      {extra?.map((c) => (
        <td key={c.head} className={c.className ?? s.extraCol}>
          {c.cell(t, i)}
        </td>
      ))}
      <td className={s.artistCol}>
        <span className={`${s.cellText} ellipsis`}>
          {t.artists.map((a, k) => (
            <span key={`${a.id}-${k}`}>
              {k > 0 && ', '}
              <Link to={`/artist/${a.id}`} className="link" data-test="grid-item-detail-text-title-artist" aria-label={a.name} title={a.name}>
                {a.name}
              </Link>
            </span>
          ))}
        </span>
      </td>
      <td className={s.albumCol}>
        {t.kind === 'track' && (
          <span className={`${s.cellText} ellipsis`}>
            <Link to={`/album/${t.album.id}`} className="link" data-test="table-cell-album" aria-label={t.album.title} title={t.album.title}>
              {t.album.title}
            </Link>
          </span>
        )}
      </td>
      <td className={s.timeCol}>{formatDuration(t.duration)}</td>
      <td className={s.buttonCol}>
        <button
          type="button"
          className={`${s.btn} ${s.context}`}
          data-test={`tracklist-id-${t.id}-context-menu-button`}
          aria-label="Show options"
          title="Show options"
          onClick={(e) => {
            e.stopPropagation();
            void trackMenu(e.currentTarget, t);
          }}
        >
          <Icon name="more" size={24} />
        </button>
        <button
          type="button"
          className={`${s.btn} ${s.add}`}
          data-test="tracklist-add-to-playlist"
          aria-label="Add to playlist"
          title="Add to playlist"
          onClick={(e) => {
            e.stopPropagation();
            void addToPlaylistMenu(e.currentTarget, [t.id]);
          }}
        >
          <Icon name="plus" size={24} />
        </button>
        <button
          type="button"
          className={`${s.btn} ${fav ? s.favOn : ''}`}
          data-test={`tracklist-save-item-${t.id}`}
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
      </td>
    </tr>
  );
});

export function ArtistTrackTable({ items, source, testId, extra }: { items: Row[]; source: PlaySource | null; testId?: string; extra?: ExtraColumn[] }) {
  const cur = usePlayer(currentTrack);
  const playing = usePlayer((st) => st.playing);
  const curSource = usePlayer((st) => st.source);
  const sameSource = !source || (curSource?.type === source.type && curSource.id === source.id);
  const onPlay = (i: number) => player.playList(items, i, source);
  return (
    <table className={s.table} data-test={testId}>
      <thead>
        <tr>
          <th />
          <th>
            <span className={s.head}>Title</span>
          </th>
          {extra?.map((c) => (
            <th key={c.head}>
              <span className={s.head}>{c.head}</span>
            </th>
          ))}
          <th>
            <span className={s.head}>Artist</span>
          </th>
          <th className={s.albumHead}>
            <span className={s.head}>Album</span>
          </th>
          <th className={s.timeHead}>
            <span className={s.head}>Time</span>
          </th>
          <th />
        </tr>
      </thead>
      <tbody>
        {items.map((t, i) => (
          <Row key={`${t.kind}-${t.id}-${i}`} t={t} i={i} active={!!cur && sameSource && cur.id === t.id} playing={playing} onPlay={onPlay} extra={extra} />
        ))}
      </tbody>
    </table>
  );
}
