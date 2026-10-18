// My Collection data: favorites (v1), playlists + folders (v2), Save for Later and purchases (openapi v2).
// Query keys start with `collection:<kind>` so toggleFavorite()'s invalidate('collection:<kind>') refreshes them.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Album, Folder, MediaItem, Mix, Playlist, Track, Video } from '@/api/models';
import { toAlbum, toArtist, toMix, toPlaylist, toTrack, toVideo } from '@/api/models';
import { api, session, user } from '@/api/tidal';
import { idol } from '@/lib/bridge';

export const KEYS = {
  tracks: 'collection:track:all',
  albums: 'collection:album:all',
  artists: 'collection:artist:all',
  videos: 'collection:video:all',
  mixes: 'collection:mix:all',
  playlists: 'collection:playlist:root',
  saveForLater: 'collection:save-for-later',
  purchases: (kind: 'albums' | 'tracks') => `collection:purchases:${kind}`,
} as const;

/** A collection entry with the dates the sort menus need. */
export interface Entry<T extends MediaItem = MediaItem> {
  item: T;
  /** when it was added to the collection */
  addedAt?: string;
  /** playlists/folders: last modification */
  updatedAt?: string;
}

// ── favorites (always fetched newest-first; the UI sorts locally) ──────────────

const withDate = <T extends MediaItem>(list: (T & { dateAdded?: string })[]): Entry<T>[] => list.map((item) => ({ item, addedAt: item.dateAdded }));

export const favoriteTracks = async (): Promise<Entry<Track>[]> => withDate(await user.favoriteTracks('DATE', 'DESC'));
export const favoriteAlbums = async (): Promise<Entry<Album>[]> => withDate(await user.favoriteAlbums('DATE', 'DESC'));
export const favoriteArtists = async () => withDate(await user.favoriteArtists('DATE', 'DESC'));
export const favoriteVideos = async (): Promise<Entry<Video>[]> => withDate(await user.favoriteVideos('DATE', 'DESC'));

export async function favoriteMixes(): Promise<Entry<Mix>[]> {
  const out: Entry<Mix>[] = [];
  let cursor: string | undefined;
  do {
    const r = await api('v2', 'favorites/mixes', { limit: 50, order: 'DATE', orderDirection: 'DESC', cursor });
    for (const x of r.items ?? []) out.push({ item: toMix(x), addedAt: x.dateAdded ?? x.addedAt });
    cursor = r.cursor || undefined;
  } while (cursor && out.length < 2000);
  return out;
}

// ── playlists + folders ──────────────────────────────────────────────────────

const toFolderEntry = (x: any): Entry | null => {
  if (x.itemType === 'FOLDER') {
    const folder: Folder = {
      kind: 'folder',
      id: x.data?.id ?? String(x.trn ?? '').split(':').pop(),
      name: x.name ?? x.data?.name ?? '',
      numberOfItems: x.data?.totalNumberOfItems ?? 0,
      lastModifiedAt: x.lastModifiedAt,
    };
    return { item: folder, addedAt: x.addedAt ?? x.data?.createdAt, updatedAt: x.lastModifiedAt };
  }
  if (!x.data) return null;
  return { item: toPlaylist(x.data), addedAt: x.addedAt, updatedAt: x.lastModifiedAt ?? x.data.lastUpdated };
};

/** Every playlist and folder directly inside `folderId` (paged by 50 like the real app). */
export async function folderEntries(folderId = 'root'): Promise<Entry<Playlist | Folder>[]> {
  const out: Entry<Playlist | Folder>[] = [];
  for (let offset = 0; offset < 5000; offset += 50) {
    const r = await api('v2', 'my-collection/playlists/folders', { folderId, includeOnly: '', offset, limit: 50, order: 'DATE', orderDirection: 'DESC' });
    const items = r.items ?? [];
    for (const x of items) {
      const e = toFolderEntry(x);
      if (e) out.push(e as Entry<Playlist | Folder>);
    }
    if (items.length < 50 || out.length >= (r.totalNumberOfItems ?? 0)) break;
  }
  return out;
}

// ── openapi (JSON:API) helpers ───────────────────────────────────────────────

const openapi = <T = any>(path: string, query: Record<string, string | number | undefined> = {}) =>
  idol.api.request<T>({ host: 'openapi', path, query: { countryCode: session.countryCode, ...query }, headers: { Accept: 'application/vnd.api+json' } });

interface JsonApiDoc {
  data: { id: string; type: string; meta?: Record<string, any>; relationships?: Record<string, { data?: { id: string; type: string } | { id: string; type: string }[] }> }[];
  included?: { id: string; type: string; attributes?: Record<string, any>; relationships?: Record<string, any> }[];
  links?: { next?: string };
}

