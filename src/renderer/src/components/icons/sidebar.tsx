// Sidebar-only glyphs (own drawings, 16px grid).

/** Sort-direction arrow of the "Sorting & Filter" menu: points down for descending. */
export function SortArrow({ descending }: { descending: boolean }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block', transform: descending ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}>
      <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" />
    </svg>
  );
}

/** Small filled play triangle for the playlist-row artwork overlay. */
export function MiniPlay() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true">
      <path fill="currentColor" d="M3 1.9a.7.7 0 0 1 1.07-.6l6.1 3.9a.95.95 0 0 1 0 1.6l-6.1 3.9A.7.7 0 0 1 3 10.1V1.9Z" />
    </svg>
  );
}
