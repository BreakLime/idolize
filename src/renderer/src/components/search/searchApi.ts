// Search-area endpoints beyond the shared `search()`: live query suggestions + direct hits for the header popover.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { toMediaItem, type MediaItem } from '@/api/models';
import { api } from '@/api/tidal';
import type { QuerySuggestion } from './highlight';

export interface Suggestions {
  history: QuerySuggestion[];
  suggestions: QuerySuggestion[];
  directHits: MediaItem[];
}

const toSuggestion = (x: any): QuerySuggestion | null => (typeof x === 'string' ? { query: x, highlights: [] } : x?.query ? { query: x.query, highlights: x.highlights ?? [] } : null);

/** v2 `suggestions/` — what the real app calls (debounced) while typing in the header search field. */
export async function suggestions(query: string): Promise<Suggestions> {
  const r = await api('v2', 'suggestions/', { query, explicit: true, hybrid: true });
  return {
    history: (r.history ?? []).map(toSuggestion).filter(Boolean),
    suggestions: (r.suggestions ?? []).map(toSuggestion).filter(Boolean),
    directHits: (r.directHits ?? []).map((h: any) => toMediaItem(h.type, h.value)).filter(Boolean),
  };
}
