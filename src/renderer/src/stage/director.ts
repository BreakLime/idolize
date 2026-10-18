// The stage's director: from the live listening, the song map and the playback position, what the show does this frame.
//
// The LED wall carries the song (the cover as glowing dots, left alone by the beat: the lights around it and the idol
// show it) with the lyrics under it while they're sung. The song's structure comes from its
// map, so the show stays in sync with it: the last ~10 s before a known drop draw the wall in, its LEDs twinkling
// faster, lasers converging. A drop cuts hard: a flash, the glitch, a
// shockwave through the wall, lasers fanning on the beat after it. The big gestures are saved for the song's peak
// (peak.ts), once: there the album bursts apart into the kaleidoscope tunnel, which flies at full speed while the peak
// lasts, the lasers out; then the pieces come home and the wall is back.
//
// How big all of it goes follows the music's energy (vigor, over a few seconds; a hard drop takes it to full at once):
// in the calm parts the wall breathes slowly and dimmer, the beat barely felt anywhere. A gentle
// song (a ballad, orchestral: little groove over the whole track) never gets the hard gestures: its drops swell the
// light instead of the flash, glitch and jolt, its build-ups barely tense, and its peak dissolves into the kaleidoscope
// slowly instead of bursting. With reduced motion: no flash, glitch or burst, everything slower.
import type { Listening } from '@/player/listen';
import type { Rgb } from './palette';
import { findPeak, type Peak } from './peak';
import type { SongMap } from './songmap';

/** The song map of the playing track: until it's there, the show only follows the beat (nothing structural that could
 * fire out of place, like a "drop" as a song starts); without one (it couldn't be made) the live detector decides. */
export type MapState = { status: 'loading' } | { status: 'ready'; map: SongMap } | { status: 'failed' };

export interface ShowState {
  time: number;
  pal: Rgb[];
  tunnelMix: number;
  wallMix: number;
  zoom: number;
  rot: number;
  seg: number;
  /** the kaleidoscope's spiral (radians per unit of depth) and its rings (per unit of depth) */
  twist: number;
  rings: number;
  bright: number;
  kick: number;
  bass: number;
  /** 0..1 a drop's shockwave on its way out through the wall (0: none) */
  boom: number;
  /** 0..1 the peak's burst: the wall's pieces flown out (held while the peak lasts) */
  shatter: number;
  seed: number;
  laser: number;
  spread: number;
  sweep: number;
  lasers: number;
  flash: number;
  glitch: number;
  /** counts drops, hard or gentle */
  drop: number;
  /** counts the hard drops (the GUI jolts, the lyrics burst, the idol jumps) */
  hit: number;
  /** 0..1 how big the show goes: ambient in the calm parts, full when the music drives */
  vigor: number;
  /** 0..1 the wall's slow breath in the calm parts (in place of a pulse on each beat) */
  breath: number;
  /** 0..1 a gentle song's drop: a swell of light */
  swell: number;
  /** a song with little groove: no hard gestures */
  gentle: boolean;
  /** 0..1 how tense: the countdown to a known drop (a live build-up without a map) */
  tension: number;
  /** 0..1 how much the music drives: loud and on a steady beat (a ballad stays low however loud) */
  drive: number;
  /** what the drive is made of (for the debug handle) */
  why: { intensity: number; confidence: number; pump: number };
  lyrics: boolean;
}

const ease = (dt: number, tau: number) => 1 - Math.exp(-dt / tau);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => {
  const u = clamp01((v - a) / (b - a));
  return u * u * (3 - 2 * u);
};
const MIN_FLASH_GAP = 0.34; // ≤ 3 flashes a second
const COUNTDOWN_S = 10;
const BURST_S = 1.1; // the pieces flying out
const HOME_S = 2.6; // and coming back together
const BOOM_S = 0.9;
const GENTLE = 0.35; // the song's groove below which it's gentle (ballads and orchestral music measure near 0)
const BREATH_S = 6;
const PHRASE = 16; // beats

