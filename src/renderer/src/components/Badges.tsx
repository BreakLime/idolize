import type { StreamMeta } from '@shared/ipc';
import { useNavigate } from 'react-router';
import s from './Badges.module.css';

// TIDAL draws these as a light tile with the letters knocked out (dark), on a dark rounded box
const TILE = 'M4 0h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4Z';

export function ExplicitBadge() {
  return (
    <i className={s.explicit} data-test="explicit-badge" aria-label="Explicit" title="Explicit">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path fillRule="evenodd" d={`${TILE}M5.75 4.5h4.5v1.3H7.2v1.55h2.75v1.3H7.2v1.75h3.05v1.3h-4.5V4.5Z`} fill="rgb(242, 242, 242)" />
      </svg>
    </i>
  );
}

/** "AI" badge for AI-generated releases (same tile as the explicit badge). */
export function AiBadge() {
  return (
    <i className={s.explicit} data-test="ai-badge" aria-label="AI generated" title="AI generated">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path
          fillRule="evenodd"
          d={`${TILE}M3.6 11.5 5.9 4.5h1.5l2.3 7H8.3l-.5-1.6H5.5L5 11.5H3.6Zm2.3-2.85h1.5L6.65 6.2 5.9 8.65ZM10.5 4.5h1.35v7H10.5v-7Z`}
          fill="rgb(242, 242, 242)"
        />
      </svg>
    </i>
  );
}

/** "Uploaded" marker for user-uploaded tracks (search uploads, collections). */
export function UploadedBadge() {
  return (
    <i className={s.uploaded} data-test="uploaded-badge" title="Uploaded" aria-label="Uploaded">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="8" fill="rgba(255,255,255,0.1)" />
        <path d="M8 11.5V4.75M5.25 7.5 8 4.75l2.75 2.75" fill="none" stroke="currentColor" strokeOpacity="0.8" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </i>
  );
}

/** Small uppercase tag next to album years etc. (MAX for hi-res, DOLBY ATMOS…) */
export function MediaTag({ tags }: { tags: string[] }) {
  if (tags.includes('HIRES_LOSSLESS')) return <span className={`${s.tag} ${s.max}`} data-test="media-tag-max">MAX</span>;
  if (tags.includes('DOLBY_ATMOS')) return <span className={s.tag}>DOLBY ATMOS</span>;
  return null;
}

export function qualityLabel(st: Pick<StreamMeta, 'audioQuality' | 'bitDepth' | 'sampleRate' | 'codec'>): string {
  if (st.bitDepth && st.sampleRate) return `${st.bitDepth}-bit ${(st.sampleRate / 1000).toFixed(st.sampleRate % 1000 ? 1 : 0)}kHz`;
  if (st.audioQuality === 'HIGH') return 'High';
  if (st.audioQuality === 'LOW') return 'Low';
  return st.codec.toUpperCase();
}

export function QualityBadge({ stream }: { stream: StreamMeta }) {
  const nav = useNavigate();
  const hires = stream.audioQuality === 'HI_RES_LOSSLESS';
  const lossless = hires || stream.audioQuality === 'LOSSLESS';
  return (
    <a
      className={`${s.quality} ${hires ? s.hires : lossless ? s.lossless : s.lossy}`}
      data-test={`quality-badge-${stream.audioQuality}`}
      onClick={() => nav('/settings/general')}
      role="button"
    >
      <span className={s.glow} />
      <span className={s.qualityText}>{qualityLabel(stream)}</span>
      <span className={s.line} />
    </a>
  );
}
