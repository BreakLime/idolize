// Recent searches (persisted in localStorage): items the user opened from search results,
// and queries they submitted. Shown by the header search popover.
import { create } from 'zustand';
import { itemKey, type MediaItem } from '@/api/models';

const KEY = 'idolize:recent-searches';
const MAX_ITEMS = 10;
const MAX_QUERIES = 20;

interface RecentState {
  items: MediaItem[];
  queries: string[];
}

function load(): RecentState {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<RecentState>;
    return { items: Array.isArray(v.items) ? v.items : [], queries: Array.isArray(v.queries) ? v.queries : [] };
  } catch {
    return { items: [], queries: [] };
  }
}

export const useRecent = create<RecentState>(load);

useRecent.subscribe((s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ items: s.items, queries: s.queries }));
  } catch {
    /* storage full / unavailable: keep in memory */
  }
});

export const recent = {
  addItem(item: MediaItem) {
    if (item.kind === 'folder') return;
    const k = itemKey(item);
    useRecent.setState((s) => ({ items: [item, ...s.items.filter((x) => itemKey(x) !== k)].slice(0, MAX_ITEMS) }));
  },
  removeItem(item: MediaItem) {
    const k = itemKey(item);
    useRecent.setState((s) => ({ items: s.items.filter((x) => itemKey(x) !== k) }));
  },
  addQuery(q: string) {
    const t = q.trim();
    if (!t) return;
    useRecent.setState((s) => ({ queries: [t, ...s.queries.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX_QUERIES) }));
  },
  removeQuery(q: string) {
    useRecent.setState((s) => ({ queries: s.queries.filter((x) => x !== q) }));
  },
  clear() {
    useRecent.setState({ items: [], queries: [] });
  },
};
