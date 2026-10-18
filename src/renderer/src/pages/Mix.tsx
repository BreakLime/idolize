// /mix/:id
import { useParams } from 'react-router';
import { MixView } from '@/components/detail/MixView';

export default function Mix() {
  const { id = '' } = useParams();
  return <MixView key={id} id={id} />;
}
