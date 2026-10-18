// Query-suggestion highlight helpers (pure, unit-tested).

export interface Highlight {
  start: number;
  length: number;
}
export interface QuerySuggestion {
  query: string;
  highlights: Highlight[];
}

/** Highlights from the API mark the typed part; TIDAL greys those and keeps the completion white. */
export function splitHighlights(text: string, highlights: Highlight[]): { text: string; hl: boolean }[] {
  if (!highlights.length) return [{ text, hl: false }];
  const out: { text: string; hl: boolean }[] = [];
  let pos = 0;
  for (const h of [...highlights].sort((a, b) => a.start - b.start)) {
    if (h.start > pos) out.push({ text: text.slice(pos, h.start), hl: false });
    out.push({ text: text.slice(h.start, h.start + h.length), hl: true });
    pos = h.start + h.length;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), hl: false });
  return out;
}

/** "Daft Punk" → highlight ranges for a locally stored query that starts with what was typed. */
export function prefixHighlights(query: string, typed: string): Highlight[] {
  return typed && query.toLowerCase().startsWith(typed.toLowerCase()) ? [{ start: 0, length: typed.length }] : [];
}
