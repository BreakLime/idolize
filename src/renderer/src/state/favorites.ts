// Favorite ids (hearts everywhere) with optimistic toggles.
import { create } from 'zustand';
import { favorites, user } from '@/api/tidal';
import type { MediaItem } from '@/api/models';
import { invalidate } from '@/lib/query';

type Kind = 'track' | 'album' | 'artist' | 'playlist' | 'video' | 'mix';
type Sets = Record<Kind, Set<string>>;

const empty = (): Sets => ({ track: new Set(), album: new Set(), artist: new Set(), playlist: new Set(), video: new Set(), mix: new Set() });
export const useFavorites = create<{ ids: Sets; loaded: boolean }>(() => ({ ids: empty(), loaded: false }));

export async function loadFavorites() {
  const [ids, mixIds] = await Promise.all([user.favoriteIds(), user.favoriteMixIds()]);
  useFavorites.setState({
    loaded: true,
    ids: {
      track: new Set(ids.TRACK.map(String)),
      album: new Set(ids.ALBUM.map(String)),
      artist: new Set(ids.ARTIST.map(String)),
      playlist: new Set(ids.PLAYLIST.map(String)),
      video: new Set(ids.VIDEO.map(String)),
      mix: new Set((mixIds.content ?? []).map(String)),
    },
  });
}

const favKey = (i: MediaItem): [Kind, string] | null =>
  i.kind === 'folder' ? null : [i.kind, i.kind === 'playlist' ? i.uuid : String(i.id)];

export const useIsFavorite = (i: MediaItem | null | undefined) =>
  useFavorites((s) => {
    const k = i && favKey(i);
    return !!k && s.ids[k[0]].has(k[1]);
  });

const apiKind = { track: 'tracks', album: 'albums', artist: 'artists', playlist: 'playlists', video: 'videos' } as const;

export async function toggleFavorite(i: MediaItem): Promise<boolean> {
  const k = favKey(i);
  if (!k) return false;
  const [kind, id] = k;
  const was = useFavorites.getState().ids[kind].has(id);
  const mutate = (add: boolean) =>
    useFavorites.setState((s) => {
      const next = new Set(s.ids[kind]);
      if (add) next.add(id);
      else next.delete(id);
      return { ids: { ...s.ids, [kind]: next } };
    });
  mutate(!was);
  try {
    if (kind === 'mix') await (was ? favorites.removeMix(id) : favorites.addMix(id));
    else await (was ? favorites.remove(apiKind[kind], id) : favorites.add(apiKind[kind], id));
    invalidate(`collection:${kind}`);
    if (kind === 'playlist') invalidate('sidebar:');
    return !was;
  } catch (e) {
    mutate(was);
    throw e;
  }
}
