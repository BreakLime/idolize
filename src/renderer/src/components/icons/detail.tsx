// Extra glyphs for the detail pages, drawn on Idolize's 24px grid (stroke 1.6, round caps).
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function LockIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <g {...S}>
        <rect x="5.25" y="10.5" width="13.5" height="9.75" rx="1.75" />
        <path d="M8.25 10.5V8a3.75 3.75 0 0 1 7.5 0v2.5" />
      </g>
    </svg>
  );
}

export function UnlockIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <g {...S}>
        <rect x="5.25" y="10.5" width="13.5" height="9.75" rx="1.75" />
        <path d="M8.25 10.5V8a3.75 3.75 0 0 1 7.2-1.5" />
      </g>
    </svg>
  );
}

export function PencilIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path {...S} d="m14.5 5.5 4 4M4.75 19.25l1-4.25L15.9 4.85a1.6 1.6 0 0 1 2.26 0l.99.99a1.6 1.6 0 0 1 0 2.26L9 18.25l-4.25 1Z" />
    </svg>
  );
}

/** Small "+" (add collaborator chip, 12×16). */
export function SmallPlus() {
  return (
    <svg width={12} height={16} viewBox="0 0 12 16" aria-hidden="true">
      <path d="M6 4.5v7M2.5 8h7" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  );
}

/** Empty-folder illustration (96px). */
export function FolderGlyph({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
      <path
        d="M14 26a6 6 0 0 1 6-6h16.5l7 8H76a6 6 0 0 1 6 6v34a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6V26Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={5}
        strokeLinejoin="round"
      />
    </svg>
  );
}
