// Pieces of the album/playlist/mix headers: artist line with avatars, quality tag, compact (sticky) buttons.
import { Fragment, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { artistUrl } from '@/api/images';
import type { ArtistRef } from '@/api/models';
import { Artwork } from '../Artwork';
import { HeaderAction } from '../Buttons';
import type { IconName } from '../Icon';
import b from '../Buttons.module.css';
import s from './HeaderParts.module.css';

/** "(avatar) Ninajirachi, Porter Robinson" — 22px round avatars overlapping by 9px, links 14/600. */
export function ArtistLine({ artists, small }: { artists: ArtistRef[]; small?: boolean }) {
  const shown = artists.slice(0, 3);
  return (
    <span className={`${s.artistLine} ${small ? s.small : ''}`}>
      <span className={s.avatars}>
        {shown.map((a, i) => (
          <Artwork key={a.id} src={artistUrl(a.picture, 22)} size={22} round fallbackIcon="artist" className={s.avatar} style={{ zIndex: shown.length - i }} />
        ))}
      </span>
      <span className={`${s.names} ${small ? 'ellipsis' : ''}`}>
        {artists.map((a, i) => (
          <Fragment key={a.id}>
            {/* the space between names is the line-break opportunity (the comma stays with its name) */}
            {i > 0 && ' '}
            <Link to={`/artist/${a.id}`} className={`${s.artistLink} link`} data-test="grid-item-detail-text-title-artist" aria-label={a.name} title={a.name}>
              {a.name}
            </Link>
          </Fragment>
        ))}
      </span>
    </span>
  );
}

/** MAX (hi-res) / HIGH (lossless) tag next to the album year. */
export function QualityTag({ tags, quality }: { tags: string[]; quality?: string }) {
  if (tags.includes('HIRES_LOSSLESS') || quality === 'HI_RES_LOSSLESS')
    return (
      <span className={`${s.tag} ${s.max}`} data-test="quality-badge-max">
        Max
      </span>
    );
  if (tags.includes('LOSSLESS') || quality === 'LOSSLESS')
    return (
      <span className={`${s.tag} ${s.high}`} data-test="quality-badge-high">
        High
      </span>
    );
  return null;
}

/** Icon-over-label button for the sticky bar (Play/Shuffle get a dimmed icon there). */
export function CompactAction({ icon, label, testId, onClick, dim, natural }: { icon: IconName; label: string; testId?: string; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; dim?: boolean; natural?: boolean }) {
  return <HeaderAction icon={icon} label={label} testId={testId} onClick={onClick} className={`${dim ? s.dimIcon : ''} ${natural ? s.natural : ''}`} />;
}

/** HeaderAction look-alike that takes any glyph (lock, pencil … from icons/detail). */
export function GlyphAction({ glyph, label, testId, onClick, natural, ...rest }: { glyph: ReactNode; label: string; testId?: string; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; natural?: boolean } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  return (
    <button type="button" className={`${b.action} ${natural ? s.natural : ''}`} data-test={testId} onClick={onClick} {...rest}>
      <span className={b.actionInner}>
        {glyph}
        <span className={b.actionLabel}>{label}</span>
      </span>
    </button>
  );
}

/** Report / More sit outside the 48px action group and keep their natural 44.5px height. */
export const naturalAction = s.natural;
export const actionGroup = s.group;
