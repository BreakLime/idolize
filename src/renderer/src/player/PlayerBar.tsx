import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { coverUrl } from '@/api/images';
import { formatDuration, trackTitle } from '@/api/models';
import { Artwork } from '@/components/Artwork';
import { Icon, type IconName } from '@/components/Icon';
import { trackMenu } from '@/components/menus';
import { QualityBadge } from '@/components/Badges';
import { ArtistInfoCard } from '@/components/player/ArtistInfoCard';
import { toggleFavorite, useIsFavorite } from '@/state/favorites';
import { currentTrack, player, usePlayer } from '@/state/player';
import { toggleArtistCard, useUi } from '@/state/ui';
import { startAutoplay } from './autoplay';
import s from './PlayerBar.module.css';

/** what in the bar does its own thing on a click (everything else opens Now Playing) */
const CONTROLS = 'button, a, input, [role="slider"], [data-test="progress-bar"], [data-test="volume-popover"]';

function Progress() {
  const t = usePlayer((st) => st.currentTime);
  const d = usePlayer((st) => st.duration);
  const bar = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const frac = (x: number) => {
    const r = bar.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (x - r.left) / r.width));
  };
  const shown = drag ?? (d ? Math.min(1, t / d) : 0);
  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag(frac(e.clientX));
  };
  const onUp = (e: React.PointerEvent) => {
    if (drag === null) return;
    player.seek(frac(e.clientX) * d);
    setDrag(null);
  };
  return (
    <div className={s.progressRow}>
      <p className={s.time}>
        <time data-test="current-time">{formatDuration(drag !== null ? drag * d : t)}</time>
      </p>
      <div className={s.progressOuter}>
        <div className={`${s.progress} ${drag !== null ? s.dragging : ''}`} data-test="progress-bar" ref={bar}>
          <div className={s.track}>
            <div className={s.fill} data-test="progress-indicator" style={{ transform: `translateX(${(shown - 1) * 100}%)` }} />
          </div>
          <div className={s.thumb} style={{ left: `calc(${shown * 100}% - 6px)` }} />
          {hover !== null && (
            <div className={s.tooltip} style={{ left: `${hover * 100}%` }}>
              {formatDuration(hover * d)}
            </div>
          )}
          <div
            className={s.interaction}
            data-test="interaction-layer"
            onPointerDown={onDown}
            onPointerMove={(e) => {
              setHover(frac(e.clientX));
              if (drag !== null) setDrag(frac(e.clientX));
            }}
            onPointerUp={onUp}
            onPointerLeave={() => setHover(null)}
          />
        </div>
      </div>
      <p className={s.time}>
        <time data-test="duration">{formatDuration(d)}</time>
      </p>
    </div>
  );
}

/** Speaker button with TIDAL's vertical slider popover above it (shown on hover). */
function Volume() {
  const volume = usePlayer((st) => st.volume);
  const muted = usePlayer((st) => st.muted);
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const v = muted ? 0 : volume;
  const icon: IconName = v === 0 ? 'volume-off' : v < 0.34 ? 'volume-low' : v < 0.67 ? 'volume-mid' : 'volume-high';
  const set = (y: number) => {
    const r = ref.current!.getBoundingClientRect();
    player.setVolume(1 - (y - r.top) / r.height);
  };
  const show = () => {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 250);
  };
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  return (
    <div className={s.volume} onMouseEnter={show} onMouseLeave={() => !dragging && hide()} onWheel={(e) => player.setVolume(v - Math.sign(e.deltaY) * 0.05)}>
      <div className={`${s.volPopover} ${open || dragging ? s.volOpen : ''}`} data-test="volume-popover">
        <div
          className={s.volTrack}
          ref={ref}
          data-test="volume-slider"
          role="slider"
          aria-label="Volume"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(v * 100)}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            setDragging(true);
            set(e.clientY);
          }}
          onPointerMove={(e) => dragging && set(e.clientY)}
          onPointerUp={() => setDragging(false)}
        >
          <div className={s.volRail}>
            <div className={s.volFill} style={{ height: `${v * 100}%` }} />
          </div>
          <div className={s.volThumb} style={{ bottom: `calc(${v * 100}% - 6px)` }} />
        </div>
      </div>
      <button
        type="button"
        className={`${s.small} ${open ? s.hot : ''}`}
        data-test="volume"
        aria-label="Volume"
        title="Volume"
        role="switch"
        aria-checked={!muted}
        onClick={player.toggleMute}
      >
        <Icon name={icon} size={16} testId={`icon--player__${icon}`} />
      </button>
    </div>
  );
}

