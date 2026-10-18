// The stage's peak (peak.ts) and its director: the kaleidoscope and the album's burst once a song, at its peak; the
// other drops get the shockwave; the lyrics while they're sung.
import { describe, expect, it } from 'vitest';
import type { Listening } from '../../src/renderer/src/player/listen';
import { Director, type MapState } from '../../src/renderer/src/stage/director';
import { DARKEN_SHARE, whiteShare, type Rgb } from '../../src/renderer/src/stage/palette';
import { findPeak } from '../../src/renderer/src/stage/peak';
import type { SongMap } from '../../src/renderer/src/stage/songmap';

const PAL: Rgb[] = [
  [1, 0.5, 0.2],
  [0.2, 0.5, 1],
  [1, 1, 1],
  [0, 0, 0],
];

/** A map with energy per half second from `level(t)`. */
function songMap(duration: number, drops: number[], level: (t: number) => number): SongMap {
  const energy: number[] = [];
  for (let t = 0; t < duration; t += 0.5) energy.push(level(t));
  return { drops, builds: drops.map((d) => [d - 10, d] as [number, number]), energy, groove: 0.9, duration };
}

// an EDM track: drops at 40, 100 and 170, the middle one's section the biggest (until 140), an outro from 210
const EDM = songMap(240, [40, 100, 170], (t) => (t >= 210 ? 0.3 : t >= 100 && t < 140 ? 0.9 : (t >= 40 && t < 70) || (t >= 170 && t < 200) ? 0.8 : 0.45));

describe('findPeak', () => {
  it('lands on the middle of three drops, and lets go when the energy falls', () => {
    const p = findPeak(EDM)!;
    expect(p.at).toBe(100);
    expect(p.drop).toBe(true);
    expect(p.end).toBeGreaterThan(138);
    expect(p.end).toBeLessThan(142);
  });

  it('takes the middle of an odd number of drops even when another measures bigger; of an even number, the biggest', () => {
    const lastBig = songMap(240, [40, 100, 170], (t) => (t >= 170 && t < 200 ? 0.95 : 0.5));
    expect(findPeak(lastBig)!.at).toBe(100);
    const five = songMap(300, [30, 70, 130, 190, 250], (t) => (t >= 250 && t < 280 ? 0.95 : 0.5));
    expect(findPeak(five)!.at).toBe(130);
    const four = songMap(300, [30, 90, 150, 210], (t) => (t >= 90 && t < 120 ? 0.95 : 0.5));
    expect(findPeak(four)!.at).toBe(90);
  });

  it('of two drops prefers the later in a tie, but a clearly bigger earlier one wins', () => {
    const tie = songMap(240, [40, 150], (t) => ((t >= 40 && t < 70) || (t >= 150 && t < 180) ? 0.8 : 0.4));
    expect(findPeak(tie)!.at).toBe(150);
    const early = songMap(240, [60, 150], (t) => (t >= 60 && t < 90 ? 0.9 : t >= 150 && t < 180 ? 0.6 : 0.4));
    expect(findPeak(early)!.at).toBe(60);
  });

  it('ignores an outro hit, and ends before the next drop comes', () => {
    const outro = songMap(200, [80, 197], (t) => (t >= 80 ? 0.8 : 0.4));
    expect(findPeak(outro)!.at).toBe(80);
    const next = songMap(240, [60, 90], (t) => (t >= 60 && t < 90 ? 0.95 : t >= 90 && t < 120 ? 0.6 : 0.4));
    const p = findPeak(next)!;
    expect(p.at).toBe(60);
    expect(p.end).toBeLessThanOrEqual(80);
  });

  it('without drops: the loudest stretch, faded in, if one stands out', () => {
    const climax = songMap(240, [], (t) => (t >= 150 && t < 190 ? 0.8 : 0.4));
    const p = findPeak(climax)!;
    expect(p.drop).toBe(false);
    expect(Math.abs(p.at - 150)).toBeLessThanOrEqual(1);
    expect(findPeak(songMap(240, [], () => 0.5))).toBeNull();
  });

  it('takes a climax clearly bigger than the drops and away from them (a long build), not one next to a drop', () => {
    const build = songMap(600, [25, 70], (t) => (t >= 400 && t < 520 ? 0.9 : 0.68));
    const p = findPeak(build)!;
    expect(p.drop).toBe(false);
    expect(Math.abs(p.at - 400)).toBeLessThanOrEqual(1);
    // (the loud stretch is the last drop's build-up and section: the drop stays the peak)
    const near = songMap(240, [50, 160], (t) => (t >= 140 && t < 190 ? 0.9 : 0.6));
    expect(findPeak(near)).toEqual(expect.objectContaining({ at: 160, drop: true }));
  });
});

