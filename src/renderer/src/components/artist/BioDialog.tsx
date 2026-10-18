// "Read more" biography modal: artist picture + name, then the full bio fetched at runtime.
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { artistUrl } from '@/api/images';
import { artists } from '@/api/tidal';
import { Icon } from '@/components/Icon';
import { useQuery } from '@/lib/query';
import { BioText, bioParagraphs } from './bio';
import s from './BioDialog.module.css';

export function BioDialog({ artistId, name, picture, fallback, onClose }: { artistId: string; name: string; picture: string | null; fallback: string | null; onClose: () => void }) {
  // never persisted: the query cache lives in memory only
  const { data, loading } = useQuery(`artist:${artistId}:bio`, () => artists.bio(artistId));
  const text = data?.text || fallback || '';
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className={s.backdrop} data-test="dialog-modeless-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={s.dialog} role="dialog" aria-modal="true" aria-label="Biography" data-test="dialog">
        <header className={s.top}>
          <button type="button" className={s.close} aria-label="Close" data-test="dialog-close" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </header>
        <div className={s.container}>
          <div className={s.header}>
            {picture ? <img className={s.image} src={artistUrl(picture, 80)} alt="" data-test="artist-bio-image" /> : <span className={s.image} />}
            <div className={s.headerText}>
              <span data-test="artist-bio-name">{name}</span>
              <span className={s.sub}>Biography</span>
            </div>
          </div>
          <div className={s.body} role="region" aria-label="Biography" data-test="artist-bio-body">
            {loading && !text ? <p className={s.sub}>Loading…</p> : !text ? <p className={s.sub}>No biography available</p> : bioParagraphs(text).map((p, i) => <p key={i}>{<BioText text={p} />}</p>)}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
