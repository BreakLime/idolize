// Extra glyphs for the artist + search screens (own drawings, 24px grid, stroke 1.6, round caps).
import type { CSSProperties } from 'react';

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

interface P {
  size?: number;
  className?: string;
  style?: CSSProperties;
  testId?: string;
}

const svg = (p: P, children: React.ReactNode, viewBox = '0 0 24 24') => (
  <svg width={p.size ?? 24} height={p.size ?? 24} viewBox={viewBox} className={p.className} style={p.style} aria-hidden="true" data-test={p.testId}>
    {children}
  </svg>
);

/** clock with a counter-clockwise arrow: a recent search query */
export const HistoryIcon = (p: P) =>
  svg(
    p,
    <g {...S}>
      <path d="M4.6 13.4A7.6 7.6 0 1 0 6.3 6.8" />
      <path d="M3.8 4.6v3.7h3.7" />
      <path d="M12 8.2V12l2.6 2.1" />
    </g>,
  );

export const TrashIcon = (p: P) =>
  svg(
    p,
    <g {...S}>
      <path d="M5 7h14M9.5 7V5.2h5V7M7 7l.8 12h8.4L17 7" />
    </g>,
  );

/** small round "x" used by the clear-recent button */
export const SmallClose = (p: P) => svg(p, <path {...S} strokeWidth={1.8} d="m7.5 7.5 9 9m0-9-9 9" />);

/** Social link badges: simple self-drawn marks on a colored disc (no brand artwork). */
export function SocialIcon({ site, size = 32, testId }: { site: string; size?: number; testId?: string }) {
  const k = site.toUpperCase();
  const disc = (fill: string, inner: React.ReactNode, ring?: string) => (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" data-test={testId}>
      <circle cx="16" cy="16" r="16" fill={fill} />
      {ring && <circle cx="16" cy="16" r="15.5" fill="none" stroke={ring} />}
      {inner}
    </svg>
  );
  const W = { fill: 'none', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  switch (k) {
    case 'FACEBOOK':
      return disc('#1877f2', <path {...W} strokeWidth={2.6} d="M19.5 9.5h-2a2.5 2.5 0 0 0-2.5 2.5v14M12.5 17h6" />);
    case 'INSTAGRAM':
      return disc(
        '#d6336c',
        <g {...W}>
          <rect x="9" y="9" width="14" height="14" rx="4" />
          <circle cx="16" cy="16" r="3.2" />
          <circle cx="20" cy="12" r="0.4" fill="#fff" />
        </g>,
      );
    case 'TIKTOK':
      return disc('#111', <path {...W} strokeWidth={2.4} d="M17 8.5v11a3.5 3.5 0 1 1-3.5-3.5M17 8.5c.6 2.4 2.2 3.8 4.5 4" />, 'rgba(255,255,255,0.15)');
    case 'TWITTER':
    case 'X':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" data-test={testId}>
          <path {...W} strokeWidth={2.2} d="M7 6.5h5l13 19h-5L7 6.5Zm18 0-7.5 8.3M7 25.5l7.4-8.2" />
        </svg>
      );
    case 'YOUTUBE':
      return disc('#e02424', <path d="M13.5 11.5v9l7.5-4.5-7.5-4.5Z" fill="#fff" />);
    case 'SOUNDCLOUD':
      return disc('#f26f23', <path {...W} d="M8 20v-4m3 4v-6m3 6v-8m3 8v-9c2.6 0 4.6 1.6 5 4 1.6 0 2.5 1.2 2.5 2.5S23.6 20 22 20h-5" />);
    case 'SPOTIFY':
    case 'APPLE':
    default:
      return disc(
        'rgba(255,255,255,0.12)',
        <g {...W}>
          <circle cx="16" cy="16" r="7" />
          <path d="M9 16h14M16 9c2 2 2.8 4.4 2.8 7S18 21 16 23c-2-2-2.8-4.4-2.8-7S14 11 16 9Z" />
        </g>,
      );
  }
}

/** Display name for a social link site key, matching TIDAL's labels. */
export function siteLabel(site: string): string {
  const map: Record<string, string> = {
    FACEBOOK: 'Facebook',
    INSTAGRAM: 'Instagram',
    TIKTOK: 'TikTok',
    TWITTER: 'X',
    YOUTUBE: 'YouTube',
    SOUNDCLOUD: 'SoundCloud',
    OFFICIAL_HOMEPAGE: 'Website',
    SPOTIFY: 'Spotify',
  };
  return map[site.toUpperCase()] ?? site.charAt(0) + site.slice(1).toLowerCase().replace(/_/g, ' ');
}
