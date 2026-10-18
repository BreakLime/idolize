// "Play this thing" helpers shared by cards, headers and shortcuts.
import type { Album, Artist, MediaItem, Mix, Playlist, Track, Video } from '@/api/models';
import { albums, artists, mixes, playlists } from '@/api/tidal';
import { player, usePlayer, type PlaySource } from '@/state/player';

export function sourceOf(item: MediaItem): PlaySource | null {
  switch (item.kind) {
    case 'album':
      return { type: 'album', id: String(item.id), title: item.title, path: `/album/${item.id}` };
    case 'playlist':
      return { type: 'playlist', id: item.uuid, title: item.title, path: `/playlist/${item.uuid}` };
    case 'mix':
      return { type: 'mix', id: item.id, title: item.title, path: `/mix/${item.id}` };
    case 'artist':
      return { type: 'artist', id: String(item.id), title: item.name, path: `/artist/${item.id}` };
    default:
      return null;
  }
}

export async function tracksOf(item: MediaItem): Promise<(Track | Video)[]> {
  switch (item.kind) {
    case 'album':
      return albums.tracks((item as Album).id);
    case 'playlist':
      return playlists.items((item as Playlist).uuid);
    case 'mix':
      return (await mixes.tracks((item as Mix).id)).items;
    case 'artist':
      return (await artists.topTracks((item as Artist).id)).items;
    case 'track':
    case 'video':
      return [item];
    default:
      return [];
  }
}

/** Is this collection the current play source? (cards show pause instead of play) */
export function useIsPlayingSource(item: MediaItem): boolean {
  return usePlayer((s) => {
    const src = sourceOf(item);
    return !!src && s.playing && s.source?.type === src.type && s.source.id === src.id;
  });
}

export async function playItem(item: MediaItem, opts: { shuffle?: boolean } = {}) {
  const src = sourceOf(item);
  const s = usePlayer.getState();
  if (src && s.source?.type === src.type && s.source.id === src.id && !opts.shuffle) return player.toggle();
  const list = await tracksOf(item);
  // deliberate (TIDAL): "Play" plays in order and turns shuffle off; the separate "Shuffle" button shuffles
  player.playList(list, 0, src, { shuffle: opts.shuffle ?? false });
}
