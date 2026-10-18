// /album/:albumId/track/:id renders the track's album page (like TIDAL); /track/:id resolves the album first.
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { tracks } from '@/api/tidal';
import { AlbumView } from '@/components/detail/AlbumView';
import { DetailError, DetailLoading } from '@/components/detail/DetailStates';
import { useQuery } from '@/lib/query';

export default function Track() {
  const { albumId, id = '' } = useParams();
  const nav = useNavigate();
  const q = useQuery(albumId ? null : `track:${id}`, () => tracks.get(id));
  useEffect(() => {
    if (!albumId && q.data) nav(`/album/${q.data.album.id}/track/${id}`, { replace: true });
  }, [albumId, q.data, id, nav]);
  if (albumId) return <AlbumView key={albumId} albumId={albumId} />;
  if (q.error) return <DetailError error={q.error} onRetry={() => void q.refetch()} />;
  return <DetailLoading />;
}