/** Follows `links.next` cursors; returns all `data` and `included` rows. */
async function jsonApiAll(path: string, query: Record<string, string | undefined>, max = 500) {
  const data: JsonApiDoc['data'] = [];
  const included: NonNullable<JsonApiDoc['included']> = [];
  let q: Record<string, string | undefined> = query;
  for (let page = 0; page < 20 && data.length < max; page++) {
    const r = await openapi<JsonApiDoc>(path, q);
    data.push(...(r.data ?? []));
    included.push(...(r.included ?? []));
    const next = r.links?.next;
    if (!next) break;
    const cursor = new URL(next, 'https://x').searchParams.get('page[cursor]');
    if (!cursor) break;
    q = { ...query, 'page[cursor]': cursor };
  }
  return { data, included };
}

/** resources.tidal.com artwork URL → the image id our image helpers expect. */
const imageIdFromUrl = (href?: string): string | null => {
  const m = href?.match(/resources\.tidal\.com\/images\/((?:[0-9a-f]+\/){4}[0-9a-f]+)\//i);
  return m ? m[1].replace(/\//g, '-') : null;
};

/** ISO-8601 duration ("PT3M47S") → seconds. */
const isoSeconds = (d?: string) => {
  const m = d?.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  return m ? Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0) : 0;
};

// Catalog lookups through v1 give us the same models as everywhere else (and work with the menus).
const v1Lookup: Record<string, (id: string) => Promise<MediaItem>> = {
  albums: async (id) => toAlbum(await api('v1', `albums/${id}`)),
  tracks: async (id) => toTrack(await api('v1', `tracks/${id}`)),
  artists: async (id) => toArtist(await api('v1', `artists/${id}`)),
  videos: async (id) => toVideo(await api('v1', `videos/${id}`)),
  playlists: async (id) => toPlaylist(await api('v1', `playlists/${id}`)),
};

async function mapLimit<T, R>(list: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(list.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, list.length) }, async () => {
      while (next < list.length) {
        const i = next++;
        out[i] = await fn(list[i]);
      }
    }),
  );
  return out;
}

/** Items saved with "Save for later" (newest first). */
export async function saveForLater(): Promise<Entry[]> {
  const { data } = await jsonApiAll('userCollectionSaveForLaters/me/relationships/items', { include: 'items' });
  const rows = await mapLimit(data, 6, async (d) => {
    const look = v1Lookup[d.type];
    if (!look) return null;
    try {
      return { item: await look(d.id), addedAt: d.meta?.addedAt } as Entry;
    } catch {
      return null;
    }
  });
  return rows.filter(Boolean) as Entry[];
}

/** Purchased albums or tracks (marketplace uploads). Read-only. */
export async function purchases(kind: 'albums' | 'tracks'): Promise<Entry[]> {
  const { data, included } = await jsonApiAll('purchases', {
    'filter[owners.id]': 'me',
    'filter[subject.type]': kind,
    include: 'subject,subject.artists,subject.coverArt',
  });
  const inc = new Map(included.map((x) => [`${x.type}:${x.id}`, x]));
  const rel = (x: { relationships?: Record<string, any> } | undefined, name: string) => {
    const d = x?.relationships?.[name]?.data;
    return (Array.isArray(d) ? d : d ? [d] : []).map((r: { id: string; type: string }) => inc.get(`${r.type}:${r.id}`)).filter(Boolean);
  };
  const out: Entry[] = [];
  for (const p of data) {
    const subj = rel(p, 'subject')[0];
    const sid = (p.relationships?.subject?.data as { id: string } | undefined)?.id ?? subj?.id;
    if (!sid) continue;
    const a = subj?.attributes ?? {};
    const artists = rel(subj, 'artists').map((x: any) => ({ id: Number(x.id), name: x.attributes?.name ?? '' }));
    const art = rel(subj, 'coverArt')[0]?.attributes?.files?.[0]?.href;
    const base = { id: Number(sid), title: a.title ?? '', version: a.version ?? null, explicit: !!a.explicit, artists };
    const item: MediaItem =
      kind === 'albums'
        ? toAlbum({ ...base, cover: imageIdFromUrl(art), releaseDate: a.releaseDate ?? null, numberOfTracks: a.numberOfItems, duration: isoSeconds(a.duration), upload: true })
        : toTrack({ ...base, duration: isoSeconds(a.duration), album: { id: 0, title: '', cover: imageIdFromUrl(art) }, upload: true });
    out.push({ item, addedAt: (p as any).attributes?.purchasedAt ?? p.meta?.purchasedAt });
  }
  return out;
}
