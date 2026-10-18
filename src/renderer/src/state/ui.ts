import { create } from 'zustand';

export const useUi = create<{
  queueOpen: boolean;
  nowPlayingOpen: boolean;
  nowPlayingTab: 'lyrics' | 'credits' | 'related' | 'playing';
  /** Now Playing's artist card: the artist whose name was clicked, null while hidden */
  artistCardId: number | null;
  toast: { text: string; id: number } | null;
}>(() => ({ queueOpen: false, nowPlayingOpen: false, nowPlayingTab: 'playing', artistCardId: null, toast: null }));

export const toggleArtistCard = (id: number) => useUi.setState((st) => ({ artistCardId: st.artistCardId === id ? null : id }));

export function toast(text: string) {
  const id = Date.now();
  useUi.setState({ toast: { text, id } });
  setTimeout(() => useUi.getState().toast?.id === id && useUi.setState({ toast: null }), 3000);
}
