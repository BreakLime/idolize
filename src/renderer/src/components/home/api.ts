// Home / view-all / feed endpoints (v2). Built on the shared `api()` client; models normalized via api/models.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { toAlbum, toMediaItem, toMix, type Album, type MediaItem, type Mix } from '@/api/models';
import { api, home, session, toFeedModule, type FeedModule } from '@/api/tidal';

export type Vibe = 'STATIC' | 'EDITORIAL' | 'UPLOADS';

export const DEFAULT_VIBES: { name: string; type: string }[] = [
  { name: 'For you', type: 'STATIC' },
  { name: 'Staff Picks', type: 'EDITORIAL' },
  { name: 'Uploads', type: 'UPLOADS' },
];

/** `home/feed/static|editorial|uploads` (verified against the real app's network traffic). */
export const homeFeed = (vibe: string) => home.feed(vibe);

const timeOffset = () => {
  const m = -new Date().getTimezoneOffset();
  return `${m >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(m) / 60)).padStart(2, '0')}:${String(Math.abs(m) % 60).padStart(2, '0')}`;
};

export interface HomeFeedPage {
  vibes: { name: string; type: string }[];
  modules: FeedModule[];
  /** next page (`?cursor=`), null on the last page — the static feed loads more modules on scroll */
  cursor: string | null;
}

export async function homeFeedPage(vibe: string, cursor?: string | null): Promise<HomeFeedPage> {
  const r = await api('v2', `home/feed/${vibe.toLowerCase()}`, { platform: 'DESKTOP', timeOffset: timeOffset(), ...(cursor ? { cursor } : {}) });
  return {
    vibes: (r.header?.vibes?.items ?? []) as { name: string; type: string }[],
    modules: (r.items ?? []).map(toFeedModule) as FeedModule[],
    cursor: r.page?.cursor ?? null,
  };
}

/** Editorial "magazine" promotion (Uploads → Featured). Not a playable media item. */
export interface Magazine {
  kind: 'magazine';
  id: number;
  imageId: string | null;
  imageUrl: string | null;
  header: string;
  title: string;
  subtitle: string;
  artifactType: string;
  artifactId: string;
  openExternal: boolean;
}

export const toMagazine = (d: any): Magazine => ({
  kind: 'magazine',
  id: d.id,
  imageId: d.imageId ?? null,
  imageUrl: d.imageURL ?? null,
  header: d.header ?? '',
  title: d.shortHeader ?? d.title ?? '',
  subtitle: d.shortSubHeader ?? d.subheader ?? '',
  artifactType: d.type ?? '',
  artifactId: String(d.artifactId ?? ''),
  openExternal: !!d.openExternal,
});

/** Route for a promotion's target (`null` when it points outside the app). */
export function magazinePath(m: Magazine): string | null {
  switch (m.artifactType) {
    case 'PLAYLIST':
      return `/playlist/${m.artifactId}`;
    case 'ALBUM':
      return `/album/${m.artifactId}`;
    case 'ARTIST':
      return `/artist/${m.artifactId}`;
    case 'MIX':
      return `/mix/${m.artifactId}`;
    case 'TRACK':
      return `/track/${m.artifactId}`;
    case 'VIDEO':
      return `/video/${m.artifactId}`;
    default:
      return null;
  }
}

export const magazinesOf = (raw: any): Magazine[] => (raw?.items ?? []).filter((i: any) => i?.type === 'MAGAZINE' && i.data).map((i: any) => toMagazine(i.data));

export interface ViewAllPage {
  title: string;
  subtitle: string | null;
  description: string | null;
  layout: string;
  items: MediaItem[];
  magazines: Magazine[];
}

/** `extra` carries the module's own view-all query (itemId, rankingToken …). */
export async function viewAll(moduleId: string, extra: Record<string, string> = {}): Promise<ViewAllPage> {
  // since 2026-10-18 the endpoint answers 400 (subStatus 1002) without timeOffset, like the feed itself
  const r = await api('v2', `home/pages/${moduleId}/view-all`, { platform: 'DESKTOP', timeOffset: timeOffset(), limit: 50, offset: 0, ...extra });
  return {
    title: r.title ?? '',
    subtitle: r.subtitle ?? null,
    description: r.description ?? null,
    layout: r.itemLayout ?? 'GRID',
    items: (r.items ?? []).map((i: any) => toMediaItem(i.type, i.data)).filter(Boolean) as MediaItem[],
    magazines: magazinesOf(r),
  };
}

// ── feed (notifications for followed artists, monthly history mixes …) ─────────

export interface FeedActivity {
  type: string; // NEW_ALBUM_RELEASE | NEW_HISTORY_MIX | …
  occurredAt: string;
  seen: boolean;
  item: Album | Mix;
}

export async function feedActivities(): Promise<FeedActivity[]> {
  const r = await api('v2', 'feed/activities', { userId: session.userId, locale: 'en-us' });
  const out: FeedActivity[] = [];
  for (const a of r.activities ?? []) {
    const f = a.followableActivity ?? {};
    const item = f.album ? toAlbum(f.album) : f.historyMix ? toMix(f.historyMix) : f.mix ? toMix(f.mix) : null;
    if (item) out.push({ type: f.activityType ?? '', occurredAt: f.occurredAt ?? '', seen: !!a.seen, item });
  }
  return out;
}

export type { FeedModule };
export { toFeedModule };