/** Plays `seconds` of a steady four-to-the-floor track through a director, 60 frames a second. */
function play(map: MapState, seconds: number, reduced = false, intensity: (pos: number) => number = () => 0.8, beat = 0.5) {
  const d = new Director(PAL, 7);
  const frames: { pos: number; tunnel: number; shatter: number; boom: number; drop: number; hit: number; lyrics: boolean; kick: number; vigor: number; breath: number; flash: number; glitch: number; swell: number; laser: number; zoom: number; beams: number }[] = [];
  for (let i = 0; i < seconds * 60; i++) {
    const pos = i / 60;
    const since = pos % beat;
    const l: Listening = {
      frame: { sinceKick: since, beat: since < 1 / 60, beatIndex: Math.floor(pos / beat), phase: since / beat, period: beat, intensity: intensity(pos), confidence: 0.5, pump: 10, buildup: 0, drop: false },
      bands: { bass: since < 0.06 ? -18 : -30, mid: -34, high: -40, full: -28 },
      drops: 0,
    };
    const s = d.update(1 / 60, l, pos, map, reduced, true);
    frames.push({ pos, tunnel: s.tunnelMix, shatter: s.shatter, boom: s.boom, drop: s.drop, hit: s.hit, lyrics: s.lyrics, kick: s.kick, vigor: s.vigor, breath: s.breath, flash: s.flash, glitch: s.glitch, swell: s.swell, laser: s.laser, zoom: s.zoom, beams: s.lasers });
  }
  return frames;
}
const when = (f: ReturnType<typeof play>, pick: (x: ReturnType<typeof play>[number]) => boolean) => f.filter(pick).map((x) => x.pos);

