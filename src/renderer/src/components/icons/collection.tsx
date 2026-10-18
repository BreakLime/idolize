// Glyphs for My Collection (sidebar flyout, collection index, empty states). Own drawings on a 24px grid,
// stroked with round caps like components/Icon.tsx; empty states render them at 96px with a heavier stroke.
import type { CSSProperties, ReactNode } from 'react';

export type CollectionGlyph =
  | 'mixes'
  | 'playlists'
  | 'albums'
  | 'tracks'
  | 'videos'
  | 'profiles'
  | 'purchases'
  | 'save-for-later'
  | 'folder'
  | 'arrow-down'
  | 'arrow-up'
  | 'search'
  | 'chevron-right'
  | 'chevron-down'
  | 'chevron-up';

const glyphs: Record<CollectionGlyph, ReactNode> = {
  // dot with two pairs of arcs ("on air")
  mixes: (
    <>
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <path d="M7.9 7.9a5.8 5.8 0 0 0 0 8.2M16.1 7.9a5.8 5.8 0 0 1 0 8.2M4.4 4.4a10.75 10.75 0 0 0 0 15.2M19.6 4.4a10.75 10.75 0 0 1 0 15.2" />
    </>
  ),
  // single note with three list lines
  playlists: (
    <>
      <path d="M7.25 3v14" />
      <circle cx="4.75" cy="17.75" r="2.75" />
      <path d="M11.5 6.75h9.25M11.5 12h9.25M11.5 17.25h5" />
    </>
  ),
  albums: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="2.75" />
    </>
  ),
  tracks: (
    <>
      <path d="M8.75 18.5V5.5l12-2.5v13.5" />
      <circle cx="5.75" cy="18.5" r="3" />
      <circle cx="17.75" cy="16.5" r="3" />
    </>
  ),
  videos: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="5.5" />
      <path d="M9.6 7.6v8.8l7-4.4-7-4.4Z" fill="currentColor" />
    </>
  ),
  // hand microphone: round head, angled handle
  profiles: (
    <>
      <circle cx="15.25" cy="8.75" r="5.75" />
      <path d="m11.4 12.6-7.6 6.9a1.5 1.5 0 0 0 2.1 2.1l6.9-7.6" />
    </>
  ),
  // price tag with a hole
  purchases: (
    <>
      <path d="M12.4 2.75h7.35a1.5 1.5 0 0 1 1.5 1.5v7.35a1.5 1.5 0 0 1-.44 1.06l-8.6 8.6a1.75 1.75 0 0 1-2.47 0l-6.85-6.85a1.75 1.75 0 0 1 0-2.47l8.6-8.6a1.5 1.5 0 0 1 1.06-.44Z" />
      <circle cx="16.6" cy="7.4" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  'save-for-later': <path d="M6 2.75h12a.75.75 0 0 1 .75.75v17.25L12 16l-6.75 4.75V3.5A.75.75 0 0 1 6 2.75Z" />,
  folder: <path d="M3.75 7.25a1.5 1.5 0 0 1 1.5-1.5h4.1l2 2.25h7.4a1.5 1.5 0 0 1 1.5 1.5v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-10.5Z" />,
  'arrow-down': <path d="M12 5v13.5M6.5 13l5.5 5.5 5.5-5.5" />,
  'arrow-up': <path d="M12 19V5.5M6.5 11 12 5.5l5.5 5.5" />,
  search: (
    <>
      <circle cx="10.75" cy="10.75" r="6.75" />
      <path d="M15.75 15.75 20.5 20.5" />
    </>
  ),
  'chevron-right': <path d="m9.5 6 6 6-6 6" />,
  'chevron-down': <path d="m6 9.5 6 6 6-6" />,
  'chevron-up': <path d="m6 14.5 6-6 6 6" />,
};

/** The bare glyph as an SVG group, for composing inside another SVG (24px grid). */
export function CollectionGlyphPaths({ name, stroke = 1.6 }: { name: CollectionGlyph; stroke?: number }) {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {glyphs[name]}
    </g>
  );
}

export function CollectionIcon({
  name,
  size = 24,
  stroke = 1.6,
  className,
  style,
  testId,
}: {
  name: CollectionGlyph;
  size?: number;
  stroke?: number;
  className?: string;
  style?: CSSProperties;
  testId?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      data-test={testId}
    >
      {glyphs[name]}
    </svg>
  );
}
