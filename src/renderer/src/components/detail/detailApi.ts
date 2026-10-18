// Endpoints only the detail pages / media menus need (kept out of the shared api module to avoid merge churn).
import { api, session } from '@/api/tidal';
import { idol } from '@/lib/bridge';

async function playlistEtag(uuid: string): Promise<string> {
  const p = await api('v1', `playlists/${uuid}`);
  return `"${new Date(p.lastUpdated).getTime()}"`;
}

export const playlistMeta = {
  /** rename / change description of an own playlist */
  async update(uuid: string, title: string, description: string) {
    const etag = await playlistEtag(uuid);
    return api('v1', `playlists/${uuid}`, {}, { method: 'POST', body: { title, description }, form: true, headers: { 'If-None-Match': etag } });
  },
  setPublic: (uuid: string, isPublic: boolean) => api('v2', `playlists/${uuid}/${isPublic ? 'set-public' : 'set-private'}`, {}, { method: 'PUT' }),
  moveToFolder: (uuid: string, folderId: string) =>
    api('v2', 'my-collection/playlists/folders/move', { folderId, trns: `trn:playlist:${uuid}` }, { method: 'PUT' }),
};

export const folders = {
  rename: (id: string, name: string) => api('v2', 'my-collection/playlists/folders/rename', { trn: `trn:folder:${id}`, name }, { method: 'PUT' }),
  /** the folder object itself (name, counts) */
  async get(id: string): Promise<{ id: string; name: string; numberOfItems: number } | null> {
    const r = await api('v2', 'my-collection/playlists/folders/flattened', { includeOnly: 'FOLDER', offset: 0, limit: 50, order: 'DATE', orderDirection: 'DESC' }).catch(() => null);
    const hit = (r?.items ?? []).find((x: { data?: { id?: string } }) => x.data?.id === id);
    return hit ? { id, name: hit.name ?? hit.data?.name ?? '', numberOfItems: hit.data?.totalNumberOfItems ?? 0 } : null;
  },
};

// openapi (JSON:API) only routes requests that accept its media type
const JSONAPI = { Accept: 'application/vnd.api+json' };

type SaveType = 'tracks' | 'albums' | 'playlists' | 'videos' | 'artists';
const SFL = 'userCollectionSaveForLaters/me/relationships/items';
const sflRequest = (method: 'POST' | 'DELETE', type: SaveType, id: string | number) =>
  idol.api.request({ host: 'openapi', path: SFL, query: { countryCode: session.countryCode }, method, body: { data: [{ id: String(id), type }] }, headers: JSONAPI });

/** TIDAL's "Save for Later" collection (openapi v2 user collection relationship). */
export const saveForLater = {
  add: (type: SaveType, id: string | number) => sflRequest('POST', type, id),
  remove: (type: SaveType, id: string | number) => sflRequest('DELETE', type, id),
  ids: async (): Promise<Set<string>> => {
    const r = await idol.api.request<{ data?: { id: string; type: string }[] }>({ host: 'openapi', path: SFL, query: { countryCode: session.countryCode }, headers: JSONAPI });
    return new Set((r?.data ?? []).map((x) => `${x.type}:${x.id}`));
  },
};

export interface PlaylistExtra {
  followers: number;
  isPublic: boolean;
  ownerName: string | null;
}

/** Fans count, visibility and owner profile name (not in the v1 playlist payload). */
export async function playlistExtra(uuid: string): Promise<PlaylistExtra> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await idol.api.request<any>({ host: 'openapi', path: `playlists/${uuid}`, query: { countryCode: session.countryCode, include: 'ownerProfiles' }, headers: JSONAPI });
  const a = r?.data?.attributes ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const owner = (r?.included ?? []).find((x: any) => x.type === 'artists' || x.type === 'userProfiles');
  return { followers: a.numberOfFollowers ?? 0, isPublic: a.accessType === 'PUBLIC', ownerName: owner?.attributes?.name || null };
}

/** Mix/radio "Block": hides a track or artist from mixes and radio. */
export const blocks = {
  track: (id: number) => api('v1', `users/${session.userId}/blocks/tracks`, {}, { method: 'POST', body: { trackId: String(id) }, form: true }),
  artist: (id: number) => api('v1', `users/${session.userId}/blocks/artists`, {}, { method: 'POST', body: { artistId: String(id) }, form: true }),
};
