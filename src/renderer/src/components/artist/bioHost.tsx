// Opens the artist biography dialog from anywhere (artist card menus); <ArtistBioHost/> lives in the app layout.
import { create } from 'zustand';
import { BioDialog } from './BioDialog';

interface BioTarget {
  id: number | string;
  name: string;
  picture: string | null;
}

const useBio = create<{ artist: BioTarget | null }>(() => ({ artist: null }));

export const openArtistBio = (artist: BioTarget) => useBio.setState({ artist });

export function ArtistBioHost() {
  const a = useBio((st) => st.artist);
  if (!a) return null;
  return <BioDialog artistId={String(a.id)} name={a.name} picture={a.picture} fallback={null} onClose={() => useBio.setState({ artist: null })} />;
}
