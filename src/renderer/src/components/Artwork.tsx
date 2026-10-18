// Square/round artwork with TIDAL-style placeholder while loading or when missing.
import { useState, type CSSProperties } from 'react';
import { Icon, type IconName } from './Icon';
import s from './Artwork.module.css';

export function Artwork({
  src,
  size,
  round,
  radius,
  fallbackIcon = 'album',
  className,
  style,
  testId,
  imgTestId,
  alt = '',
}: {
  src?: string;
  size?: number | string;
  round?: boolean;
  radius?: number;
  fallbackIcon?: IconName;
  className?: string;
  style?: CSSProperties;
  testId?: string;
  /** data-test on the <img> itself (TIDAL tags the image, e.g. "mix-image") */
  imgTestId?: string;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const dim = size === undefined ? undefined : typeof size === 'number' ? `${size}px` : size;
  return (
    <figure
      className={`${s.art} ${className ?? ''}`}
      data-test={testId}
      style={{ width: dim, height: dim, borderRadius: round ? '50%' : radius !== undefined ? radius : undefined, ...style }}
    >
      {src && !failed ? (
        <img src={src} alt={alt} draggable={false} loading="lazy" data-test={imgTestId} className={loaded ? s.loaded : ''} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
      ) : (
        <span className={s.fallback}>
          <Icon name={fallbackIcon} size={24} />
        </span>
      )}
    </figure>
  );
}
