// /album/:id/credits — "Credits" tab with one card per track (sticky header + role/name cells).
import { Link } from 'react-router';
import { artistNames, toTrack, trackTitle, type Album, type Track } from '@/api/models';
import { albums } from '@/api/tidal';
import { useQuery } from '@/lib/query';
import { currentTrack, player, usePlayer } from '@/state/player';
import { Icon } from '../Icon';
import { trackMenu } from '../menus';
import s from './AlbumCredits.module.css';

interface Credit {
  type: string;
  contributors: { name: string; id?: number | null }[];
}
interface CreditItem {
  track: Track;
  credits: Credit[];
}

async function loadCredits(id: number): Promise<CreditItem[]> {
  const r = await albums.credits(id);
  return (r?.items ?? [])
    .filter((x: { type?: string }) => x.type !== 'video')
    .map((x: { item: unknown; credits?: Credit[] }) => ({ track: toTrack(x.item), credits: x.credits ?? [] }));
}

function CreditCard({ item, all, album }: { item: CreditItem; all: Track[]; album: Album }) {
  const cur = usePlayer(currentTrack);
  const playing = usePlayer((st) => st.playing);
  const active = cur?.id === item.track.id;
  return (
    <div className={s.card} data-test="album-info-item">
      <div className={s.cardHeader} aria-label="Show credits">
        <div className={s.number}>{item.track.trackNumber}</div>
        <button
          type="button"
          className={s.play}
          aria-label={active && playing ? 'Pause' : 'Play'}
          title={active && playing ? 'Pause' : 'Play'}
          onClick={() =>
            active ? player.toggle() : player.playList(all, all.indexOf(item.track), { type: 'album', id: String(album.id), title: album.title, path: `/album/${album.id}` })
          }
        >
          <Icon name={active && playing ? 'pause' : 'play'} size={18} />
        </button>
        <div className={s.titleBlock}>
          <div className={`${s.trackTitle} ellipsis ${active ? s.activeTitle : ''}`} title={trackTitle(item.track)}>
            {trackTitle(item.track)}
          </div>
          <div className={`${s.trackArtist} ellipsis`}>{artistNames(item.track.artists)}</div>
        </div>
        <button type="button" className={s.options} aria-label="Show options" title="Show options" onClick={(e) => void trackMenu(e.currentTarget, item.track, { albumId: album.id })}>
          <Icon name="more" size={24} />
        </button>
      </div>
      <div className={s.cells}>
        {item.credits.length === 0 && <div className={s.none}>No credits available</div>}
        {item.credits.map((c, i) => (
          <div key={`${c.type}-${i}`} className={`${s.cell} ${i === item.credits.length - 1 ? s.lastCell : ''}`}>
            <span className={s.role}>{c.type}</span>
            <span className={s.names}>
              {c.contributors.map((p, k) => (
                <span key={`${p.name}-${k}`}>
                  {k > 0 && ', '}
                  {p.id ? (
                    <Link to={`/artist/${p.id}`} className="link">
                      {p.name}
                    </Link>
                  ) : (
                    p.name
                  )}
                </span>
              ))}
            </span>
            {i < item.credits.length - 1 && <span className={s.rule} />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AlbumCredits({ album }: { album: Album }) {
  const q = useQuery(`album-credits:${album.id}`, () => loadCredits(album.id));
  const items = q.data ?? [];
  const all = items.map((x) => x.track);
  return (
    <div className={s.module}>
      <ul className={s.tabs} role="tablist">
        <li className={s.tab} role="tab" aria-selected="true" data-test="album-info-tab-credits">
          Credits
        </li>
      </ul>
      <div className={s.content}>
        {q.error && !q.data ? (
          <p className={s.none}>Credits aren&apos;t available for this album.</p>
        ) : (
          <div className={s.grid} data-test="album-info-track-credits">
            {items.map((it) => (
              <CreditCard key={it.track.id} item={it} all={all} album={album} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
