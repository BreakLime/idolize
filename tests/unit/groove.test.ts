// The dancing logo's detector, on synthetic band levels at 60 frames/s.
import { describe, expect, it } from 'vitest';
import { GrooveDetector, type Bands } from '../../src/renderer/src/player/groove';

const FPS = 60;
const DT = 1 / FPS;

/** A track as a function of time: bass with kicks every `beat` seconds (when `bass` is on), steady mids and highs. */
function frames(seconds: number, at: (t: number) => { bass: boolean; high?: number; silent?: boolean }, beat = 0.5): Bands[] {
  const out: Bands[] = [];
  for (let i = 0; i < seconds * FPS; i++) {
    const t = i * DT;
    const s = at(t);
    if (s.silent) {
      out.push({ bass: -120, mid: -120, high: -120, full: -120 });
      continue;
    }
    const sinceKick = t % beat;
    const kick = s.bass && sinceKick < 0.06 ? 14 : 0;
    const bass = s.bass ? -32 + kick : -60;
    const high = s.high ?? -40;
    out.push({ bass, mid: -34, high, full: Math.max(bass, -34, high) + 3 });
  }
  return out;
}

function run(input: Bands[], d = new GrooveDetector()) {
  const beats: number[] = [];
  const drops: number[] = [];
  let last = d.update(DT, input[0]);
  input.forEach((b, i) => {
    last = d.update(DT, b);
    if (last.beat) beats.push(i * DT);
    if (last.drop) drops.push(i * DT);
  });
  return { beats, drops, last };
}

describe('groove detector', () => {
  it('locks onto the kicks: steady beats at the kick tempo', () => {
    const { beats, last } = run(frames(20, () => ({ bass: true })));
    const late = beats.filter((t) => t > 10);
    const gaps = late.slice(1).map((t, i) => t - late[i]);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    expect(mean).toBeGreaterThan(0.47);
    expect(mean).toBeLessThan(0.53);
    // on the kicks: each tick within 60 ms of a kick (kicks at multiples of 0.5 s)
    for (const t of late) expect(Math.min(t % 0.5, 0.5 - (t % 0.5))).toBeLessThan(0.06);
    expect(last.intensity).toBeGreaterThan(0.6);
  });

  it('folds fast kicks to a relaxed tempo (174 BPM → half time)', () => {
    const { last } = run(frames(20, () => ({ bass: true }), 60 / 174));
    expect(last.period).toBeGreaterThan(0.6);
    expect(last.period).toBeLessThan(0.75);
  });

  it('a breakdown, then the bass slams back in: one drop, at the return', () => {
    // 0–20 s full, 20–30 s breakdown (no bass, highs rising), 30 s+ drop
    const input = frames(45, (t) => (t < 20 ? { bass: true } : t < 30 ? { bass: false, high: -40 + (t - 20) * 1.5 } : { bass: true }));
    const { drops } = run(input);
    expect(drops).toHaveLength(1);
    expect(drops[0]).toBeGreaterThan(30);
    expect(drops[0]).toBeLessThan(30.8);
  });

  it('builds up while the highs rise in a breakdown', () => {
    const d = new GrooveDetector();
    run(
      frames(28, (t) => (t < 20 ? { bass: true } : { bass: false, high: -40 + (t - 20) * 1.5 })),
      d,
    );
    expect(d.update(DT, { bass: -60, mid: -34, high: -28, full: -25 }).buildup).toBeGreaterThan(0.5);
  });

  it('no drop for a steady track, a short gap, or a slow swell', () => {
    expect(run(frames(60, () => ({ bass: true }))).drops).toHaveLength(0);
    // bass out for 1.5 s only
    expect(run(frames(40, (t) => ({ bass: !(t > 20 && t < 21.5) }))).drops).toHaveLength(0);
    // bass back over 4 s (a swell): ramp the bass level instead of switching it
    const swell: Bands[] = frames(40, (t) => ({ bass: t < 20 })).map((b, i) => {
      const t = i * DT;
      if (t < 30) return b;
      const level = -60 + Math.min(1, (t - 30) / 4) * 28;
      return { ...b, bass: level, full: Math.max(level, -34) + 3 };
    });
    expect(run(swell).drops).toHaveLength(0);
  });

  it('no drop when a track starts from silence, and none twice within the cooldown', () => {
    expect(run(frames(30, (t) => (t < 5 ? { bass: false, silent: true } : { bass: true }))).drops).toHaveLength(0);
    // two breakdowns 12 s apart: only the first drop counts (the cooldown is 40 s)
    const twice = frames(60, (t) => ({ bass: !((t > 20 && t < 25) || (t > 32 && t < 37)) }));
    expect(run(twice).drops).toHaveLength(1);
  });

  it('carries the full level into the next track: its first drop after an intro counts', () => {
    const d = new GrooveDetector();
    run(frames(30, () => ({ bass: true })), d);
    d.newTrack();
    // the next track: a 16 s intro without bass (nothing counts in a track's first 15 s), then the drop
    const { drops } = run(frames(30, (t) => ({ bass: t > 16 })), d);
    expect(drops).toHaveLength(1);
  });

  it('stands still in silence', () => {
    expect(run(frames(5, () => ({ bass: false, silent: true }))).last.intensity).toBe(0);
  });
});

describe('groove detector: the pre-drop gap', () => {
  it('a build-up pauses (bass gone, mix down) on a steady beat, then slams back: a drop', () => {
    // steady kicks with mids, a 1 s near-silent gap at 40 s, kicks again
    const input = frames(50, (t) => (t > 40 && t < 41 ? { bass: false, silent: true } : { bass: true }));
    const { drops } = run(input);
    expect(drops).toHaveLength(1);
    expect(drops[0]).toBeGreaterThan(41);
    expect(drops[0]).toBeLessThan(42.5); // (from digital silence the envelope takes a moment)
  });

  it('a pause of the bass alone, with the mix going on (a piano between notes), is no drop', () => {
    expect(run(frames(50, (t) => ({ bass: !(t > 40 && t < 41) }))).drops).toHaveLength(0);
  });
});