export function PlayerBar() {
  useEffect(startAutoplay, []);
  const track = usePlayer(currentTrack);
  const playing = usePlayer((st) => st.playing);
  const buffering = usePlayer((st) => st.buffering);
  const shuffle = usePlayer((st) => st.shuffle);
  const repeat = usePlayer((st) => st.repeat);
  const stream = usePlayer((st) => st.stream);
  const source = usePlayer((st) => st.source);
  const fav = useIsFavorite(track);
  const queueOpen = useUi((st) => st.queueOpen);
  const nowPlayingOpen = useUi((st) => st.nowPlayingOpen);
  const artistCardId = useUi((st) => st.artistCardId);
  const fromLabel = source?.title || track?.album.title;
  const fromPath = source?.path ?? (track ? `/album/${track.album.id}` : '/');
  // the bar is Now Playing's handle: a click on it (not on its controls, sliders or links, nor the end of a drag that
  // began on one) opens it, or closes it again
  const press = useRef<{ x: number; y: number; onControl: boolean } | null>(null);
  const onControl = (t: EventTarget) => t instanceof Element && !!t.closest(CONTROLS);

  return (
    <div
      className={`${s.bar} ${nowPlayingOpen ? s.np : ''} ${track ? s.handle : ''}`}
      data-test="footer-player"
      onPointerDown={(e) => {
        press.current = { x: e.clientX, y: e.clientY, onControl: onControl(e.target) };
      }}
      onClick={(e) => {
        const p = press.current;
        press.current = null;
        if (!track || !p || p.onControl || onControl(e.target) || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) return;
        useUi.setState({ nowPlayingOpen: !nowPlayingOpen, nowPlayingTab: 'playing' });
      }}
    >
      <div className={s.veil} />
      <div className={s.left} data-test="track-info">
        {track && (
          <>
            <button
              type="button"
              className={s.cover}
              data-test="player-details-toggle-now-playing"
              aria-label="Now Playing"
              tabIndex={nowPlayingOpen ? -1 : 0}
              onClick={() => useUi.setState({ nowPlayingOpen: !nowPlayingOpen, nowPlayingTab: 'playing' })}
            >
              <Artwork src={coverUrl(track.album.cover, 52)} size={52} radius={2} testId="current-media-imagery" style={{ backgroundColor: 'transparent' }} />
              <Icon name="chevron-up" size={20} className={s.coverIcon} />
            </button>
            <div className={s.meta}>
              <div className={s.texts}>
                <div className={s.title} data-test="footer-track-title">
                  <Link to={`/track/${track.id}`} className="ellipsis link">
                    <span>{trackTitle(track)}</span>
                  </Link>
                </div>
                <div className={s.artistRow}>
                  <span data-test="footer-artist-name" className={`${s.sub} ellipsis`}>
                    {track.artists.map((a, i) => (
                      <span key={`${a.id}-${i}`}>
                        {i > 0 && ', '}
                        <Link
                          to={`/artist/${a.id}`}
                          className="link"
                          data-test="grid-item-detail-text-title-artist"
                          data-artist-card={nowPlayingOpen ? '' : undefined}
                          aria-expanded={nowPlayingOpen ? artistCardId === a.id : undefined}
                          title={a.name}
                          onClick={(e) => {
                            // in Now Playing the name opens the artist's card (which links to the page)
                            if (!nowPlayingOpen) return;
                            e.preventDefault();
                            toggleArtistCard(a.id);
                          }}
                        >
                          {a.name}
                        </Link>
                      </span>
                    ))}
                  </span>
                </div>
                <span className={s.from}>
                  <span className={`${s.sub} ellipsis`}>
                    <Link to={fromPath} className="link">
                      {fromLabel}
                    </Link>
                  </span>
                </span>
                <ArtistInfoCard track={track} />
              </div>
              <div className={s.actions}>
                <button
                  type="button"
                  className={`${s.tiny} ${fav ? s.on : ''}`}
                  data-test="footer-favorite-button"
                  role="switch"
                  aria-checked={fav}
                  aria-label={fav ? 'Remove from My Collection' : 'Add to My Collection'}
                  onClick={() => void toggleFavorite(track)}
                >
                  <Icon name={fav ? 'heart-filled' : 'heart'} size={14} testId="icon--general__heart" />
                </button>
                <button
                  type="button"
                  className={s.tiny}
                  data-test="footer-context-menu"
                  aria-label="Show options"
                  title="Show options"
                  onClick={(e) => trackMenu(e.currentTarget, track)}
                >
                  <Icon name="more" size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className={s.center}>
        <div className={s.controls} data-test="play-controls">
          <button
            type="button"
            className={`${s.small} ${shuffle ? s.on : ''}`}
            data-test="shuffle"
            aria-label="Shuffle"
            title="Shuffle"
            onClick={player.toggleShuffle}
          >
            <Icon name="shuffle" size={16} />
          </button>
          <div className={s.transport}>
            <button type="button" className={s.big} data-test="previous" aria-label="Previous" title="Previous" onClick={player.previous}>
              <Icon name="previous" size={16} />
            </button>
            <button
              type="button"
              className={`${s.big} ${s.play}`}
              data-test="play"
              aria-label={playing ? 'Pause' : 'Play'}
              title={playing ? 'Pause' : 'Play'}
              onClick={player.toggle}
            >
              <Icon name={playing ? 'pause' : 'play'} size={22} testId={playing ? 'icon--player__pause' : 'icon--player__play'} />
              {buffering && playing && <span className={s.spinner} />}
            </button>
            <button type="button" className={s.big} data-test="next" aria-label="Next" title="Next" onClick={() => player.next()}>
              <Icon name="next" size={16} />
            </button>
          </div>
          <button
            type="button"
            className={`${s.small} ${repeat !== 'off' ? s.on : ''}`}
            data-test="repeat"
            aria-label={`Repeat ${repeat}`}
            title="Repeat"
            onClick={player.cycleRepeat}
          >
            <Icon name={repeat === 'one' ? 'repeat-one' : 'repeat'} size={16} testId="icon--player__repeat" />
          </button>
        </div>
        <Progress />
      </div>

      <div className={s.right}>
        <div className={s.rightButtons}>
          <button
            type="button"
            className={`${s.small} ${s.withBg} ${queueOpen ? s.active : ''}`}
            data-test="play-queue-button"
            aria-label="Play queue"
            title="Play queue"
            onClick={() => useUi.setState({ queueOpen: !queueOpen })}
          >
            <Icon name="queue" size={16} />
          </button>
          {/* TIDAL's sound-output slot holds our lyrics shortcut (devices/Connect are out of scope) */}
          <button
            type="button"
            className={s.small}
            data-test="lyrics-button"
            aria-label="Lyrics"
            title="Lyrics"
            onClick={() => useUi.setState({ nowPlayingOpen: true, nowPlayingTab: 'lyrics' })}
          >
            <Icon name="lyrics" size={16} />
          </button>
          <Volume />
          <button
            type="button"
            className={s.small}
            data-test="enter-compact-mode"
            aria-label="Now Playing"
            title="Now Playing"
            onClick={() => useUi.setState({ nowPlayingOpen: !nowPlayingOpen, nowPlayingTab: 'playing' })}
          >
            <Icon name="mini-player" size={16} />
          </button>
        </div>
        <div className={s.badge}>{stream && <QualityBadge stream={stream} />}</div>
      </div>
    </div>
  );
}
