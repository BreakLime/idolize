// "View all" for a home module: /home/pages/:moduleId/view-all[?itemId=…&rankingToken=…] → card grid or track list.
import { useParams, useSearchParams } from 'react-router';
import { itemKey, type MediaItem, type Track, type Video } from '@/api/models';
import { MediaCard } from '@/components/MediaCard';
import { MediaTable } from '@/components/MediaTable';
import { viewAll } from '@/components/home/api';
import { MagazineCard } from '@/components/home/HomeModules';
import h from '@/components/home/Home.module.css';
import s from '@/components/home/ViewAll.module.css';
import { useQuery } from '@/lib/query';

const isTrack = (i: MediaItem): i is Track | Video => i.kind === 'track' || i.kind === 'video';

const cellClass = (i: MediaItem) => (i.kind === 'mix' ? s.mixCell : i.kind === 'artist' ? s.artistCell : i.kind === 'video' ? s.videoCell : '');

export default function ViewAll() {
  const { moduleId = '' } = useParams();
  const [params] = useSearchParams();
  // the module's view-all link may carry itemId, rankingToken … — forward them all
  const search = params.toString();
  const q = useQuery(`home:view-all:${moduleId}:${search}`, () => viewAll(moduleId, Object.fromEntries(params)));
  const d = q.data;
  const tracks = !!d && d.items.length > 0 && d.items.every(isTrack);

  return (
    <div className={h.bleed}>
      <div className={s.page} data-test={tracks ? 'view-all--track-list' : 'view-all-page'}>
        {d ? (
          <>
            <div className={s.heading}>
              <h2 className={s.title}>{d.title}</h2>
              {d.subtitle && <p className={s.subtitle}>{d.subtitle}</p>}
            </div>
            {tracks ? (
              <MediaTable
                items={d.items as (Track | Video)[]}
                columns={['cover', 'title', 'artist', 'album', 'time']}
                source={{ type: 'home', id: `${moduleId}${search ? `?${search}` : ''}`, title: d.title, path: `/home/pages/${moduleId}/view-all${search ? `?${search}` : ''}` }}
              />
            ) : d.magazines.length ? (
              <section className={s.grid} data-test="grid" role="grid">
                {d.magazines.map((m) => (
                  <div key={m.id} className={`${s.cell} ${s.magazineCell}`} role="row">
                    <MagazineCard m={m} />
                  </div>
                ))}
                <div className={s.endRow} aria-hidden="true" />
              </section>
            ) : d.items.length ? (
              <section className={s.grid} data-test="grid" role="grid">
                {d.items.map((it) => (
                  <div key={itemKey(it)} className={`${s.cell} ${cellClass(it)}`} role="row">
                    <MediaCard item={it} />
                  </div>
                ))}
                <div className={s.endRow} aria-hidden="true" />
              </section>
            ) : (
              <div className={h.empty}>
                <span className={h.emptyTitle}>Nothing here yet</span>
              </div>
            )}
          </>
        ) : q.error ? (
          <div className={h.empty} data-test="view-all-error">
            <span className={h.emptyTitle}>Couldn’t load this page</span>
            <button type="button" className={h.retry} onClick={() => void q.refetch().catch(() => {})}>
              Try again
            </button>
          </div>
        ) : (
          <div className={s.heading} aria-hidden="true">
            <div className={`${h.skeleton} ${s.titleSkeleton}`} />
          </div>
        )}
      </div>
    </div>
  );
}
