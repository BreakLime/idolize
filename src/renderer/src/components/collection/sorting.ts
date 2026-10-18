// Client-side sort/filter for collection lists, plus TIDAL's relative "date added" labels.
import { artistNames, type MediaItem } from '../../api/models'; // relative: unit-tested without the renderer alias
import type { Entry } from './api';

export type Dir = 'ASC' | 'DESC';
export type SortKey = 'added' | 'updated' | 'name' | 'artist' | 'album' | 'release' | 'length';
export interface Sort {
  key: SortKey;
  dir: Dir;
}

export interface SortOption {
  key: SortKey;
  label: string;
  /** direction used when the option is first picked */
  dir: Dir;
}

/** Sort menus per tab, in the real app's order and wording. */
export const SORT_OPTIONS = {
  albums: [
    { key: 'added', label: 'Date added', dir: 'DESC' },
    { key: 'name', label: 'A-Z', dir: 'ASC' },
    { key: 'artist', label: 'Artist', dir: 'ASC' },
    { key: 'release', label: 'Release date', dir: 'DESC' },
  ],
  artists: [
    { key: 'added', label: 'Date added', dir: 'DESC' },
    { key: 'name', label: 'A-Z', dir: 'ASC' },
  ],
  playlists: [
    { key: 'added', label: 'Created date', dir: 'DESC' },
    { key: 'updated', label: 'Updated date', dir: 'DESC' },
    { key: 'name', label: 'Alphabetical', dir: 'ASC' },
  ],
  mixes: [
    { key: 'added', label: 'Date added', dir: 'DESC' },
    { key: 'name', label: 'A-Z', dir: 'ASC' },
  ],
  videos: [
    { key: 'added', label: 'Date added', dir: 'DESC' },
    { key: 'name', label: 'A-Z', dir: 'ASC' },
    { key: 'artist', label: 'Artist', dir: 'ASC' },
  ],
} satisfies Record<string, SortOption[]>;

export type SortTab = keyof typeof SORT_OPTIONS | 'tracks';

export const DEFAULT_SORT: Sort = { key: 'added', dir: 'DESC' };

const STORE = 'idol.collection.sort.';

export function loadSort(tab: SortTab): Sort {
  try {
    const v = JSON.parse(localStorage.getItem(STORE + tab) ?? 'null') as Sort | null;
    if (v && typeof v.key === 'string' && (v.dir === 'ASC' || v.dir === 'DESC')) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_SORT;
}

export function saveSort(tab: SortTab, s: Sort) {
  try {
    localStorage.setItem(STORE + tab, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Picking the active option flips its direction; another option starts at its default direction. */
export function nextSort(cur: Sort, key: SortKey, defaultDir: Dir): Sort {
  return cur.key === key ? { key, dir: cur.dir === 'ASC' ? 'DESC' : 'ASC' } : { key, dir: defaultDir };
}

export const itemName = (i: MediaItem): string => (i.kind === 'artist' ? i.name : i.kind === 'folder' ? i.name : i.title);

const itemArtist = (i: MediaItem): string =>
  i.kind === 'album' || i.kind === 'track' || i.kind === 'video' ? artistNames(i.artists) : i.kind === 'playlist' ? (i.creatorName ?? '') : i.kind === 'mix' ? i.subTitle : '';

const itemAlbum = (i: MediaItem) => (i.kind === 'track' ? i.album.title : '');
const itemRelease = (i: MediaItem) => (i.kind === 'album' ? (i.releaseDate ?? '') : i.kind === 'video' ? (i.releaseDate ?? '') : i.kind === 'track' ? (i.album.releaseDate ?? '') : '');
const itemLength = (i: MediaItem) => (i.kind === 'track' || i.kind === 'video' || i.kind === 'album' ? i.duration : 0);

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/** Stable sort. Entries arrive newest-first, so "added DESC" keeps the API order. */
export function sortEntries<T extends MediaItem>(list: Entry<T>[], s: Sort): Entry<T>[] {
  const idx = new Map(list.map((e, i) => [e, i]));
  const cmp = (a: Entry<T>, b: Entry<T>): number => {
    switch (s.key) {
      case 'added':
        // the API's DATE/DESC order (folders first for playlists) is the reference order
        return idx.get(a)! - idx.get(b)!;
      case 'updated':
        return Date.parse(b.updatedAt ?? b.addedAt ?? '0') - Date.parse(a.updatedAt ?? a.addedAt ?? '0');
      case 'name':
        return -collator.compare(itemName(a.item), itemName(b.item));
      case 'artist':
        return -collator.compare(itemArtist(a.item), itemArtist(b.item)) || -collator.compare(itemName(a.item), itemName(b.item));
      case 'album':
        return -collator.compare(itemAlbum(a.item), itemAlbum(b.item));
      case 'release':
        return itemRelease(b.item).localeCompare(itemRelease(a.item));
      case 'length':
        return itemLength(b.item) - itemLength(a.item);
    }
  };
  // every comparator above orders "descending"; ASC reverses it
  const sorted = [...list].sort((a, b) => cmp(a, b) || idx.get(a)! - idx.get(b)!);
  if (s.dir === 'ASC') sorted.reverse();
  return sorted;
}

/** Case/diacritic-insensitive match on title, artists, album and creator. */
export function matchesFilter(i: MediaItem, q: string): boolean {
  const needle = fold(q.trim());
  if (!needle) return true;
  const hay = [itemName(i), itemArtist(i), itemAlbum(i)].join(' ');
  return fold(hay).includes(needle);
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ── "Date added" labels ──────────────────────────────────────────────────────

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
/** Monday-based week start. */
const startOfWeek = (d: Date) => {
  const s = startOfDay(d);
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
};

/** TIDAL's collection labels: Today · Yesterday · This week · Last week · This month · Last month · "Jun 1, 2026". */
export function relativeAdded(iso: string | undefined, now = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = startOfDay(d).getTime();
  const today = startOfDay(now).getTime();
  if (day >= today) return 'Today';
  if (day >= today - 86_400_000) return 'Yesterday';
  const week = startOfWeek(now).getTime();
  if (day >= week) return 'This week';
  if (day >= week - 7 * 86_400_000) return 'Last week';
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return 'This month';
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  if (d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth()) return 'Last month';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
