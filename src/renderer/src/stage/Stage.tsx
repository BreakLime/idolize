// The stage: Now Playing's light show, made from the music (the default view; its header's Stage toggle switches to
// the plain cover). A WebGL canvas (LED wall, tunnel, lasers, glitch; director.ts decides) with the idol performing in
// the top left, cut out of it (the player background shows through it: with Transparent, the desktop), the lyrics
// under the album while they're sung, and in the calm parts the song's top YouTube comments (crowd.ts). It flashes on drops (at most 3 times a second, never with reduced motion) and loads each
// track once more in CD quality for its look-ahead (songmap.ts). Runs only while it's shown, the music plays and the
// window is visible (paused, it holds a still).
import { useEffect, useRef, useState } from 'react';
import { coverUrl } from '@/api/images';
import type { Track } from '@/api/models';
import { tracks as tracksApi } from '@/api/tidal';
import { DancingLogo } from '@/components/DancingLogo';
import { activeLine, parseLyrics } from '@/components/player/lyrics';
import { usePrefs } from '@/components/player/prefs';
import { idol as bridge } from '@/lib/bridge';
import { useQuery } from '@/lib/query';
import { outputLatency, playbackPosition } from '@/player/engine';
import { listen, listenPause, type Listening } from '@/player/listen';
import { celebrate, followStage, performerPose } from '@/player/logoDance';
import { upNext, usePlayer } from '@/state/player';
import { CrowdShow, type CrowdCard } from './crowd';
import { Director, type MapState } from './director';
import type { Peak } from './peak';
import { css, palette, type Rgb } from './palette';
import { StageRenderer, type IdolPlace, type WallPlace } from './renderer';
import { lastError, songMap, type SongMap } from './songmap';
import s from './Stage.module.css';

const DPR_CAP = 1.5;
const RAD = Math.PI / 180;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The line being sung at `pos` (-1: none; a line stays up about as long as it takes to sing, not through the
 * instrumental after it). */
function sungLine(lines: { t: number; text: string }[], pos: number) {
  const i = activeLine(lines, pos);
  if (i < 0) return -1;
  const words = lines[i].text.trim().split(/\s+/).filter(Boolean).length;
  if (!words) return -1;
  const end = Math.min(lines[i + 1]?.t ?? Infinity, lines[i].t + Math.max(3, 1.5 + 0.55 * words));
  return pos < end ? i : -1;
}

/** Debug/test handle: what the stage did last. */
export const stageDebug = {
  frames: 0,
  drops: 0,
  scale: 1,
  map: null as SongMap | null,
  failed: '',
  mapError: '',
  lines: 0,
  drive: 0,
  tension: 0,
  /** how big the show goes now (0 calm … 1 full), and whether the song is a gentle one */
  vigor: 0,
  gentle: false,
  /** where in the track the last drop fired (as heard) */
  dropAt: 0,
  /** the output delay taken off the playback position */
  latency: 0,
  lyrics: false,
  mode: '',
  /** the song's peak (the kaleidoscope and the burst), once its map is there */
  peak: null as Peak | null,
  shatter: 0,
  /** whether the idol is cut out of the canvas (the GL performer) */
  idol: false,
  /** which way the cover pulses: its light parts darker (a light cover) or its colours brighter */
  pulse: '',
  /** the song's YouTube comments: 'loading', 'off', 'none' (no video, or YouTube unreadable), or how many */
  crowd: 'off' as string,
  /** comments shown in this song so far */
  cards: 0,
  why: {} as Record<string, number>,
};

const WHITE: Rgb[] = [
  [1, 1, 1],
  [1, 1, 1],
  [1, 1, 1],
  [0, 0, 0],
];

/** The show of the current track: its director, its song map, and what the DOM side has shown of it. */
interface Show {
  director: Director;
  map: MapState;
  seenDrop: number;
  seenHit: number;
  shownLine: number;
  crowd: CrowdShow | null;
  /** where in the song the last drop fired */
  dropPos: number;
  card: number;
}

