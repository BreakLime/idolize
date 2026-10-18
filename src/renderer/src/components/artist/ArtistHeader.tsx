// Artist hero: full-bleed picture (centre image + darkened side copies, blurred fade), name, fans, bio excerpt,
// website, Play/Shuffle + Follow/Artist radio/Share/Report/More — plus the compact bar shown once scrolled.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { artistUrl } from '@/api/images';
import type { Artist, Track } from '@/api/models';
import { PillButton } from '@/components/Buttons';
import { Icon, type IconName } from '@/components/Icon';
import { useIsFavorite } from '@/state/favorites';
import { player, usePlayer } from '@/state/player';
import type { ArtistHeaderInfo } from './artistApi';
import { artistActions, type ArtistActionHandlers } from './artistActions';
import { bioExcerpt } from './bio';
import { fansLabel, hostOf } from './format';
import s from './ArtistHeader.module.css';

function Action({
  icon,
  label,
  testId,
  onClick,
  active,
  className,
}: {
  icon: IconName;
  label: ReactNode;
  testId: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button type="button" className={`${s.action} ${active ? s.actionActive : ''} ${className ?? ''}`} data-test={testId} onClick={onClick}>
      <Icon name={icon} size={20} />
      <span className={s.actionLabel}>{label}</span>
    </button>
  );
}

export interface ArtistHeaderProps extends ArtistActionHandlers {
  id: string;
  info: ArtistHeaderInfo;
  artist: Artist;
  tracks: Track[];
  onReadMore: () => void;
}

export function ArtistHeader(p: ArtistHeaderProps) {
  const { info, artist } = p;
  const following = useIsFavorite(artist);
  const source = { type: 'artist' as const, id: p.id, title: info.name, path: `/artist/${p.id}` };
  const playingHere = usePlayer((st) => st.playing && st.source?.type === 'artist' && st.source.id === p.id);
  const controls = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = controls.current;
    const root = document.getElementById('main-scroll');
    if (!el || !root) return;
    // the compact bar covers the top 168px of the content area
    const io = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting && e.boundingClientRect.top < root.getBoundingClientRect().top + 168), {
      root,
      rootMargin: '-168px 0px 0px 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const play = (shuffle = false) => {
    if (!p.tracks.length) return;
    if (!shuffle && playingHere) return player.toggle();
    player.playList(p.tracks, 0, source, { shuffle });
  };
  const img = artistUrl(info.picture, 575);
  const bio = info.biography ? bioExcerpt(info.biography) : '';
  const actions = artistActions(p);

  const radio = (testId: string) =>
    info.mixId ? (
      <Link to={`/mix/${info.mixId}`} className={s.radio} data-test={testId}>
        <Icon name="radio" size={20} />
        <span className={s.radioLabel}>Artist radio</span>
      </Link>
    ) : (
      <button type="button" className={s.radio} data-test={testId} onClick={() => void actions.radio()}>
        <Icon name="radio" size={20} />
        <span className={s.radioLabel}>Artist radio</span>
      </button>
    );

  const rest = (
    <>
      <Action icon={following ? 'check' : 'plus'} label={following ? 'Following' : 'Follow'} testId="favorite-button" active={following} onClick={() => void actions.follow()} />
      {radio('mix-button')}
      <Action icon="share" label="Share" testId="share-button" onClick={(e) => actions.share(e.currentTarget)} />
      <Action icon="report" label="Report" testId="report-button" onClick={(e) => actions.report(e.currentTarget)} />
    </>
  );
  const more = <Action icon="more" label="More" testId="more-button" className={s.more} onClick={(e) => void actions.more(e.currentTarget)} />;

  return (
    <>
      <div className={s.header} data-test="artist-profile-header">
        <div className={s.headerContainer}>
          <div className={s.background} aria-hidden="true" style={img ? ({ '--img': `url("${img}")` } as React.CSSProperties) : undefined}>
            <div className={s.backgroundBlur} />
            {img && (
              <>
                <div className={s.image} />
                <div className={`${s.image} ${s.mainImage}`} />
                <div className={s.image} />
              </>
            )}
          </div>
          <div className={s.data}>
            <div className={s.detail}>
              <div className={s.nameRow}>
                <h2 className={s.name} data-test="artist-name">
                  {info.name}
                </h2>
              </div>
              <div className={s.meta} data-test="artist-meta">
                <button type="button" className={s.fans} data-test="follow-text-button" onClick={() => void actions.follow()}>
                  <span>{fansLabel(info.fans)}</span>
                </button>
              </div>
              {bio && (
                <div>
                  <div className={s.biography} data-test="biography">
                    <span>{bio}</span>
                  </div>
                  <button type="button" className={s.textLink} onClick={p.onReadMore}>
                    <span>Read more</span>
                  </button>
                </div>
              )}
              {info.website && (
                <div>
                  <button type="button" className={s.textLink} onClick={() => window.open(info.website!, '_blank')}>
                    <span>{hostOf(info.website)}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className={s.controlsWrap} data-test="header-controls-wrapper" ref={controls}>
            <div className={s.primary}>
              <PillButton icon={playingHere ? 'pause' : 'play'} testId="play-all" className={s.pill} onClick={() => play()} disabled={!p.tracks.length}>
                {playingHere ? 'Pause' : 'Play'}
              </PillButton>
              <PillButton icon="shuffle" variant="secondary" testId="shuffle-all" className={s.pill} onClick={() => play(true)} disabled={!p.tracks.length}>
                Shuffle
              </PillButton>
            </div>
            <div className={s.buttons} data-test="header-controls">
              <div className={s.overflow}>{rest}</div>
              {more}
            </div>
          </div>
        </div>
      </div>

      <div className={`${s.small} ${scrolled ? s.smallOn : ''}`} aria-hidden={!scrolled}>
        {info.picture ? <img className={s.smallImage} src={artistUrl(info.picture, 64)} alt="" data-test="cover-art" /> : <span className={s.smallImage} data-test="cover-art" />}
        <div className={s.smallText}>
          <h2 className={`${s.smallTitle} ellipsis`} data-test="title">
            {info.name}
          </h2>
        </div>
        <div className={`${s.buttons} ${s.buttonsScrolled}`} data-test="header-controls-scrolled">
          <div className={s.overflow}>
            <Action icon={playingHere ? 'pause' : 'play'} label={playingHere ? 'Pause' : 'Play'} testId="play-all-scrolled" onClick={() => play()} />
            <Action icon="shuffle" label="Shuffle" testId="shuffle-all-scrolled" onClick={() => play(true)} />
            {rest}
          </div>
          {more}
        </div>
      </div>
    </>
  );
}
