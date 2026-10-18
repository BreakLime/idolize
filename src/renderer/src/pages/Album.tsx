// /album/:id and /album/:id/credits
import { useLocation, useParams } from 'react-router';
import { AlbumView } from '@/components/detail/AlbumView';

export default function Album() {
  const { id = '' } = useParams();
  const credits = useLocation().pathname.endsWith('/credits');
  return <AlbumView key={id} albumId={id} credits={credits} />;
}
