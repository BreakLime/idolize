// Every TIDAL endpoint the UI uses. Requests run in the main process (tokens never reach the renderer).
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ApiHost, ApiRequest } from '@shared/ipc';
import { idol } from '@/lib/bridge';
import { toAlbum, toArtist, toMediaItem, toMix, toPlaylist, toTrack, toVideo, type MediaItem, type Playlist, type Track, type Video } from './models';

export const session = { userId: 0, countryCode: 'US', locale: 'en_US' };

const common = () => ({ countryCode: session.countryCode, locale: session.locale, deviceType: 'DESKTOP' });
const timeOffset = () => {
  const m = -new Date().getTimezoneOffset();
  return `${m >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(m) / 60)).padStart(2, '0')}:${String(Math.abs(m) % 60).padStart(2, '0')}`;
};

export function api<T = any>(host: ApiHost, path: string, query: ApiRequest['query'] = {}, init: Partial<ApiRequest> = {}): Promise<T> {
  return idol.api.request<T>({ host, path, query: { ...common(), ...query }, ...init });
}

export interface Paged<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

const paged = <T>(r: any, map: (x: any) => T): Paged<T> => ({
  items: (r.items ?? []).map(map),
  total: r.totalNumberOfItems ?? r.items?.length ?? 0,
  offset: r.offset ?? 0,
  limit: r.limit ?? 0,
});

/** Fetches all pages of a v1 offset-paged list (playlists/albums can exceed one page). */
/**
 * Every page of a paged list. After the first page the rest load 4 at a time (a 985-track playlist is 10 pages);
 * `onFirstPage` lets a page render the first rows while the others are still coming.
 */
export async function fetchAll<T>(
  fetchPage: (offset: number, limit: number) => Promise<Paged<T>>,
  limit = 100,
  max = 10_000,
  onFirstPage?: (items: T[]) => void,
): Promise<T[]> {
  const first = await fetchPage(0, limit);
  const offsets: number[] = [];
  for (let off = limit; off < Math.min(first.total, max); off += limit) offsets.push(off);
  if (offsets.length) onFirstPage?.(first.items);
  const pages: T[][] = new Array(offsets.length);
  let next = 0;
  const worker = async () => {
    while (next < offsets.length) {
      const k = next++;
      pages[k] = (await fetchPage(offsets[k], limit)).items;
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, offsets.length) }, worker));
  return [...first.items, ...pages.flat()];
}

// ── v2 module payloads (home, artist, view-all) ─────────────────────────────

export interface FeedModule {
  type: string; // SHORTCUT_LIST | HORIZONTAL_LIST | HORIZONTAL_LIST_WITH_CONTEXT | COMPACT_GRID_CARD | TRACK_LIST | ...
  moduleId: string;
  title: string;
  subtitle?: string;
  viewAll?: string;
  items: MediaItem[];
  raw: any;
}

export const toFeedModule = (m: any): FeedModule => ({
  type: m.type,
  moduleId: m.moduleId,
  title: m.title,
  subtitle: m.subtitle,
  viewAll: m.viewAll,
  items: (m.items ?? []).map((i: any) => toMediaItem(i.type, i.data)).filter(Boolean) as MediaItem[],
  raw: m,
});

export const home = {
  async feed(vibe = 'STATIC') {
    const r = await api('v2', `home/feed/${vibe.toLowerCase()}`, { platform: 'DESKTOP', timeOffset: timeOffset() });
    return {
      vibes: (r.header?.vibes?.items ?? []) as { name: string; type: string }[],
      modules: (r.items ?? []).map(toFeedModule) as FeedModule[],
    };
  },
  async viewAll(moduleId: string, itemId?: string) {
    // since 2026-10-18 the endpoint answers 400 (subStatus 1002) without timeOffset, like the feed itself
    const r = await api('v2', `home/pages/${moduleId}/view-all`, { platform: 'DESKTOP', timeOffset: timeOffset(), itemId });
    return {
      title: r.title as string,
      subtitle: r.subtitle as string | undefined,
      layout: r.itemLayout as string,
      items: (r.items ?? []).map((i: any) => toMediaItem(i.type, i.data)).filter(Boolean) as MediaItem[],
    };
  },
};

// ── v1 "pages" (album, mix, explore, genre …) ───────────────────────────────

