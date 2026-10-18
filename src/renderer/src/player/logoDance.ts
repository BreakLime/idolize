// The dancing logo: while music plays, the idol in the sidebar grooves on the beat (an analyser on the playing audio →
// the groove detector), crouches with raised arms in a build-up and jumps or, rarely, spins on a drop. Minimal by design:
// a nod of up to 2 px, arms swaying up to 18°. Runs only while something plays in a visible window, and not with reduced
// motion or the setting off.
import { usePrefs } from '@/components/player/prefs';
import { usePlayer } from '@/state/player';
import type { GrooveFrame } from './groove';
import { listen, listenPause, listenPrepare } from './listen';

export interface LogoParts {
  root: SVGGElement;
  head: SVGGElement;
  body: SVGGElement;
  armL: SVGGElement;
  armR: SVGGElement;
}

export interface Pose {
  y: number;
  spin: number;
  nod: number;
  squash: number;
  armL: number;
  armR: number;
}

const REST: Pose = { y: 0, spin: 0, nod: 0, squash: 0, armL: 0, armR: 0 };
const MOVE_MS = 650;

/** the sidebar's logos follow the Dancing logo setting; the stage's performer dances whenever the stage runs */
const logos = new Map<LogoParts, { performer: boolean }>();
const pose: Pose = { ...REST };
let move: { kind: 'jump' | 'spin'; start: number } | null = null;
let raf = 0;
let lastT = 0;
let wired = false;
let seenDrops = -1;
/** while the stage is shown, its drops (on the song map) lead the moves, not the live detector's */
let stageLeads = false;
// for tests and tools: what the detector saw last, and how many drops so far
let lastFrame: GrooveFrame | null = null;
let lastLevels: { bass: number; full: number } | null = null;
let drops = 0;

export const danceDebug = () => ({ running: raf !== 0, frame: lastFrame, levels: lastLevels, drops, pose: { ...pose } });

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const allowed = (o: { performer: boolean }) => o.performer || usePrefs.getState().dancingLogo;
const enabled = () => !reducedMotion() && [...logos.values()].some(allowed);
const wanted = () => enabled() && usePlayer.getState().playing && document.visibilityState === 'visible';

/** What the figure does in this frame of the music (arms rotate clockwise in degrees: + raises the left arm). */
function target(g: GrooveFrame | null, now: number): Pose {
  const p: Pose = { ...REST };
  if (g) {
    const pulse = Math.exp(-g.sinceKick / 0.12); // the nod: on each kick, back up within a beat
    const sway = Math.cos(Math.PI * (g.beatIndex + g.phase)); // the arms in turn, over two beats
    const lift = 25 * g.buildup;
    p.y = 1.2 * g.buildup; // crouch
    p.nod = 2.5 * g.intensity * pulse;
    p.squash = 0.08 * g.intensity * pulse;
    p.armL = 18 * g.intensity * sway + lift;
    p.armR = 18 * g.intensity * sway - lift;
  }
  if (move) {
    const u = (now - move.start) / MOVE_MS;
    if (u >= 1) move = null;
    else {
      const arc = Math.sin(Math.PI * u);
      if (move.kind === 'jump') {
        p.y -= 3 * arc;
        p.armL += (40 - p.armL) * arc;
        p.armR += (-40 - p.armR) * arc;
      } else {
        p.y -= 1 * arc;
        p.spin = 360 * (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
      }
    }
  }
  return p;
}

const r = (v: number) => Math.round(v * 100) / 100;

function apply() {
  for (const [l, o] of logos) {
    const p = allowed(o) ? pose : REST;
    l.root.setAttribute('transform', `translate(0 ${r(p.y)}) rotate(${r(p.spin)} 12 12)`);
    l.head.setAttribute('transform', `translate(0 ${r(p.nod)})`);
    // squashed toward the feet (y 20.5)
    l.body.setAttribute('transform', `translate(0 ${r(20.5 * p.squash)}) scale(1 ${r(1 - p.squash)})`);
    l.armL.setAttribute('transform', `rotate(${r(p.armL)} 8.5 14.5)`);
    l.armR.setAttribute('transform', `rotate(${r(p.armR)} 15.5 14.5)`);
  }
}

const atRest = () => !move && (Object.keys(REST) as (keyof Pose)[]).every((k) => Math.abs(pose[k]) < 0.01);

function frame(now: number) {
  raf = 0;
  // 60 updates a second are plenty for a 24px figure (high-refresh screens call more often)
  if (lastT && now - lastT < 1000 / 61) {
    raf = requestAnimationFrame(frame);
    return;
  }
  const dt = lastT ? (now - lastT) / 1000 : 1 / 60;
  lastT = now;
  const on = wanted();
  let g: GrooveFrame | null = null;
  if (on) {
    const l = listen(now);
    g = l.frame;
    lastFrame = g;
    lastLevels = { bass: l.bands.bass, full: l.bands.full };
    drops = l.drops;
    if (!stageLeads && seenDrops >= 0 && l.drops > seenDrops && !move) move = { kind: Math.random() < 0.25 ? 'spin' : 'jump', start: now };
    seenDrops = l.drops;
  } else move = null;
  const t = target(g, now);
  // ease toward it (the nod snappier; the spin is exact)
  const k = 1 - Math.exp(-dt / 0.06);
  const snap = 1 - Math.exp(-dt / 0.03);
  for (const key of ['y', 'squash', 'armL', 'armR'] as const) pose[key] += (t[key] - pose[key]) * k;
  pose.nod += (t.nod - pose.nod) * snap;
  pose.spin = t.spin;
  if (!on && atRest()) Object.assign(pose, REST);
  apply();
  if (on || !atRest()) raf = requestAnimationFrame(frame);
  else {
    lastT = 0;
    listenPause();
  }
}

function kick() {
  if (!raf && (wanted() || !atRest())) raf = requestAnimationFrame(frame);
}

function wire() {
  if (wired) return;
  wired = true;
  usePlayer.subscribe((s, prev) => {
    if (s.playing !== prev.playing) kick();
  });
  usePrefs.subscribe(kick);
  document.addEventListener('visibilitychange', kick);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', kick);
}

/** A logo on screen joins the dance (`performer`: the stage's, whatever the setting); returns its unregister. */
export function registerLogo(parts: LogoParts, performer = false) {
  wire();
  logos.set(parts, { performer });
  if (enabled()) listenPrepare();
  apply();
  kick();
  return () => {
    logos.delete(parts);
  };
}

/** The stage takes over the drops (on), or gives them back to the live detector (off). */
export function followStage(on: boolean) {
  stageLeads = on;
}

/** A drop on the stage: the jump (or the spin) now. */
export function celebrate() {
  if (move || reducedMotion()) return;
  move = { kind: Math.random() < 0.25 ? 'spin' : 'jump', start: performance.now() };
  kick();
}

/** The figure's pose right now (the stage draws its performer from it; degrees for turns, drawing units for moves). */
export function performerPose(): Readonly<Pose> {
  return pose;
}
