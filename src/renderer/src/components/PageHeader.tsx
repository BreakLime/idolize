// Album / playlist / mix hero: 240px artwork, title + meta, Play/Shuffle + action row, cover backdrop,
// and the compact sticky bar ("small header") that fades in once the controls scroll away.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Artwork } from './Artwork';
import s from './PageHeader.module.css';

export interface PageHeaderProps {
  image?: string;
  /** small image for the sticky bar */
  imageSmall?: string;
  round?: boolean;
  /** custom artwork node (e.g. mix collage) instead of `image` */
  artwork?: ReactNode;
  title: ReactNode;
  /** line under the title (artist / creator) */
  subtitle?: ReactNode;
  /** meta lines (counts, dates, badges) */
  meta?: ReactNode[];
  /** left side of the control row (Play / Shuffle) */
  primary: ReactNode;
  /** right side of the control row (Added / Credits / Share / … ) */
  actions?: ReactNode;
  /** backdrop image (usually the large cover) */
  backdrop?: string;
  testId?: string;
  /** playlists/mixes: blurred backdrop with a lighter scrim (albums show the cover sharp) */
  backdropBlur?: boolean;
  /** text under the subtitle (playlist description) */
  description?: ReactNode;
  /** sticky bar controls (icon-over-label buttons); defaults to `primary` */
  compact?: ReactNode;
  /** sticky bar line under the title (defaults to `subtitle`) */
  smallSubtitle?: ReactNode;
  /** sticky bar artwork size: 64 (album, mix) or 68 (playlist) */
  smallArtSize?: number;
  smallTestId?: string;
  /** 'wide' = playlist header container (48px side padding, 40px bottom margin) */
  layout?: 'module' | 'wide';
  /** data-test of the artwork + text row ('header-background' on playlists) */
  dataTestId?: string;
  titleStyle?: CSSProperties;
  /** hover overlay on the artwork (album "Credits") */
  artOverlay?: ReactNode;
  className?: string;
  /** extra style for the 240px cover (mix artwork has no placeholder fill) */
  coverStyle?: CSSProperties;
  /** mixes: the title keeps 32px on narrow windows (TIDAL's mix title has no responsive steps) */
  staticTitle?: boolean;
}

export function PageHeader(p: PageHeaderProps) {
  // callback ref: the control row is re-created when the layout changes (album ⇄ credits), re-observe it then
  const [controls, setControls] = useState<HTMLDivElement | null>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const root = document.getElementById('main-scroll');
    setScrolled(false);
    if (!controls || !root) return;
    // the bar takes over once the control row slides under it (the bar is 168px tall)
    const io = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting && e.boundingClientRect.top < 300), { root, rootMargin: '-168px 0px 0px 0px' });
    io.observe(controls);
    return () => io.disconnect();
  }, [controls]);
  const small = p.smallArtSize ?? 64;
  // an explicit `smallSubtitle={null}` hides the line (mix bar shows the title only)
  const smallSub = p.smallSubtitle !== undefined ? p.smallSubtitle : p.subtitle;

  const wide = p.layout === 'wide';
  const bar = (
    <>
      <div className={s.stickyArt} style={{ width: small, height: small }}>
        {p.artwork && !p.imageSmall && !p.image ? null : (
          <Artwork src={p.imageSmall ?? p.image} size={small} round={p.round} radius={p.round ? undefined : 2} testId="cover-art" />
        )}
      </div>
      <div className={s.stickyText}>
        <h2 className={`${s.stickyTitle} ellipsis`} data-test="title" style={p.titleStyle}>
          {p.title}
        </h2>
        {smallSub && <div className={s.stickySub}>{smallSub}</div>}
      </div>
      <div className={s.stickyControls} data-test="header-controls-scrolled">
        {p.compact ?? p.primary}
      </div>
    </>
  );
  const body = (
    <div className={`${s.module} ${wide ? s.wide : ''} ${p.className ?? ''}`} data-test={wide ? undefined : (p.testId ?? 'occluded-module')}>
      {p.backdrop && (
        <div
          className={`${s.backdrop} ${p.backdropBlur ? s.backdropBlur : ''}`}
          aria-hidden="true"
          style={{ '--bd': `url("${p.backdrop}")` } as CSSProperties}
        />
      )}
      <div className={s.inner}>
        <div className={s.top} data-test={p.dataTestId}>
          <div className={s.art}>
            {p.artwork ?? (
              <Artwork src={p.image} size={240} round={p.round} radius={p.round ? undefined : 2} testId="cover-art" style={{ display: 'flex', alignItems: 'center', ...p.coverStyle }} className={s.cover} />
            )}
            {p.artOverlay}
          </div>
          <div className={s.text}>
            <h2 className={`${s.title} ${p.staticTitle ? s.staticTitle : ''}`} data-test="title" style={p.titleStyle}>
              {p.title}
            </h2>
            {p.subtitle && <div className={s.subtitle}>{p.subtitle}</div>}
            {p.description && <div className={s.description}>{p.description}</div>}
            {p.meta && p.meta.length > 0 && (
              <div className={s.meta}>
                {p.meta.map((m, i) => (
                  <div key={i} className={s.metaLine}>
                    {m}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className={s.controls} ref={setControls} data-test="header-controls">
          <div className={s.primary}>{p.primary}</div>
          <div className={s.actions}>{p.actions}</div>
        </div>
      </div>
      <div className={`${s.sticky} ${wide ? s.stickyBlock : ''} ${scrolled ? s.stickyOn : ''}`} aria-hidden={!scrolled} data-test={p.smallTestId}>
        {wide ? <div className={s.stickyBar}>{bar}</div> : bar}
      </div>
    </div>
  );
  // TIDAL's playlist header: an unpadded container around the padded header wrapper
  return wide ? (
    <div className={s.wideOuter} data-test={p.testId}>
      {body}
    </div>
  ) : (
    body
  );
}

/** "12 TRACKS (39:50)" style meta text: 10px/16px, 600, uppercase, 1.2px letter-spacing. */
export function MetaText({ children, testId, muted }: { children: ReactNode; testId?: string; muted?: boolean }) {
  return (
    <span className={`${s.metaText} ${muted ? s.metaMuted : ''}`} data-test={testId}>
      {children}
    </span>
  );
}
