// /playlist/:id
import { useParams } from 'react-router';
import { PlaylistView } from '@/components/detail/PlaylistView';

export default function Playlist() {
  const { id = '' } = useParams();
  return <PlaylistView key={id} uuid={id} />;
}
