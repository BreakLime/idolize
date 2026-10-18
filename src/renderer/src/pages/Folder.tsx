// /folder/:id
import { useParams } from 'react-router';
import { FolderView } from '@/components/detail/FolderView';

export default function Folder() {
  const { id = '' } = useParams();
  return <FolderView key={id} id={id} />;
}