/** A small seeded generator (mulberry32): the same song, the same kaleidoscope. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Director {
  private t = 0;
  private state: ShowState;
  private dir = 1;
  private bassPeak = -Infinity;
  private seenDrops = -1;
  private lastDropAt = -Infinity;
  private lastHitAt = -Infinity;
  private lastFlash = -Infinity;
  private boomAt = -Infinity;
  private burstAt = -Infinity;
  private homeAt = -Infinity;
  private inPeak = false;
  private prevPos = 0;
  private confAvg = 0.3;
  private pumpAvg = 8;
  private peakFor: SongMap | null = null;
  /** the song's own kaleidoscope: how it twists into a spiral, its mirrors, its rings, how hard a kick pushes */
  private style: { twist: number; seg: number; rings: number; surge: number };
  private phrase = -1;
  private spin = 0;
  /** the song's peak, once its map is there */
  peak: Peak | null = null;

  /** `seed`: the song (its id), for its own kaleidoscope */
  constructor(pal: Rgb[], seed = Math.random() * 2 ** 31) {
    const rnd = random(seed);
    this.style = {
      twist: (rnd() < 0.5 ? -1 : 1) * (0.15 + 0.75 * rnd()),
      seg: [6, 8, 10, 12][Math.floor(rnd() * 4)],
      rings: 4 + 6 * rnd(),
      surge: 0.8 + 0.8 * rnd(),
    };
    this.state = {
      time: 0,
      pal,
      tunnelMix: 0,
      wallMix: 1,
      zoom: 0,
      rot: 0,
      seg: this.style.seg,
      twist: 0,
      rings: this.style.rings,
      bright: 0.8,
      kick: 0,
      bass: 0,
      boom: 0,
      shatter: 0,
      seed: Math.random() * 100,
      laser: 0,
      spread: 0.6,
      sweep: 0,
      lasers: 4,
      flash: 0,
      glitch: 0,
      drop: 0,
      hit: 0,
      vigor: 0,
      breath: 0,
      swell: 0,
      gentle: false,
      tension: 0,
      drive: 0,
      why: { intensity: 0, confidence: 0, pump: 0 },
      lyrics: false,
    };
  }

  set palette(pal: Rgb[]) {
    this.state.pal = pal;
  }

  /** A new track or a jump: no drop fires across it. */
  reset(pos: number) {
    this.prevPos = pos;
  }

  update(dt: number, l: Listening, pos: number, mapState: MapState, reduced: boolean, hasLyrics: boolean): ShowState {
    const map = mapState.status === 'ready' ? mapState.map : null;
    const live = mapState.status === 'failed';
    if (map && map !== this.peakFor) {
      this.peakFor = map;
      this.peak = findPeak(map);
    }
    const peak = map ? this.peak : null;
    const s = this.state;
    this.t += dt;
    s.time = this.t;
    const g = l.frame;
    const e = g.intensity;
    // the intensity is relative to the track's own loudness: weigh it by how much the music drives, a steady beat or a
    // pumping bass over the last seconds (measured on 14 tracks: a ballad or orchestral music has neither)
    this.confAvg += (g.confidence - this.confAvg) * ease(dt, 6);
    this.pumpAvg += (g.pump - this.pumpAvg) * ease(dt, 6);
    // (the song map knows it for the whole track; until it's there, the last seconds tell)
    const groove = map ? map.groove : Math.max(clamp01((this.confAvg - 0.12) / 0.2), clamp01((this.pumpAvg - 6) / 8));
    s.drive += (e * (0.2 + 0.8 * groove) - s.drive) * ease(dt, 0.8);
    s.why = { intensity: e, confidence: this.confAvg, pump: this.pumpAvg };
    const drive = s.drive;
    const gentle = groove < GENTLE;
    s.gentle = gentle;
    // how big the show goes: calm below a drive of 0.25, full from 0.6, changing over a few seconds
    s.vigor += (smooth(0.25, 0.6, drive) - s.vigor) * ease(dt, 2.5);
    s.breath = (0.5 - 0.5 * Math.cos((2 * Math.PI * this.t) / BREATH_S)) * (1 - s.vigor);

    // the bass against its recent full level; the beat as strongly as the music drives
    this.bassPeak = Math.max(this.bassPeak - 0.3 * dt, l.bands.bass);
    s.bass = clamp01((l.bands.bass - (this.bassPeak - 24)) / 24);
    s.kick = Math.exp(-g.sinceKick / 0.15) * (0.15 + 0.85 * s.vigor);

    // drops: the map's, on the dot; the live detector's only when there's no map to be had
    const jumped = Math.abs(pos - this.prevPos) > 1.5;
    let fired: number | undefined;
    if (map && !jumped) fired = map.drops.find((d) => d > this.prevPos && d <= pos);
    let fire = fired !== undefined;
    if (l.drops !== this.seenDrops) {
      const fresh = this.seenDrops >= 0 && l.drops > this.seenDrops;
      this.seenDrops = l.drops;
      if (fresh && live && this.t - this.lastDropAt > 4) fire = true;
    }
    this.prevPos = pos;

    // tension: the countdown to the map's next drop (stronger inside a mapped build-up); live only without a map
    const next = map?.drops.find((d) => d > pos);
    const lead = next === undefined ? Infinity : next - pos;
    const inBuild = map?.builds.some(([a, b]) => pos >= a - 1 && pos <= b + 1) ?? false;
    const countdown = lead < COUNTDOWN_S ? (1 - lead / COUNTDOWN_S) * (inBuild ? 1 : 0.6) : 0;
    // (a gentle song's build-up barely tenses: no converging lasers, no flashes on its kicks)
    const tense = Math.max(live ? g.buildup * groove : 0, countdown) * (gentle ? 0.35 : 1);
    s.tension += (tense - s.tension) * ease(dt, 0.3);

    if (fire) {
      s.drop++;
      this.lastDropAt = this.t;
      if (gentle) s.swell = 1;
      else {
        s.hit++;
        this.lastHitAt = this.t;
        s.vigor = 1;
        this.dir = -this.dir;
        if (!reduced && this.t - this.lastFlash >= MIN_FLASH_GAP) {
          s.flash = 0.55;
          this.lastFlash = this.t;
        }
        if (!reduced) s.glitch = 1;
        // the peak's drop: the album bursts apart, the kaleidoscope opening behind it; any other: the shockwave
        if (peak?.drop && fired === peak.at && !reduced) {
          this.burstAt = this.t;
          this.homeAt = -Infinity;
          s.seed = Math.random() * 100;
        } else this.boomAt = this.t;
      }
      s.tension = 0;
    }
    s.swell *= Math.exp(-dt / 2.5);

    // the peak: the kaleidoscope, only there; leaving it, the pieces of a burst album come home
    const inPeak = !!peak && pos >= peak.at && pos < peak.end;
    if (this.inPeak && !inPeak && Number.isFinite(this.burstAt) && !Number.isFinite(this.homeAt)) this.homeAt = this.t;
    this.inPeak = inPeak;
    // (a gentle song's album dissolves into it slowly)
    const fadeIn = gentle ? 3.5 : peak?.drop ? 0.4 : 1.5;
    s.tunnelMix += ((inPeak ? 1 : 0) - s.tunnelMix) * ease(dt, inPeak ? fadeIn * (reduced ? 2 : 1) : gentle ? 2.5 : 0.9);
    // (in a burst, the pieces fly against the dark for a moment, then the tunnel opens up behind them)
    if (inPeak && this.t - this.burstAt < 1) s.tunnelMix = smooth(0.08, 0.9, this.t - this.burstAt);
    if (Number.isFinite(this.burstAt)) {
      const out = (this.t - this.burstAt) / BURST_S;
      const home = Number.isFinite(this.homeAt) ? (this.t - this.homeAt) / HOME_S : -1;
      if (home >= 1) {
        this.burstAt = this.homeAt = -Infinity;
        s.shatter = 0;
        s.wallMix = 1 - s.tunnelMix;
      } else if (home >= 0) {
        s.shatter = 1 - smooth(0, 1, home);
        s.wallMix = smooth(0, 0.35, home);
      } else {
        // out fast, slowing, fading into the tunnel as they fly
        s.shatter = out < 1 ? 1 - (1 - out) ** 2 : 1;
        s.wallMix = 1 - smooth(0.5, 1.9, this.t - this.burstAt);
      }
    } else {
      s.shatter = 0;
      s.wallMix = 1 - s.tunnelMix;
    }
    const sinceBoom = (this.t - this.boomAt) / BOOM_S;
    s.boom = sinceBoom >= 0 && sinceBoom < 1 && !reduced ? sinceBoom : 0;

    // the tunnel's flight, from the music: the song's tempo sets the pace (so deep a beat), each kick surges it forward,
    // the energy the rest; the peak's first seconds rush, easing off (no step)
    const pace = reduced ? 0.4 : 1;
    const period = Math.min(1, Math.max(0.3, g.period || 0.5));
    const sinceHit = this.t - this.lastHitAt;
    const rush = inPeak && sinceHit < 15 ? 2.2 * Math.exp(-sinceHit / 3) : 0;
    s.zoom += dt * pace * ((0.12 / period) * (0.3 + 0.9 * drive) + this.style.surge * s.kick + 5 * s.tension * s.tension + rush);
    // its turn: swaying with the bars, the other way round each phrase (and on a hard drop), as far as the energy goes;
    // the mirrors change on a phrase too (more as the energy rises), the spiral breathes
    const phrase = Math.floor(g.beatIndex / PHRASE);
    if (phrase !== this.phrase) {
      if (this.phrase >= 0) this.dir = -this.dir;
      this.phrase = phrase;
      s.seg = this.style.seg + 2 * Math.round(2 * drive);
    }
    this.spin += (this.dir * (0.05 + 0.25 * drive) - this.spin) * ease(dt, 1.2);
    const sway = 0.3 * drive * Math.sin((Math.PI * ((g.beatIndex % 8) + g.phase)) / 4);
    s.rot += dt * pace * (this.spin + sway + 1.2 * s.tension * this.dir);
    s.twist = this.style.twist * (gentle ? 0.5 : 1) * (0.7 + 0.3 * Math.sin(this.t * 0.4));
    // (eased: the loudness swings with every beat, which would make the tunnel flicker)
    s.bright += (0.55 + 0.45 * e - s.bright) * ease(dt, 0.6);

    // lasers: only for the big moments: converging in a build-up, fanning on the beat through a drop's first bars, and in
    // the loudest stretches; none in a gentle song, nor over the kaleidoscope (it's the show there). More beams as the
    // energy rises (4–8), each pair coming and going softly.
    const phase2 = Math.PI * ((g.beatIndex % 4) + g.phase) * 0.5;
    const big = this.t - this.lastHitAt < 16 ? 1 : smooth(0.66, 0.78, drive);
    const level = (0.2 + 0.5 * drive) * s.vigor * big;
    const laserTarget = gentle ? 0 : (reduced ? 0.25 * level : Math.max(level, s.tension * 0.7)) * (1 - s.tunnelMix);
    s.laser += (laserTarget - s.laser) * ease(dt, 0.8);
    s.spread += ((s.tension > 0.25 ? 0.15 : 0.9) - s.spread) * ease(dt, 0.5);
    s.sweep = reduced ? 0 : 0.18 * Math.sin(phase2) * (0.5 + e) + s.tension * 0.25 * Math.sin(this.t * (2 + 10 * s.tension));
    s.lasers += (4 + 4 * drive - s.lasers) * ease(dt, 2);

    // the flash and glitch die away; a big kick in a build-up gets a small accent
    if (!reduced && s.tension > 0.6 && g.sinceKick < 0.02 && this.t - this.lastFlash >= MIN_FLASH_GAP) {
      s.flash = Math.max(s.flash, 0.18 * s.tension);
      this.lastFlash = this.t;
    }
    s.flash *= Math.exp(-dt / 0.09);
    s.glitch *= Math.exp(-dt / 0.22);

    // the lyrics on the wall while they're sung: not over the kaleidoscope, nor in the seconds after a drop
    s.lyrics = hasLyrics && s.tunnelMix < 0.3 && s.shatter < 0.05 && this.t - this.lastDropAt > 2.5;
    return s;
  }
}