export interface PageModule {
  type: string;
  title: string;
  raw: any;
}
export interface Page {
  id: string;
  title: string;
  modules: PageModule[];
}

export async function page(path: string, query: ApiRequest['query'] = {}): Promise<Page> {
  const r = await api('v1', path.startsWith('pages/') ? path : `pages/${path}`, query);
  return {
    id: r.id,
    title: r.title,
    modules: (r.rows ?? []).flatMap((row: any) => row.modules.map((m: any) => ({ type: m.type, title: m.title ?? '', raw: m }))),
  };
}

/** Items of a v1 page module (`pagedList.items` / `items`), normalized by module type. */
export function pageModuleItems(m: PageModule): MediaItem[] {
  const list = m.raw.pagedList?.items ?? m.raw.items ?? [];
  const map: Record<string, (x: any) => MediaItem | null> = {
    ALBUM_LIST: toAlbum,
    ARTIST_LIST: toArtist,
    PLAYLIST_LIST: toPlaylist,
    MIX_LIST: toMix,
    VIDEO_LIST: toVideo,
    TRACK_LIST: toTrack,
    ALBUM_ITEMS: (x) => (x.type === 'video' ? toVideo(x.item) : toTrack(x.item)),
  };
  const f = map[m.type];
  return f ? (list.map(f).filter(Boolean) as MediaItem[]) : [];
}

// ── entities ────────────────────────────────────────────────────────────────

export const albums = {
  get: async (id: number | string) => toAlbum(await api('v1', `albums/${id}`)),
  page: (id: number | string) => page('album', { albumId: id }),
  tracks: (id: number | string) =>
    fetchAll((offset, limit) => api('v1', `albums/${id}/items`, { offset, limit }).then((r) => paged(r, (x: any) => (x.type === 'video' ? toVideo(x.item) : toTrack(x.item))))),
  credits: (id: number | string) => api('v1', `albums/${id}/items/credits`, { limit: 100, includeContributors: true }),
  review: (id: number | string) => api('v1', `albums/${id}/review`).catch(() => null),
};

export const artists = {
  get: async (id: number | string) => toArtist(await api('v1', `artists/${id}`)),
  page: async (id: number | string) => {
    const r = await api('v2', `artist/${id}`, { platform: 'DESKTOP' });
    return { header: r.header, item: r.item, modules: (r.items ?? []).map(toFeedModule) as FeedModule[] };
  },
  bio: (id: number | string) => api<{ text: string; summary: string; source: string }>('v1', `artists/${id}/bio`).catch(() => null),
  topTracks: (id: number | string, limit = 50) => api('v1', `artists/${id}/toptracks`, { limit }).then((r) => paged(r, toTrack)),
  albums: (id: number | string, filter?: 'EPSANDSINGLES' | 'COMPILATIONS') => api('v1', `artists/${id}/albums`, { limit: 50, filter }).then((r) => paged(r, toAlbum)),
  radio: (id: number | string) => api('v1', `artists/${id}/radio`, { limit: 100 }).then((r) => paged(r, toTrack)),
};

export const tracks = {
  get: async (id: number | string) => toTrack(await api('v1', `tracks/${id}`)),
  credits: (id: number | string) => api<{ type: string; contributors: { name: string; id?: number }[] }[]>('v1', `tracks/${id}/credits`, { includeContributors: true }),
  /** fetched for on-screen display only; never persisted */
  lyrics: (id: number | string) => api<{ lyrics?: string; subtitles?: string; lyricsProvider?: string }>('v1', `tracks/${id}/lyrics`).catch(() => null),
  radio: (id: number | string) => api('v1', `tracks/${id}/radio`, { limit: 100 }).then((r) => paged(r, toTrack)),
};

export const playlists = {
  get: async (uuid: string) => toPlaylist(await api('v1', `playlists/${uuid}`)),
  items: (uuid: string, onFirstPage?: (items: (Track | Video)[]) => void) =>
    fetchAll(
      (offset, limit) =>
        api('v1', `playlists/${uuid}/items`, { offset, limit }).then((r) =>
          paged(r, (x: any) => {
            const t = x.type === 'video' ? toVideo(x.item) : toTrack(x.item);
            if (t.kind === 'track') Object.assign(t, { dateAdded: x.dateAdded ?? x.item?.dateAdded, itemUuid: x.item?.itemUuid ?? x.uuid });
            return t;
          }),
        ),
      100,
      10_000,
      onFirstPage,
    ),
  recommendations: (uuid: string) => api('v1', `playlists/${uuid}/recommendations/items`, { limit: 50 }).then((r) => paged(r, (x: any) => toTrack(x.item))),
};

