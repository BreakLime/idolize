// /artist/:moduleId/view-all?artistId= — "View all" for an artist module: track table or card grid.
import { useParams, useSearchParams } from 'react-router';
import { itemKey, type MediaItem, type Track, type Video } from '@/api/models';
import { useQuery } from '@/lib/query';
import { MediaCard } from '@/components/MediaCard';
import { ArtistTrackTable } from './ArtistTrackTable';
import { artistViewAll } from './artistApi';
import { albumYearType } from './format';
import { LoadError } from './LoadError';
import s from './ArtistPage.module.css';

function cellClass(item: MediaItem) {
  if (item.kind === 'video') return s.cellVideo;
  if (item.kind === 'artist') return s.cellArtist;
  return s.cell;
}

export default function ArtistViewAll() {
  const { moduleId = '' } = useParams();
  const [params] = useSearchParams();
  const artistId = params.get('artistId') ?? '';
  const { data, error, refetch } = useQuery(moduleId && artistId ? `artist:${artistId}:view-all:${moduleId}` : null, () => artistViewAll(moduleId, artistId));

  if (error && !data) return <LoadError error={error} onRetry={() => void refetch()} />;
  const tracks = data?.items.filter((i): i is Track | Video => i.kind === 'track' || i.kind === 'video') ?? [];
  const isTracks = !!data && data.layout !== 'GRID';

  return (
    <div className={s.page}>
      <div className={s.viewAll} data-test={isTracks ? undefined : 'view-all-page'}>
        <h2 className={s.viewAllTitle}>{data?.title ?? ''}</h2>
        {data &&
          (isTracks ? (
            <div data-test="view-all--track-list">
              <ArtistTrackTable items={tracks} source={{ type: 'artist', id: `${artistId}-${moduleId}`, title: data.title, path: `/artist/${moduleId}/view-all?artistId=${artistId}` }} />
            </div>
          ) : data.items.length ? (
            <section className={s.grid} data-test="grid" role="grid">
              {data.items.map((it) => (
                <div key={itemKey(it)} className={cellClass(it)} role="row">
                  {it.kind === 'album' ? <MediaCard item={it} subtitle={<span>{albumYearType(it)}</span>} /> : <MediaCard item={it} />}
                </div>
              ))}
            </section>
          ) : (
            <p className={s.empty}>Nothing here yet.</p>
          ))}
      </div>
    </div>
  );
}