describe('Director', () => {
  const ready: MapState = { status: 'ready', map: EDM };

  it('shows the kaleidoscope only at the peak, and bursts the album only on its drop', () => {
    const f = play(ready, 240);
    const tunnel = when(f, (x) => x.tunnel > 0.5);
    expect(tunnel.length).toBeGreaterThan(0);
    expect(Math.min(...tunnel)).toBeGreaterThanOrEqual(100);
    expect(Math.max(...tunnel)).toBeLessThan(142);
    const shatter = when(f, (x) => x.shatter > 0.01);
    expect(Math.min(...shatter)).toBeGreaterThanOrEqual(100);
    // flown out and held while the peak lasts, home again after it
    expect(f[Math.round(102 * 60)].shatter).toBe(1);
    expect(f[Math.round(135 * 60)].shatter).toBe(1);
    expect(f[Math.round(146 * 60)].shatter).toBe(0);
    expect(Math.max(...shatter)).toBeLessThan(144);
    expect(f[f.length - 1].drop).toBe(3);
  });

  it('puts the lasers out over the kaleidoscope', () => {
    const f = play(ready, 240);
    expect(f[Math.round(45 * 60)].laser).toBeGreaterThan(0.3);
    expect(f.filter((x) => x.pos >= 104 && x.pos < 138).every((x) => x.laser < 0.05)).toBe(true);
    expect(f[Math.round(168 * 60)].laser).toBeGreaterThan(0.3);
  });

  it("saves the lasers for the big moments: a build-up, a drop's first bars, the loudest stretches", () => {
    // moderately loud throughout (a pop song's chorus level)
    const f = play(ready, 200, false, () => 0.7);
    const at = (p: number) => f[Math.round(p * 60)].laser;
    expect(at(25)).toBeLessThan(0.05);
    expect(at(38)).toBeGreaterThan(0.2); // the build-up before 40
    expect(at(45)).toBeGreaterThan(0.2); // the drop's first bars
    expect(at(70)).toBeLessThan(0.05);
    // none in a gentle song, not even in a build-up
    const ballad = play({ status: 'ready', map: { ...EDM, groove: 0.05 } }, 60);
    expect(ballad.every((x) => x.laser < 0.01)).toBe(true);
  });

  it('adds and drops beams smoothly as the energy changes', () => {
    const f = play(ready, 90, false, (p) => (p < 45 ? 0.3 : 0.95));
    let jump = 0;
    for (let i = 1; i < f.length; i++) jump = Math.max(jump, Math.abs(f[i].beams - f[i - 1].beams));
    expect(jump).toBeLessThan(0.05);
    expect(f[Math.round(44 * 60)].beams).toBeLessThan(5.5);
    expect(f[Math.round(85 * 60)].beams).toBeGreaterThan(7);
  });

  it('gives the other drops the shockwave', () => {
    const f = play(ready, 240);
    const boom = when(f, (x) => x.boom > 0);
    expect(boom.some((p) => p >= 40 && p < 41)).toBe(true);
    expect(boom.some((p) => p >= 170 && p < 171)).toBe(true);
    expect(boom.some((p) => p >= 100 && p < 102)).toBe(false);
  });

  it('puts the lyrics up whenever they are sung, except over the peak and right after a drop', () => {
    const f = play(ready, 240);
    const at = (p: number) => f[Math.round(p * 60)].lyrics;
    expect(at(20)).toBe(true);
    expect(at(60)).toBe(true); // a high-energy section
    expect(at(41)).toBe(false);
    expect(at(120)).toBe(false); // the peak
  });

  it('keeps it all on the wall while the map loads, and without one', () => {
    for (const map of [{ status: 'loading' }, { status: 'failed' }] as MapState[]) {
      const f = play(map, 240);
      expect(f.every((x) => x.tunnel < 0.01 && x.shatter === 0)).toBe(true);
    }
  });

  it('with reduced motion: no burst, the kaleidoscope fades in at the peak', () => {
    const f = play(ready, 240, true);
    expect(f.every((x) => x.shatter === 0 && x.boom === 0)).toBe(true);
    const tunnel = when(f, (x) => x.tunnel > 0.5);
    expect(Math.min(...tunnel)).toBeGreaterThanOrEqual(100);
  });

  it('goes ambient in the calm parts: the beat barely felt, a slow breath instead', () => {
    // quiet for a minute, then loud
    const f = play(ready, 120, false, (p) => (p < 60 ? 0.25 : 0.95));
    const span = (a: number, b: number) => f.filter((x) => x.pos >= a && x.pos < b);
    const calm = span(30, 38);
    const loud = span(100, 108);
    expect(Math.max(...calm.map((x) => x.vigor))).toBeLessThan(0.1);
    expect(Math.max(...calm.map((x) => x.kick))).toBeLessThan(0.3);
    expect(Math.max(...calm.map((x) => x.breath))).toBeGreaterThan(0.8);
    expect(Math.min(...loud.map((x) => x.vigor))).toBeGreaterThan(0.9);
    expect(Math.max(...loud.map((x) => x.kick))).toBeGreaterThan(0.9);
    expect(Math.max(...loud.map((x) => x.breath))).toBeLessThan(0.1);
    // (rising over a few seconds, not at once)
    expect(f[Math.round(61 * 60)].vigor).toBeLessThan(0.6);
  });

  it('keeps a gentle song gentle: its drops swell the light, its peak dissolves slowly', () => {
    const ballad: MapState = { status: 'ready', map: { ...EDM, groove: 0.05 } };
    const f = play(ballad, 240);
    expect(f[f.length - 1].drop).toBe(3);
    expect(f.every((x) => x.hit === 0 && x.flash === 0 && x.glitch === 0 && x.shatter === 0 && x.boom === 0)).toBe(true);
    expect(f[Math.round(41 * 60)].swell).toBeGreaterThan(0.5);
    // the peak (100): dissolving into the kaleidoscope over seconds
    expect(f[Math.round(101 * 60)].tunnel).toBeLessThan(0.3);
    expect(f[Math.round(110 * 60)].tunnel).toBeGreaterThan(0.8);
  });

  it("flies the kaleidoscope with the song: faster with a faster tempo, surging on the kicks, the rush easing off", () => {
    const rate = (f: ReturnType<typeof play>, a: number, b: number) => (f[Math.round(b * 60)].zoom - f[Math.round(a * 60)].zoom) / (b - a);
    const fast = play(ready, 140, false, () => 0.8, 0.4);
    const slow = play(ready, 140, false, () => 0.8, 0.7);
    expect(rate(fast, 120, 130)).toBeGreaterThan(rate(slow, 120, 130) * 1.2);
    // on a kick against the rest of its beat
    const f = play(ready, 140);
    expect(rate(f, 120, 120.1)).toBeGreaterThan(rate(f, 120.3, 120.4) * 1.5);
    // no step as the rush eases off: beat by beat, each a little slower
    const beats = [102, 103, 104, 105, 106].map((t) => rate(f, t, t + 1));
    for (let i = 1; i < beats.length; i++) expect(beats[i] / beats[i - 1]).toBeGreaterThan(0.75);
  });

  it("gives each song its own kaleidoscope, the same one each time", () => {
    const look = (seed: number) => {
      const d = new Director(PAL, seed);
      const l: Listening = { frame: { sinceKick: 1, beat: false, beatIndex: 0, phase: 0, period: 0.5, intensity: 0.5, confidence: 0.5, pump: 10, buildup: 0, drop: false }, bands: { bass: -30, mid: -34, high: -40, full: -28 }, drops: 0 };
      const s = d.update(1 / 60, l, 0, ready, false, false);
      return `${s.twist.toFixed(3)} ${s.rings.toFixed(3)} ${s.seg}`;
    };
    expect(look(101)).toBe(look(101));
    expect(new Set([101, 202, 303, 404, 505].map(look)).size).toBeGreaterThan(3);
  });
});

describe('whiteShare', () => {
  /** an RGBA image: `white` of its pixels white, the rest a dark red */
  const image = (white: number, n = 100) => Uint8ClampedArray.from({ length: n * 4 }, (_, i) => (i % 4 === 3 ? 255 : i / 4 < white * n ? 245 : i % 4 === 0 ? 120 : 20));

  it('tells a mostly white or light cover (it pulses darker) from any other (brighter)', () => {
    expect(whiteShare(image(0.9))).toBeCloseTo(0.9);
    expect(whiteShare(image(0.9)) >= DARKEN_SHARE).toBe(true);
    expect(whiteShare(image(0.2)) >= DARKEN_SHARE).toBe(false);
    // a bright colour isn't light in this sense: a yellow cover still pulses brighter
    const yellow = Uint8ClampedArray.from({ length: 400 }, (_, i) => [255, 230, 30, 255][i % 4]);
    expect(whiteShare(yellow)).toBe(0);
  });
});