const likes = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const SPANS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536e6],
  ['month', 2592e6],
  ['week', 6048e5],
  ['day', 864e5],
  ['hour', 36e5],
  ['minute', 6e4],
];
/** "5 years ago", as YouTube says it (from when it was written, about) */
function ago(date: number) {
  const d = Date.now() - date;
  const [unit, ms] = SPANS.find(([, ms]) => d >= ms) ?? SPANS[SPANS.length - 1];
  return relative.format(-Math.max(1, Math.floor(d / ms)), unit);
}

/** A comment from the song's crowd, floating up beside the wall, its source on top (`room`: px between the stage's
 * edge and the wall). */
function Comment({ card, room }: { card: CrowdCard; room: number }) {
  // in the room beside the wall, as wide as fits (a narrow window: over the wall's edge)
  const width = Math.min(360, Math.max(220, room * 0.84));
  const inset = Math.max(12, (room - width) / 2);
  return (
    <div
      className={s.comment}
      data-side={card.side}
      data-test="stage-comment"
      style={{ top: `${card.top}%`, [card.side]: `${inset}px`, maxWidth: `${width}px`, '--life': `${card.life}s` } as React.CSSProperties}
    >
      <div className={s.commentSource} data-test="stage-comment-source">
        <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true">
          <rect width="14" height="10" rx="3" fill="currentColor" />
          <path d="M5.5 2.8v4.4L9.2 5z" fill="rgb(8, 8, 12)" />
        </svg>
        YouTube
      </div>
      <p className={s.commentText}>{card.comment.text}</p>
      <div className={s.commentBy}>
        <span className={s.commentWho}>
          {card.comment.author}
          {card.comment.date !== undefined && ` · ${ago(card.comment.date)}`}
        </span>
        <span className={s.commentLikes}>
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2 10h4v11H2zM8 21h9.3a2 2 0 0 0 2-1.6l1.6-7.4A2 2 0 0 0 19 9.5h-5.4l.9-4.3a1.6 1.6 0 0 0-2.9-1.2L8 10z" fill="currentColor" />
          </svg>
          {likes.format(card.comment.likes)}
        </span>
      </div>
    </div>
  );
}

