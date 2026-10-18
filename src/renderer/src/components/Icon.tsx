// Idolize's own icon set (24×24 grid). Stroked glyphs use currentColor; transport glyphs are filled.
import type { CSSProperties, ReactNode } from 'react';

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const F = { fill: 'currentColor' } as const;

const paths: Record<string, ReactNode> = {
  menu: <path {...S} d="M4 7h16M4 12h16M4 17h16" />,
  'chevron-left': <path {...S} strokeWidth={1.8} d="M14.5 6 8.5 12l6 6" />,
  'chevron-right': <path {...S} strokeWidth={1.8} d="m9.5 6 6 6-6 6" />,
  'chevron-down': <path {...S} strokeWidth={1.8} d="m6 9.5 6 6 6-6" />,
  'chevron-up': <path {...S} strokeWidth={1.8} d="m6 14.5 6-6 6 6" />,
  'sidebar-collapse': <path {...S} d="M5 5v14M19 12H9m4-4.5L8.5 12l4.5 4.5" />,
  'sidebar-expand': <path {...S} d="M19 5v14M5 12h10m-4-4.5 4.5 4.5-4.5 4.5" />,
  music: <path {...S} d="M9 18.5V6.2l10-2.2v12.2M9 18.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm10-2.3a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM9 9.6l10-2.2" />,
  globe: (
    <g {...S}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M3.75 12h16.5M12 3.75c2.3 2.3 3.4 5 3.4 8.25s-1.1 5.95-3.4 8.25c-2.3-2.3-3.4-5-3.4-8.25S9.7 6.05 12 3.75Z" />
    </g>
  ),
  bell: <path {...S} d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5l1.5-1.5ZM10 20.25h4" />,
  upload: <path {...S} d="M12 19.5V5m-6 6 6-6 6 6" />,
  collection: <path {...S} d="M5 5v14M9.5 5v14M14 5.5l5 13.5" />,
  'plus-circle': (
    <g>
      <circle cx="12" cy="12" r="9" fill="currentColor" />
      <path d="M12 7.75v8.5M7.75 12h8.5" stroke="#000" strokeWidth={1.8} strokeLinecap="round" />
    </g>
  ),
  sort: <path {...S} d="M8 18.5V5.5m-3.5 3.5L8 5.5 11.5 9M16 5.5v13m-3.5-3.5 3.5 3.5 3.5-3.5" />,
  folder: <path {...S} d="M3.75 7.25a1.5 1.5 0 0 1 1.5-1.5h4.1l2 2.25h7.4a1.5 1.5 0 0 1 1.5 1.5v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-10.5Z" />,
  search: <path {...S} d="M10.75 17.5a6.75 6.75 0 1 0 0-13.5 6.75 6.75 0 0 0 0 13.5ZM15.6 15.6 20 20" />,
  user: <path {...S} d="M12 12.25a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.75 20.25c.9-3.5 3.75-5.5 7.25-5.5s6.35 2 7.25 5.5" />,
  heart: <path {...S} d="M12 19.5s-7.5-4.4-7.5-10a4.25 4.25 0 0 1 7.5-2.75A4.25 4.25 0 0 1 19.5 9.5c0 5.6-7.5 10-7.5 10Z" />,
  'heart-filled': <path {...F} d="M12 20.3c-.2 0-8.3-4.6-8.3-10.8a5 5 0 0 1 8.3-3.8 5 5 0 0 1 8.3 3.8c0 6.2-8.1 10.8-8.3 10.8Z" />,
  more: (
    <g {...F}>
      <circle cx="5.5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18.5" cy="12" r="1.6" />
    </g>
  ),
  shuffle: <path {...S} d="M4 7h3.2c2.2 0 3.4.9 4.6 2.7l.4.6m7.8-3.3h-3.5c-2.1 0-3.4.9-4.6 2.7l-2.4 3.6C8.3 15.1 7 16 4.8 16H4m16 0h-3.6c-2.1 0-3.4-.9-4.5-2.6M17.5 4.5 20 7l-2.5 2.5m0 4L20 16l-2.5 2.5" />,
  previous: <path {...F} d="M6 5.25a.9.9 0 0 1 1.8 0v5.2l9.1-5.6a1.1 1.1 0 0 1 1.7.95v12.4a1.1 1.1 0 0 1-1.7.95l-9.1-5.6v5.2a.9.9 0 0 1-1.8 0V5.25Z" />,
  next: <path {...F} d="M18 5.25a.9.9 0 0 0-1.8 0v5.2L7.1 4.85a1.1 1.1 0 0 0-1.7.95v12.4a1.1 1.1 0 0 0 1.7.95l9.1-5.6v5.2a.9.9 0 0 0 1.8 0V5.25Z" />,
  play: <path {...F} d="M7.5 4.6a1.2 1.2 0 0 1 1.8-1l11 7.4a1.2 1.2 0 0 1 0 2l-11 7.4a1.2 1.2 0 0 1-1.8-1V4.6Z" />,
  pause: (
    <g {...F}>
      <rect x="6" y="4" width="4" height="16" rx="1.2" />
      <rect x="14" y="4" width="4" height="16" rx="1.2" />
    </g>
  ),
  repeat: <path {...S} d="M5 11V9.75A2.75 2.75 0 0 1 7.75 7H19m-2.5-2.5L19 7l-2.5 2.5M19 13v1.25A2.75 2.75 0 0 1 16.25 17H5m2.5 2.5L5 17l2.5-2.5" />,
  'repeat-one': (
    <g {...S}>
      <path d="M5 11V9.75A2.75 2.75 0 0 1 7.75 7H19m-2.5-2.5L19 7l-2.5 2.5M19 13v1.25A2.75 2.75 0 0 1 16.25 17H5m2.5 2.5L5 17l2.5-2.5" />
      <path d="M11.25 10.75 12.5 10v4" strokeWidth={1.4} />
    </g>
  ),
  queue: <path {...S} d="M4 6.5h16M4 12h16M4 17.5h10" />,
  devices: <path {...S} d="M8.5 15.5a5 5 0 1 1 7 0M6 18a8.5 8.5 0 1 1 12 0M12 13.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" />,
  'volume-off': <path {...S} d="M4.5 9.5v5h3l4.5 4v-13l-4.5 4h-3ZM16 9.5l5 5m0-5-5 5" />,
  'volume-low': <path {...S} d="M4.5 9.5v5h3l4.5 4v-13l-4.5 4h-3ZM15.5 10a3 3 0 0 1 0 4" />,
  'volume-mid': <path {...S} d="M4.5 9.5v5h3l4.5 4v-13l-4.5 4h-3ZM15.5 10a3 3 0 0 1 0 4m2.5-6.5a6.5 6.5 0 0 1 0 9" />,
  'volume-high': <path {...S} d="M4.5 9.5v5h3l4.5 4v-13l-4.5 4h-3ZM15.5 10a3 3 0 0 1 0 4m2.5-6.5a6.5 6.5 0 0 1 0 9m2.25-11.25a9.75 9.75 0 0 1 0 13.5" />,
  'mini-player': (
    <g {...S}>
      <rect x="3.75" y="5.25" width="16.5" height="13.5" rx="1.75" />
      <rect x="11.5" y="11.5" width="6.25" height="4.75" rx="0.75" fill="currentColor" />
    </g>
  ),
  plus: <path {...S} strokeWidth={1.8} d="M12 5v14M5 12h14" />,
  check: <path {...S} strokeWidth={1.8} d="m5 12.5 4.5 4.5L19 7.5" />,
  close: <path {...S} strokeWidth={1.8} d="m6 6 12 12M18 6 6 18" />,
  info: (
    <g {...S}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 11v5.25M12 7.75v.25" strokeWidth={1.9} />
    </g>
  ),
  share: <path {...S} d="M12 4v11m-4-7 4-4 4 4M6.5 11.5v6.75c0 .7.55 1.25 1.25 1.25h8.5c.7 0 1.25-.55 1.25-1.25V11.5" />,
  report: <path {...S} d="M12 4.25 3.75 19.25h16.5L12 4.25ZM12 10v4.25M12 16.75V17" />,
  radio: <path {...S} d="M8.25 15.75a5.3 5.3 0 0 1 0-7.5m7.5 0a5.3 5.3 0 0 1 0 7.5M5.6 18.4a9 9 0 0 1 0-12.8m12.8 0a9 9 0 0 1 0 12.8M12 13.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" />,
  clock: (
    <g {...S}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5V12l3 2" />
    </g>
  ),
  edit: <path {...S} d="M5 19h3.5L18.75 8.75a2.47 2.47 0 0 0-3.5-3.5L5 15.5V19Z" />,
  trash: <path {...S} d="M5 7h14M10 4.5h4M7 7l.75 11.25c.05.7.6 1.25 1.3 1.25h5.9c.7 0 1.25-.55 1.3-1.25L17 7" />,
  lyrics: <path {...S} d="M5 6.5h14M5 11h10M5 15.5h7m5.5 3.75V12.5l2.5-1" />,
  'list-add': <path {...S} d="M4 6.5h11M4 11.5h11M4 16.5h6m7-3v7m-3.5-3.5h7" />,
  'external-link': <path {...S} d="M13.5 4.5H19.5V10.5M19.5 4.5l-8 8M17 13.5v5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5" />,
  playlist: <path {...S} d="M4 6.5h12M4 11h12M4 15.5h7m4.5 3.25V11.5l4-1.25M15.5 18.75a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Z" />,
  album: (
    <g {...S}>
      <circle cx="12" cy="12" r="8.25" />
      <circle cx="12" cy="12" r="2" />
    </g>
  ),
  artist: <path {...S} d="M12 12.25a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.75 20.25c.9-3.5 3.75-5.5 7.25-5.5s6.35 2 7.25 5.5" />,
  video: (
    <g {...S}>
      <rect x="3.75" y="5.75" width="16.5" height="12.5" rx="2" />
      <path d="m10.25 9.5 4 2.5-4 2.5v-5Z" fill="currentColor" />
    </g>
  ),
  bookmark: <path {...S} d="M7 4.75h10v15l-5-3.5-5 3.5v-15Z" />,
  bag: <path {...S} d="M5.5 8h13l-1 11.25H6.5L5.5 8ZM9 8V6.75a3 3 0 0 1 6 0V8" />,
  mix: (
    <g {...F}>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" opacity={0.6} />
      <rect x="4" y="13" width="7" height="7" rx="1" opacity={0.6} />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </g>
  ),
  // window controls are drawn on a 10×10 grid (scaled by size)
  'win-minimize': <path d="M7 12h10" stroke="currentColor" strokeWidth={1.2} />,
  'win-maximize': <rect x="7.5" y="7.5" width="9" height="9" stroke="currentColor" strokeWidth={1.2} fill="none" />,
  'win-restore': <path d="M7.5 9.5h7v7h-7v-7ZM9.5 9.5v-2h7v7h-2" stroke="currentColor" strokeWidth={1.2} fill="none" />,
  'win-close': <path d="m7.5 7.5 9 9m0-9-9 9" stroke="currentColor" strokeWidth={1.2} />,
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 24, className, style, testId }: { name: IconName; size?: number; className?: string; style?: CSSProperties; testId?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} aria-hidden="true" data-test={testId}>
      {paths[name]}
    </svg>
  );
}

/** Idolize's own mark, a little figure: head, body and two wave arms (separate, so the sidebar's can dance). */
export const IDOL_PARTS = {
  head: <circle cx="12" cy="4.5" r="2.5" fill="currentColor" />,
  body: <path d="M8.5 9.5h7v11h-7z" fill="currentColor" />,
  armL: <path d="M3 14.5c2-1.6 3.6-1.6 5.5 0" stroke="currentColor" strokeWidth={1.8} fill="none" strokeLinecap="round" />,
  armR: <path d="M15.5 14.5c2-1.6 3.6-1.6 5.5 0" stroke="currentColor" strokeWidth={1.8} fill="none" strokeLinecap="round" />,
};

export function IdolLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {IDOL_PARTS.head}
      {IDOL_PARTS.body}
      {IDOL_PARTS.armL}
      {IDOL_PARTS.armR}
    </svg>
  );
}