export const mixes = {
  page: (id: string) => page('mix', { mixId: id }),
  tracks: (id: string) => api('v1', `mixes/${id}/items`, { limit: 100 }).then((r) => paged(r, (x: any) => (x.type === 'video' ? toVideo(x.item) : toTrack(x.item)))),
};

// ── search ──────────────────────────────────────────────────────────────────

export interface SearchResult {
  topHits: MediaItem[];
  artists: Paged<MediaItem>;
  albums: Paged<MediaItem>;
  tracks: Paged<MediaItem>;
  playlists: Paged<MediaItem>;
  videos: Paged<MediaItem>;
  uploads: Paged<MediaItem>;
  /** non-empty result types in relevance order (drives the search pills), e.g. ["TRACKS","ARTISTS"] */
  filters: string[];
}

export async function search(query: string, limit = 50): Promise<SearchResult> {
  const r = await api('v2', 'search/', {
    query,
    limit,
    types: 'ARTISTS,ALBUMS,TRACKS,VIDEOS,PLAYLISTS,UPLOADS',
    includeContributors: true,
    includeDidYouMean: true,
    includeUserPlaylists: true,
    supportsUserData: true,
  });
  const p = (key: string, type: string) => paged<MediaItem>(r[key] ?? {}, (x) => toMediaItem(type, x)!);
  return {
    topHits: (r.topHits ?? []).map((h: any) => toMediaItem(h.type, h.value)).filter(Boolean),
    artists: p('artists', 'ARTISTS'),
    albums: p('albums', 'ALBUMS'),
    tracks: p('tracks', 'TRACKS'),
    playlists: p('playlists', 'PLAYLISTS'),
    videos: p('videos', 'VIDEOS'),
    uploads: p('uploads', 'UPLOADS'),
    filters: r.contentTypeFilters ?? [],
  };
}

// ── user & collection ───────────────────────────────────────────────────────

export interface FavoriteIds {
  TRACK: string[];
  ALBUM: string[];
  ARTIST: string[];
  PLAYLIST: string[];
  VIDEO: string[];
}

export type CollectionOrder = 'DATE' | 'DATE_UPDATED' | 'NAME' | 'ARTIST' | 'ALBUM' | 'LENGTH' | 'RELEASE_DATE';

const favList =
  <T extends object>(kind: string, map: (x: any) => T) =>
  (order: CollectionOrder = 'DATE', direction: 'ASC' | 'DESC' = 'DESC') =>
    fetchAll((offset, limit) =>
      api('v1', `users/${session.userId}/favorites/${kind}`, { offset, limit, order, orderDirection: direction }).then((r) =>
        paged(r, (x: any) => Object.assign(map(x.item), { dateAdded: x.created })),
      ),
    );

export const user = {
  profile: () => api('v1', `users/${session.userId}`),
  me: () => api('login', 'oauth2/me'),
  subscription: () => api('v1', `users/${session.userId}/subscription`),
  favoriteIds: () => api<FavoriteIds>('v1', `users/${session.userId}/favorites/ids`),
  favoriteMixIds: () => api<{ content: string[] }>('v2', 'favorites/mixes/ids', { limit: 500 }).catch(() => ({ content: [] as string[] })),
  favoriteTracks: favList('tracks', toTrack),
  favoriteAlbums: favList('albums', toAlbum),
  favoriteArtists: favList('artists', toArtist),
  favoriteVideos: favList('videos', toVideo),
  favoriteMixes: async () => {
    const out = [];
    let cursor: string | undefined;
    do {
      const r = await api('v2', 'favorites/mixes', { limit: 50, cursor });
      out.push(...(r.items ?? []).map(toMix));
      cursor = r.cursor || undefined;
    } while (cursor && out.length < 1000);
    return out;
  },
  /** playlists + folders tree for one folder ("root" for the top level); `includeOnly` USER_PLAYLIST / FAVORITE_PLAYLIST filters */
  folder: async (folderId = 'root', order: CollectionOrder = 'DATE', direction: 'ASC' | 'DESC' = 'DESC', includeOnly = '') => {
    const items = await cursorItems('my-collection/playlists/folders', { folderId, includeOnly, order, orderDirection: direction });
    return items.map((x: any): MediaItem | null =>
      x.itemType === 'FOLDER'
        ? { kind: 'folder', id: x.data?.id ?? x.trn.split(':').pop(), name: x.name, numberOfItems: x.data?.totalNumberOfItems ?? 0, lastModifiedAt: x.lastModifiedAt }
        : x.data
          ? toPlaylist(x.data)
          : null,
    ).filter(Boolean) as MediaItem[];
  },
  /** the user's own playlists across all folders (targets for "Add to playlist") */
  ownPlaylists: async (): Promise<Playlist[]> => {
    const items = await cursorItems('my-collection/playlists/folders/flattened', { includeOnly: 'PLAYLIST', order: 'DATE', orderDirection: 'DESC' });
    return items.filter((x: any) => x.data).map((x: any) => toPlaylist(x.data));
  },
};

