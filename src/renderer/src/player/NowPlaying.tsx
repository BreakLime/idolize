// Full-window Now Playing view: vibrant backdrop (or the desktop), big artwork and the Similar tracks / Credits / Lyrics panels.
// Stays mounted so it can slide in/out; heavy panel content only renders while open.
import { useEffect, useRef, useState } from 'react';
import { coverUrl } from '@/api/images';
import type { Track } from '@/api/models';
import { albums } from '@/api/tidal';
import { Icon } from '@/components/Icon';
import { ExpandIcon, ShrinkIcon } from '@/components/icons/player';
import { CreditsPanel, LyricsPanel, SimilarPanel } from '@/components/player/NowPlayingPanels';
import { setPrefs, usePrefs, type PlayerBackground } from '@/components/player/prefs';
import { idol } from '@/lib/bridge';
import { useQuery } from '@/lib/query';
import { currentTrack, usePlayer } from '@/state/player';
import { useUi } from '@/state/ui';
import { useWindowState } from '@/state/window';
import { Stage } from '@/stage/Stage';
import s from './NowPlaying.module.css';

type Panel = 'related' | 'credits' | 'lyrics';
const TOGGLES: { id: Panel; label: string; test: string }[] = [
  { id: 'related', label: 'Similar tracks', test: 'toggle-similar-tracks' },
  { id: 'credits', label: 'Credits', test: 'toggle-credits' },
  { id: 'lyrics', label: 'Lyrics', test: 'toggle-lyrics' },
];

/** Album vibrant color (fetched when the track payload lacks it), darkened like TIDAL's backdrop. */
function useBackdrop(track: Track | undefined, open: boolean) {
  const known = track?.album.vibrantColor;
  const albumId = track?.album.id;
  const { data } = useQuery(open && !known && albumId ? `np:album:${albumId}` : null, () => albums.get(albumId!));
  const color = known ?? data?.vibrantColor ?? null;
  // same hue and chroma, lightness pinned (measured: #a8c6e9 → rgb(56, 80, 107))
  return color ? `oklch(from ${color} 0.4236 calc(c * 0.91) h)` : 'rgb(36, 36, 41)';
}

function useFullscreen() {
  const [fs, setFs] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggle = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
  return [fs, toggle] as const;
}

/** The player background in effect: Transparent needs a see-through window (else Color). */
function usePlayerBackground(): PlayerBackground {
  const pref = usePrefs((p) => p.playerBackground);
  const opaque = useWindowState((w) => w.transparency === 'off');
  return pref === 'transparent' && opaque ? 'color' : pref;
}

// the window goes back to its own backdrop once the close animation has run (the desktop stays visible meanwhile)
let acrylicOff: number | undefined;
function windowAcrylic(on: boolean) {
  clearTimeout(acrylicOff);
  if (on) idol.window.setNowPlayingAcrylic(true);
  else acrylicOff = window.setTimeout(() => idol.window.setNowPlayingAcrylic(false), 450);
}

