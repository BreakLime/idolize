// /my-collection and /my-collection/:tab — mixes, playlists, albums, tracks, videos, artists, purchases, save-for-later.
import { Navigate, useParams } from 'react-router';
import { CollectionIndex, GridTab, PurchasesTab, SaveForLaterTab, TracksTab } from '@/components/collection/Tabs';

export default function Collection() {
  const { tab } = useParams();
  switch (tab) {
    case undefined:
      return <CollectionIndex />;
    case 'tracks':
      return <TracksTab />;
    case 'albums':
    case 'artists':
    case 'playlists':
    case 'mixes':
    case 'videos':
      return <GridTab key={tab} kind={tab} />;
    case 'purchases':
      return <PurchasesTab />;
    case 'save-for-later':
      return <SaveForLaterTab />;
    default:
      return <Navigate to="/my-collection" replace />;
  }
}