/** v2 my-collection lists are cursor-paged (50 per page); follow the cursor so large libraries are complete. */
async function cursorItems(path: string, query: ApiRequest['query'], maxPages = 40): Promise<any[]> {
  const out: any[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const r = await api('v2', path, { ...query, limit: 50, ...(cursor ? { cursor } : { offset: 0 }) });
    out.push(...(r.items ?? []));
    cursor = r.cursor || undefined;
    if (!cursor || !(r.items ?? []).length) break;
  }
  return out;
}

// ── writes (favorites, playlists) ───────────────────────────────────────────

type FavKind = 'tracks' | 'albums' | 'artists' | 'playlists' | 'videos';
const idField: Record<FavKind, string> = { tracks: 'trackIds', albums: 'albumIds', artists: 'artistIds', playlists: 'uuids', videos: 'videoIds' };

export const favorites = {
  add: (kind: FavKind, id: string | number) =>
    api('v1', `users/${session.userId}/favorites/${kind}`, {}, { method: 'POST', body: { [idField[kind]]: String(id), onArtifactNotFound: 'FAIL' }, form: true }),
  remove: (kind: FavKind, id: string | number) => api('v1', `users/${session.userId}/favorites/${kind}/${id}`, {}, { method: 'DELETE' }),
  addMix: (id: string) => api('v2', 'favorites/mixes/add', {}, { method: 'PUT', body: { mixIds: id, onArtifactNotFound: 'FAIL' }, form: true }),
  removeMix: (id: string) => api('v2', 'favorites/mixes/remove', {}, { method: 'PUT', body: { mixIds: id }, form: true }),
};

export const playlistEdit = {
  create: (title: string, description = '', folderId = 'root') =>
    api('v2', 'my-collection/playlists/folders/create-playlist', { name: title, description, folderId, isPublic: false }, { method: 'PUT' }),
  createFolder: (name: string, parentId = 'root') => api('v2', 'my-collection/playlists/folders/create-folder', { name, folderId: parentId }, { method: 'PUT' }),
  remove: (uuid: string) => api('v2', 'my-collection/playlists/folders/remove', { trns: `trn:playlist:${uuid}` }, { method: 'PUT' }),
  removeFolder: (id: string) => api('v2', 'my-collection/playlists/folders/remove', { trns: `trn:folder:${id}` }, { method: 'PUT' }),
  async addTracks(uuid: string, trackIds: (number | string)[]) {
    const etag = await playlistEtag(uuid);
    return api('v1', `playlists/${uuid}/items`, {}, { method: 'POST', body: { trackIds: trackIds.join(','), onDupes: 'SKIP', onArtifactNotFound: 'FAIL' }, form: true, headers: { 'If-None-Match': etag } });
  },
  async removeIndex(uuid: string, index: number) {
    const etag = await playlistEtag(uuid);
    return api('v1', `playlists/${uuid}/items/${index}`, {}, { method: 'DELETE', headers: { 'If-None-Match': etag } });
  },
};

/** v1 playlist edits need the current ETag; our bridge returns JSON only, so the playlist's lastUpdated stands in. */
async function playlistEtag(uuid: string): Promise<string> {
  const p = await api('v1', `playlists/${uuid}`);
  return `"${new Date(p.lastUpdated).getTime()}"`;
}

export type { Track };
