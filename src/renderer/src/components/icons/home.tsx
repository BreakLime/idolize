// Glyphs for Home / Explore / Feed (own drawings on a 24px grid, stroke 1.6, round caps).
import type { ReactNode } from 'react';

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function Svg({ size = 24, children, className }: { size?: number; children: ReactNode; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

/** Explore "page link" icons, keyed by the API's `icon` field. */
const LINK_ICONS: Record<string, ReactNode> = {
  new: (
    <g {...S}>
      <rect x="4" y="5.5" width="16" height="14.5" rx="1.5" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </g>
  ),
  top: (
    <g {...S}>
      <path d="M7.5 4.5h9v5a4.5 4.5 0 0 1-9 0v-5Z" />
      <path d="M7.5 6.5H4.75v1.25A3.25 3.25 0 0 0 8 11M16.5 6.5h2.75v1.25A3.25 3.25 0 0 1 16 11M12 14v3.5M8.5 20h7l-1-2.5h-5l-1 2.5Z" />
    </g>
  ),
  videos: (
    <g {...S}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path d="m10 9 5 3-5 3V9Z" />
    </g>
  ),
  hires: (
    <g {...S}>
      <path d="M3.5 10.5v3M7 8v8M10.5 4.5v15M14 7v10M17.5 9.5v5M21 11v2" />
    </g>
  ),
  explicit: (
    <g {...S}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M14.5 8h-5v8h5M9.5 12h4.5" />
    </g>
  ),
};

const ICON_ALIASES: Record<string, string> = {
  new: 'new',
  explore_new_music: 'new',
  top: 'top',
  explore_top_music: 'top',
  videos: 'videos',
  video: 'videos',
  hires: 'hires',
  master: 'hires',
  clean: 'explicit',
  clean_content: 'explicit',
  explicit: 'explicit',
};

export function PageLinkIcon({ icon, size = 24 }: { icon: string; size?: number }) {
  const key = ICON_ALIASES[icon.toLowerCase()];
  const glyph = key ? LINK_ICONS[key] : null;
  if (!glyph) return null;
  return <Svg size={size}>{glyph}</Svg>;
}

/** Narrow play triangle used on shortcut / compact-row artwork overlays. */
export function PlayGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 1.6a.8.8 0 0 1 1.2-.7l7 4.4a.8.8 0 0 1 0 1.4l-7 4.4a.8.8 0 0 1-1.2-.7V1.6Z" fill="currentColor" />
    </svg>
  );
}

export function PauseGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      <rect x="2" y="1.25" width="2.75" height="9.5" rx=".6" fill="currentColor" />
      <rect x="7.25" y="1.25" width="2.75" height="9.5" rx=".6" fill="currentColor" />
    </svg>
  );
}

/** 16px "Purchase required" badge for pay-to-stream uploads (rounded tile + price tag). */
export function PaygatedBadge() {
  return (
    <i data-test="paygated-badge" title="Purchase required" style={{ display: 'flex', flex: 'none', width: 16, height: 16, fontStyle: 'normal' }}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <rect width="16" height="16" rx="4" fill="rgba(255, 255, 255, 0.1)" />
        <path d="M4 4.6v3l4.4 4.4 3.6-3.6L7.6 4H4.6a.6.6 0 0 0-.6.6Z" fill="none" stroke="rgba(255, 255, 255, 0.55)" strokeWidth="1.2" strokeLinejoin="round" />
        <circle cx="6.2" cy="6.2" r=".8" fill="rgba(255, 255, 255, 0.55)" />
      </svg>
    </i>
  );
}

/** 16px gold "Spotlighted track" badge (outlined tile + arrow, warm gradient). */
export function SpotlightedBadge() {
  return (
    <i data-test="spotlighted-badge" title="Spotlighted track" style={{ display: 'flex', flex: 'none', width: 16, height: 16, fontStyle: 'normal' }}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <defs>
          <linearGradient id="idol-spot-grad" x1="0" y1="0" x2="0" y2="16" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffd36b" />
            <stop offset="1" stopColor="#ff9a1f" />
          </linearGradient>
        </defs>
        <rect x=".75" y=".75" width="14.5" height="14.5" rx="3.5" fill="none" stroke="url(#idol-spot-grad)" strokeWidth="1.5" />
        <path d="M8 4.4 5.1 7.6h2v4h1.8v-4h2L8 4.4Z" fill="url(#idol-spot-grad)" />
      </svg>
    </i>
  );
}

/** 16px "Uploaded" badge next to titles of independent uploads (rounded tile + arrow). */
export function UploadedBadge() {
  return (
    <i data-test="uploaded-badge" title="Uploaded" style={{ display: 'flex', flex: 'none', width: 16, height: 16, fontStyle: 'normal' }}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <rect width="16" height="16" rx="4" fill="rgba(255, 255, 255, 0.1)" />
        <path d="M8 12V4.5M5.2 7.2 8 4.4l2.8 2.8" fill="none" stroke="rgba(255, 255, 255, 0.55)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </i>
  );
}
