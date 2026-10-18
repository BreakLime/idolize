// Artist-area endpoints that the shared api module does not cover (view-all pages, contributor credits).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { toMediaItem, toTrack, type MediaItem, type Track } from '@/api/models';
import { api, artists, page, type FeedModule } from '@/api/tidal';

export interface ArtistHeaderInfo {
  name: string;
  picture: string | null;
  vibrantColor: string | null;
  mixId?: string;
  fans: number;
  /** HTML-ish text from the API — rendered at runtime only, never stored */
  biography: string | null;
  website: string | null;
  roles: string[];
}

export interface ArtistPageData {
  id: string;
  header: ArtistHeaderInfo;
  modules: FeedModule[];
}

export async function artistPage(id: string): Promise<ArtistPageData> {
  const r = await artists.page(id);
  const h = r.header ?? {};
  const d = r.item?.data ?? {};
  return {
    id,
    header: {
      name: d.name ?? '',
      picture: d.picture ?? d.selectedAlbumCoverFallback ?? null,
      vibrantColor: d.vibrantColor ?? null,
      mixId: d.mixes?.ARTIST_MIX,
      fans: h.followersAmount ?? 0,
      biography: h.biography?.text ?? null,
      website: h.mainLink?.url ?? null,
      roles: (d.artistRoles ?? []).map((x: any) => x.category as string),
    },
    modules: r.modules,
  };
}

/** Top-track list module items keep their raw `credits` (credits card) next to the normalized track. */
export function creditTracks(m: FeedModule): (Track & { roles: string[] })[] {
  return (m.raw.items ?? []).filter((i: any) => i.data).map((i: any) => Object.assign(toTrack(i.data), { roles: (i.data.credits ?? []).map((c: any) => c.role as string) }));
}

export interface ViewAllPage {
  title: string;
  layout: string;
  items: MediaItem[];
}

/** `artist/<MODULE>/view-all?artistId=` — all pages (the app shows the full list). */
export async function artistViewAll(moduleId: string, artistId: string): Promise<ViewAllPage> {
  const limit = 50;
  let offset = 0;
  let title = '';
  let layout = 'GRID';
  const items: MediaItem[] = [];
  for (let i = 0; i < 20; i++) {
    const r = await api('v2', `artist/${moduleId}/view-all`, { artistId, platform: 'DESKTOP', limit, offset });
    title = r.title ?? title;
    layout = r.itemLayout ?? layout;
    const page = (r.items ?? []).map((x: any) => toMediaItem(x.type === 'TRACK_CREDITS' ? 'TRACK' : x.type, x.data)).filter(Boolean) as MediaItem[];
    items.push(...page);
    if (page.length < limit) break;
    offset += limit;
  }
  return { title, layout, items };
}

export interface ContributorCredit {
  track: Track;
  /** role names ("Producer", "Composer") and their categories ("Producer", "Songwriter") */
  roles: { name: string; category: string }[];
}

export interface ContributorPage {
  title: string;
  artist: { id: number; name: string; picture: string | null };
  /** filter pills: role categories the artist has credits in */
  categories: string[];
  items: ContributorCredit[];
}

const toCredit = (x: any): ContributorCredit | null => (x?.item?.id ? { track: toTrack(x.item), roles: (x.roles ?? []).map((r: any) => ({ name: r.name ?? '', category: r.category ?? '' })) } : null);

/** v1 `pages/contributor` — every track the artist is credited on (paged through `dataApiPath`). */
export async function contributorPage(artistId: string): Promise<ContributorPage> {
  const p = await page('contributor', { artistId });
  const head = p.modules.find((m) => m.type === 'CONTRIBUTOR_HEADER');
  const list = p.modules.find((m) => m.type === 'ITEM_LIST_WITH_ROLES');
  const pl = list?.raw.pagedList;
  const items = (pl?.items ?? []).map(toCredit).filter(Boolean) as ContributorCredit[];
  const total = pl?.totalNumberOfItems ?? items.length;
  if (pl?.dataApiPath && items.length < total) {
    const [path, qs = ''] = String(pl.dataApiPath).split('?');
    const query = Object.fromEntries(new URLSearchParams(qs));
    for (let offset = items.length; offset < Math.min(total, 1000); offset += 50) {
      const r = await api('v1', path, { ...query, offset, limit: 50 });
      const more = (r.items ?? []).map(toCredit).filter(Boolean) as ContributorCredit[];
      if (!more.length) break;
      items.push(...more);
    }
  }
  const categories: string[] = (list?.raw.roleCategories ?? []).map((c: any) => (typeof c === 'string' ? c : (c.category ?? c.name ?? ''))).filter(Boolean);
  const a = head?.raw.artist ?? {};
  return { title: head?.title || p.title, artist: { id: a.id ?? Number(artistId), name: a.name ?? '', picture: a.picture ?? null }, categories, items };
}