export function NowPlaying() {
  const open = useUi((st) => st.nowPlayingOpen);
  const tab = useUi((st) => st.nowPlayingTab);
  const track = usePlayer(currentTrack);
  const [fullscreen, toggleFullscreen] = useFullscreen();
  const backdrop = useBackdrop(track, open);
  const panel: Panel | null = tab === 'playing' ? null : tab;
  // keep the content rendered while the close animation runs
  const [rendered, setRendered] = useState(open);
  useEffect(() => {
    if (open) return setRendered(true);
    const t = setTimeout(() => setRendered(false), 450);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.fullscreenElement) return;
      if ((e.target as HTMLElement)?.closest('input, textarea, [role="dialog"], [role="menu"]')) return;
      // the artist card first, then the view
      if (useUi.getState().artistCardId !== null) useUi.setState({ artistCardId: null });
      else useUi.setState({ nowPlayingOpen: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // leaving Now Playing also leaves full screen, and the artist card starts hidden the next time
  useEffect(() => {
    if (open) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    useUi.setState({ artistCardId: null });
  }, [open]);

  // nothing to show without a track
  useEffect(() => {
    if (open && !track) useUi.setState({ nowPlayingOpen: false });
  }, [open, track]);

  // over the desktop: the app underneath fades out (root flag) and, for Acrylic, the window turns acrylic meanwhile
  const look = usePlayerBackground();
  const glass = look === 'transparent' || look === 'acrylic';
  useEffect(() => {
    document.documentElement.dataset.npGlass = String(open && glass);
  }, [open, glass]);
  useEffect(() => {
    if (!open || look !== 'acrylic') return;
    windowAcrylic(true);
    return () => windowAcrylic(false);
  }, [open, look]);

  // the stage: the light show instead of the plain cover (the default; the header's toggle switches, remembered)
  const stageView = usePrefs((p) => p.stageView);
  const staging = stageView && open && !panel && !!track;
  const art = useRef<HTMLDivElement>(null);

  const close = () => useUi.setState({ nowPlayingOpen: false });
  const toggle = (p: Panel) => useUi.setState({ nowPlayingTab: panel === p ? 'playing' : p });
  const style = { '--np-bg': backdrop } as React.CSSProperties;
  const bg = (
    <div className={`${s.bg} ${glass ? s.bgGlass : ''}`}>
      {look === 'blur' && track?.album.cover && <img className={s.blurImg} src={coverUrl(track.album.cover, 320)} alt="" draggable={false} />}
    </div>
  );

  return (
    <>
      <section className={`${s.backdrop} ${open ? s.open : ''}`} data-test="new-now-playing" style={style} aria-hidden="true">
        {bg}
      </section>
      <section className={`${s.np} ${open ? s.open : ''} ${fullscreen ? s.fullscreen : ''}`} data-test="new-now-playing" style={style} aria-hidden={!open}>
        {bg}
        {staging && track && <Stage track={track} art={art} />}
        <header className={s.header}>
          <div className={s.leftContent} />
          <div className={s.buttons}>
            <div className={s.toggles}>
              <button
                type="button"
                className={`${s.toggle} ${stageView ? s.toggleOn : ''}`}
                data-test="toggle-stage"
                aria-pressed={stageView}
                title="A light show made from the music (off: the plain cover)"
                tabIndex={open ? 0 : -1}
                onClick={() => setPrefs({ stageView: !stageView })}
              >
                <span>Stage</span>
              </button>
              {TOGGLES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`${s.toggle} ${panel === t.id ? s.toggleOn : ''}`}
                  data-test={t.test}
                  aria-pressed={panel === t.id}
                  tabIndex={open ? 0 : -1}
                  onClick={() => toggle(t.id)}
                >
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
            <div className={s.actionButtons}>
              <button
                type="button"
                className={s.iconBtn}
                data-test="new-now-playing-expand"
                aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
                title={fullscreen ? 'Exit full screen' : 'Full screen'}
                tabIndex={open ? 0 : -1}
                onClick={toggleFullscreen}
              >
                {fullscreen ? <ShrinkIcon size={16} /> : <ExpandIcon size={16} />}
              </button>
              <button
                type="button"
                className={s.iconBtn}
                data-test="new-now-playing-close"
                aria-label="Close"
                title="Close"
                tabIndex={open ? 0 : -1}
                onClick={close}
              >
                <Icon name="chevron-down" size={16} />
              </button>
            </div>
          </div>
        </header>
        <div className={s.content}>
          <div className={`${s.inner} ${panel ? s.shifted : ''} ${staging ? s.staged : ''}`}>
            <div className={s.artworkWrapper}>
              <div className={s.artworkContainer} ref={art}>
                {track && (
                  <img
                    className={`${s.artwork} ${staging ? s.artworkStaged : ''}`}
                    data-test="now-playing-artwork"
                    src={coverUrl(track.album.cover, 694)}
                    alt=""
                    draggable={false}
                  />
                )}
              </div>
            </div>
            <div className={`${s.panelWrapper} ${panel ? s.panelActive : ''}`}>
              {rendered && track && panel && (
                <div className={s.panelContent} key={`${panel}-${track.id}`}>
                  {panel === 'credits' && <CreditsPanel track={track} />}
                  {panel === 'related' && <SimilarPanel track={track} />}
                  {panel === 'lyrics' && <LyricsPanel track={track} />}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
