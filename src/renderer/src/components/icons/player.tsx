// Idolize's own glyphs for the player surfaces and settings (24px grid, stroke 1.6, round caps).
import type { CSSProperties } from 'react';

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

interface P {
  size?: number;
  className?: string;
  style?: CSSProperties;
  testId?: string;
}

const svg = (size: number, className: string | undefined, style: CSSProperties | undefined, testId: string | undefined, children: React.ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} aria-hidden="true" data-test={testId}>
    {children}
  </svg>
);

/** two diagonal arrows pointing out (enter full screen) */
export const ExpandIcon = ({ size = 16, className, style, testId }: P) =>
  svg(size, className, style, testId, <path {...S} strokeWidth={1.8} d="M14 4.5h5.5V10M19.5 4.5 13.5 10.5M10 19.5H4.5V14M4.5 19.5l6-6" />);

/** two diagonal arrows pointing in (exit full screen) */
export const ShrinkIcon = ({ size = 16, className, style, testId }: P) =>
  svg(size, className, style, testId, <path {...S} strokeWidth={1.8} d="M19.5 10H14V4.5M14 10l5.5-5.5M4.5 14H10v5.5M10 14l-5.5 5.5" />);

/** list with a plus: "add to queue next" */
export const QueueNextIcon = ({ size = 24, className, style, testId }: P) =>
  svg(size, className, style, testId, <path {...S} d="M4 6.5h14M4 11.5h14M4 16.5h7.5M17 14.5v6M14 17.5h6" />);

/** note with a plus: save queue as playlist */
export const PlaylistSaveIcon = ({ size = 16, className, style, testId }: P) =>
  svg(size, className, style, testId, <path {...S} strokeWidth={1.8} d="M10 18.5V6l7-1.5M10 18.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM17 11.5v7M13.5 15h7" />);

/** circle with a slash (blocked content) */
export const BlockIcon = ({ size = 120, className, style, testId }: P) =>
  svg(
    size,
    className,
    style,
    testId,
    <g {...S} strokeWidth={1.4}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 18 18 6" />
    </g>,
  );

export const RetryIcon = ({ size = 16, className, style, testId }: P) =>
  svg(size, className, style, testId, <path {...S} strokeWidth={1.8} d="M19 12a7 7 0 1 1-2.05-4.95M19 4.5V8h-3.5" />);

export const FolderOpenIcon = ({ size = 16, className, style, testId }: P) =>
  svg(
    size,
    className,
    style,
    testId,
    <path
      {...S}
      d="M3.75 17.5V6.75a1.5 1.5 0 0 1 1.5-1.5h3.6l2 2.25h6.4a1.5 1.5 0 0 1 1.5 1.5v1.5M3.75 17.5l2.4-6.2a1.5 1.5 0 0 1 1.4-.95h12.2a1 1 0 0 1 .93 1.36L18.5 17.5a1.5 1.5 0 0 1-1.4.95H5.25a1.5 1.5 0 0 1-1.5-.95Z"
    />,
  );

/** three bars marking the playing row; the consumer animates `rect`s via className */
export function EqualizerIcon({ size = 16, className, testId }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true" data-test={testId}>
      {[2.5, 7, 11.5].map((x) => (
        <rect key={x} x={x} y="3" width="2.5" height="10" rx="1" fill="currentColor" />
      ))}
    </svg>
  );
}