export function Stage({ track, art }: { track: Track; art: React.RefObject<HTMLElement | null> }) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const words = useRef<HTMLDivElement>(null);
  const renderer = useRef<StageRenderer | null>(null);
  const show = useRef<Show | null>(null);
  const colours = useRef<Rgb[]>(WHITE);
  const still = useRef<() => void>(() => {});
  const { data: lyrics } = useQuery(`np:lyrics:${track.id}`, async () => parseLyrics(await tracksApi.lyrics(track.id)));
  const lines = lyrics?.timed ? lyrics.lines : null;
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const [line, setLine] = useState(-1);
  // the line on screen when a drop hit: its words burst apart
  const [burstLine, setBurstLine] = useState(-2);
  const [card, setCard] = useState<{ card: CrowdCard; room: number } | null>(null);

  // one renderer and one loop for the stage's whole life: a WebGL context once let go can't be had again on the same
  // canvas (each track only swaps the cover, the palette and the song map, below)
  useEffect(() => {
    const el = canvas.current!;
    const host = root.current!;
    let r: StageRenderer;
    try {
      r = new StageRenderer(el);
    } catch (e) {
      stageDebug.failed = e instanceof Error ? e.message : String(e);
      return;
    }
    stageDebug.failed = '';
    renderer.current = r;
    followStage(true);
    let raf = 0;
    let last = 0;
    let scale = 1;
    let slow = 0;
    let fast = 0;
    let lyricsOn = false;
    let heard: Listening | null = null;
    let under = '';

    const place = (): WallPlace => {
      const b = host.getBoundingClientRect();
      const a = art.current?.getBoundingClientRect() ?? b;
      const k = el.width / Math.max(1, b.width);
      return { cx: (a.left + a.width / 2 - b.left) * k, cy: (b.bottom - (a.top + a.height / 2)) * k, size: a.width * k };
    };
    const svg = host.querySelector<SVGSVGElement>('[data-test="stage-performer"]');
    const idol = (kick: number): IdolPlace | null => {
      if (!svg) return null;
      const b = host.getBoundingClientRect();
      const a = svg.getBoundingClientRect();
      if (!a.width) return null;
      const k = el.width / Math.max(1, b.width);
      const p = performerPose();
      // (outline and glow drawn for a 170 px figure, thinner on a smaller one)
      const z = Math.min(1, Math.max(0.1, a.width / 170));
      return {
        left: (a.left - b.left) * k,
        top: (b.bottom - a.top) * k,
        unit: (a.width / 24) * k,
        y: p.y,
        spin: p.spin * RAD,
        nod: p.nod,
        squash: p.squash,
        armL: p.armL * RAD,
        armR: p.armR * RAD,
        rim: (0.6 + 0.6 * z) * k,
        glow: (5 + 6 * kick) * (0.4 + 0.6 * z) * k,
      };
    };
    const resize = () => {
      const b = host.getBoundingClientRect();
      const d = Math.min(devicePixelRatio, DPR_CAP) * scale;
      const w = Math.max(1, Math.round(b.width * d));
      const h = Math.max(1, Math.round(b.height * d));
      if (el.width !== w || el.height !== h) {
        el.width = w;
        el.height = h;
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // 60 updates a second (high-refresh screens call more often)
      if (last && now - last < 1000 / 61) return;
      draw(now, last ? Math.min(0.1, (now - last) / 1000) : 1 / 60);
    };
    const draw = (now: number, dt: number) => {
      // too slow for a while: draw fewer pixels; quick again: more
      if (last) {
        if (dt > 0.024) {
          slow += dt;
          fast = 0;
        } else {
          fast += dt;
          slow = Math.max(0, slow - dt);
        }
        if (slow > 1 && scale > 0.5) {
          scale = Math.max(0.5, scale - 0.15);
          slow = 0;
        } else if (fast > 5 && scale < 1) {
          scale = Math.min(1, scale + 0.1);
          fast = 0;
        }
        stageDebug.scale = scale;
      }
      last = now;
      const sh = show.current;
      if (!sh) return;
      resize();
      const reduced = reducedMotion();
      // where the music is as heard: the position runs ahead of the speakers by the output's delay
      const pos = playbackPosition() - outputLatency();
      stageDebug.latency = outputLatency();
      // (a still reuses the last reading: the detector only follows the music while it plays)
      heard = dt > 0 || !heard ? listen(now) : heard;
      const state = sh.director.update(dt, heard, pos, sh.map, reduced, !!linesRef.current);
      if (!r.ready) return;
      const cut = idol(state.kick);
      r.render(state, place(), cut);
      if (host.dataset.gl !== 'on') host.dataset.gl = 'on';
      stageDebug.frames++;
      stageDebug.idol = !!cut;
      stageDebug.pulse = r.darkens ? 'darker' : 'brighter';
      stageDebug.peak = sh.director.peak;
      stageDebug.shatter = state.shatter;
      stageDebug.drive = state.drive;
      stageDebug.why = state.why;
      stageDebug.lyrics = state.lyrics;
      stageDebug.mode = state.tunnelMix > 0.5 ? 'tunnel' : 'wall';
      stageDebug.tension = state.tension;
      stageDebug.vigor = state.vigor;
      stageDebug.gentle = state.gentle;
      stageDebug.lines = linesRef.current?.length ?? 0;

      // the DOM side: the beat for the lyrics and performer, the lyrics' place under the album, the current line, the
      // drop's burst and jolt
      host.style.setProperty('--kick', state.kick.toFixed(3));
      const a = art.current?.getBoundingClientRect();
      if (a) {
        const b = host.getBoundingClientRect();
        const at = `${Math.round(a.left - b.left)} ${Math.round(a.bottom - b.top + 14)} ${Math.round(a.width)}`;
        if (at !== under) {
          under = at;
          const [x, y, w] = at.split(' ');
          host.style.setProperty('--lx', `${x}px`);
          host.style.setProperty('--ly', `${y}px`);
          host.style.setProperty('--lw', `${w}px`);
        }
      }
      host.style.setProperty('--tension', state.tension.toFixed(3));
      const ls = linesRef.current;
      const idx = ls ? sungLine(ls, pos + 0.15) : -1;
      if (idx !== sh.shownLine) {
        sh.shownLine = idx;
        setLine(idx);
      }
      if (state.lyrics !== lyricsOn) {
        lyricsOn = state.lyrics;
        words.current?.setAttribute('data-on', String(lyricsOn));
      }
      // the crowd: a comment whenever the show leaves room (beside the wall, never over the lyrics under it): not in a
      // build-up, the peak, a drop's first seconds or the loudest stretches
      const room = state.drive < 0.8 && state.tension < 0.2 && state.tunnelMix < 0.05 && state.shatter === 0 && pos - sh.dropPos > 6;
      const c = sh.crowd && usePrefs.getState().stageComments ? sh.crowd.update(pos, room) : null;
      if ((c?.key ?? 0) !== sh.card) {
        sh.card = c?.key ?? 0;
        if (c) stageDebug.cards++;
        const b = host.getBoundingClientRect();
        const a = art.current?.getBoundingClientRect();
        setCard(c && { card: c, room: a ? a.left - b.left : b.width * 0.3 });
      }
      if (state.drop !== sh.seenDrop) {
        sh.seenDrop = state.drop;
        sh.dropPos = pos;
        stageDebug.drops++;
        stageDebug.dropAt = pos;
      }
      // (a hard drop; a gentle song's only swells the light)
      if (state.hit !== sh.seenHit) {
        sh.seenHit = state.hit;
        setBurstLine(sh.shownLine);
        celebrate(); // the performer jumps with the show, not on its own reading
        if (!reduced) {
          const app = document.getElementById('root');
          app?.classList.remove(s.jolt);
          void app?.offsetWidth; // restart the animation
          app?.classList.add(s.jolt);
          setTimeout(() => app?.classList.remove(s.jolt), 450);
        }
      }
    };

    // paused: one still (a new cover, a resize), so the stage isn't left blank
    still.current = () => {
      if (!raf) draw(performance.now(), 0);
    };
    const resized = new ResizeObserver(() => still.current());
    resized.observe(host);

    // only while the music plays in a visible window
    const run = () => {
      const want = usePlayer.getState().playing && document.visibilityState === 'visible';
      // (a comment's float waits while the music does)
      if (want) delete host.dataset.paused;
      else host.dataset.paused = '';
      if (want && !raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      } else if (!want && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
        listenPause();
      }
    };
    run();
    const unsub = usePlayer.subscribe((st, prev) => {
      if (st.playing !== prev.playing) run();
    });
    document.addEventListener('visibilitychange', run);
    return () => {
      cancelAnimationFrame(raf);
      resized.disconnect();
      still.current = () => {};
      unsub();
      document.removeEventListener('visibilitychange', run);
      followStage(false);
      renderer.current = null;
      r.dispose();
    };
  }, [art]);

  // each track: a fresh director, the cover and its palette, the song map (and the next track's, so it's ready when
  // that one starts: until a map is there the show only follows the beat, nothing that could look like a drop)
  useEffect(() => {
    const host = root.current!;
    // (the last track's colours until this cover is in: no white flash at the change)
    const sh: Show = { director: new Director(colours.current, track.id), map: { status: 'loading' }, seenDrop: 0, seenHit: 0, shownLine: -1, crowd: null, dropPos: -Infinity, card: 0 };
    sh.director.reset(playbackPosition());
    show.current = sh;
    stageDebug.map = null;
    stageDebug.mapError = '';
    setLine(-1);
    setBurstLine(-2);
    setCard(null);
    stageDebug.cards = 0;
    let alive = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!alive) return;
      renderer.current?.setCover(img);
      const pal = palette(img);
      sh.director.palette = pal;
      colours.current = pal;
      host.style.setProperty('--stage-light', css(pal[0]));
      host.style.setProperty('--stage-glow', css(pal[1], 0.7));
      still.current();
    };
    // its own URL: the page's <img> of the same cover was cached without CORS, which would taint the canvas
    img.src = `${coverUrl(track.album.cover, 640) ?? ''}?stage`;
    void songMap(track.id).then((m) => {
      if (!alive) return;
      sh.map = m ? { status: 'ready', map: m } : { status: 'failed' };
      stageDebug.map = m;
      stageDebug.mapError = m ? '' : lastError;
      const next = upNext(usePlayer.getState())[0];
      if (next) void songMap(next.track.id);
    });
    // the crowd (and the next song's, so it's there when that one starts)
    const ask = (t: Track) => bridge.crowd.comments({ trackId: t.id, artist: t.artists[0]?.name ?? '', title: t.title, version: t.version, duration: t.duration });
    if (usePrefs.getState().stageComments) {
      stageDebug.crowd = 'loading';
      void ask(track).then((c) => {
        if (!alive) return;
        sh.crowd = c?.comments.length ? new CrowdShow(c.comments) : null;
        stageDebug.crowd = sh.crowd ? String(sh.crowd.size) : 'none';
        const next = upNext(usePlayer.getState())[0];
        if (next) void ask(next.track);
      });
    } else stageDebug.crowd = 'off';
    return () => {
      alive = false;
    };
  }, [track.id, track.album.cover]);

  const text = lines && line >= 0 ? lines[line].text.trim() : '';
  const lineLen = lines && line >= 0 ? Math.max(0.6, (lines[line + 1]?.t ?? lines[line].t + 4) - lines[line].t) : 3;
  const parts = text ? text.split(/\s+/) : [];
  const step = Math.min(0.18, (lineLen * 0.6) / Math.max(1, parts.length));

  return (
    <div className={s.stage} ref={root} data-test="stage" aria-hidden="true">
      {/* the drop's colour split for the jolt: red one way, blue the other */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <filter id="stage-split" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feOffset in="SourceGraphic" dx="-6" result="l" />
          <feColorMatrix in="l" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
          <feOffset in="SourceGraphic" dx="6" result="r" />
          <feColorMatrix in="r" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
          <feBlend in="red" in2="green" mode="screen" result="rg" />
          <feBlend in="rg" in2="blue" mode="screen" />
        </filter>
      </svg>
      <div className={s.night} />
      <canvas className={s.canvas} ref={canvas} />
      <div className={s.lyrics} ref={words} data-on="false" data-test="stage-lyrics">
        <div className={s.line} key={line} data-burst={burstLine === line ? '' : undefined}>
          {parts.map((w, i) => (
            <span
              key={i}
              className={s.word}
              style={
                {
                  '--d': `${(i * step).toFixed(2)}s`,
                  '--bx': `${Math.round((Math.random() - 0.5) * 600)}px`,
                  '--by': `${Math.round((Math.random() - 0.7) * 400)}px`,
                  '--br': `${Math.round((Math.random() - 0.5) * 90)}deg`,
                } as React.CSSProperties
              }
            >
              {w}
            </span>
          ))}
        </div>
      </div>
      {card && <Comment key={card.card.key} card={card.card} room={card.room} />}
      <div className={s.performer}>
        <DancingLogo performer />
      </div>
    </div>
  );
}
