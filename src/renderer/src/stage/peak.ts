// The song's peak: its one biggest moment, where the show spends what it saves all song (the album bursting apart into
// the kaleidoscope). With an odd number of drops (3, 5…) it's the middle one (songs with three drops are mostly
// strongest in the middle). Otherwise it's the drop with the most going on after it, a later one winning a near tie (the
// energy is relative to the track and its sections measure close: of two drops, the second is usually the peak).
// A stretch clearly more intense than any drop's and away from them all (a long progressive build to its climax: the
// stretch around a drop is that drop's build-up or section), or, without drops, one that stands out from the song, is
// the peak instead: the kaleidoscope then fades in (nothing that has to land on a beat). It holds while the energy
// stays up. Tuned on 12 tracks with tools/review/stage-peaks.ts.
import type { SongMap } from './songmap';

export interface Peak {
  /** seconds: the drop it lands on, or where the stretch starts */
  at: number;
  /** seconds: where it lets go */
  end: number;
  /** on a drop (the burst), or faded in */
  drop: boolean;
}

const STEP = 0.5; // the map's energy: one value per half second
const SECTION_S = 32; // a drop's section
const STRETCH_S = 16;
const MIN_S = 8;
const MAX_S = 48;
const LATE = 0.15; // how much a later moment is preferred (energy is 0..1; sections differ by ~0.05–0.1)
const CLEARLY = 0.1; // how much more intense a stretch must be than the best drop's to take its place
const APART_S = 40; // and how far from any drop

function mean(e: number[], a: number, b: number) {
  const i = Math.max(0, Math.floor(a / STEP));
  const j = Math.min(e.length, Math.ceil(b / STEP));
  let sum = 0;
  for (let k = i; k < j; k++) sum += e[k];
  return j > i ? sum / (j - i) : 0;
}

/** Where the peak lets go: the energy falling well below its first seconds, the next drop's build-up, or a cap. */
function release(map: SongMap, at: number) {
  const ref = mean(map.energy, at, at + MIN_S);
  const next = map.drops.find((d) => d > at + 1);
  const limit = Math.min(at + MAX_S, map.duration - 1, next === undefined ? Infinity : next - 10);
  let end = limit;
  for (let t = at + MIN_S; t < limit; t += STEP)
    if (mean(map.energy, t, t + 2) < 0.65 * ref) {
      end = t;
      break;
    }
  return Math.max(Math.min(at + MIN_S, map.duration), end);
}

/** The most intense stretch past the opening (a later one winning a near tie), from where it starts. */
function loudest(map: SongMap) {
  const { energy, duration } = map;
  let at = -1;
  let best = -Infinity;
  let loud = 0;
  for (let t = duration * 0.2; t + STRETCH_S <= duration; t += STEP) {
    const m = mean(energy, t, t + STRETCH_S);
    const score = m + LATE * 0.5 * (t / duration);
    if (score > best) {
      best = score;
      at = t;
      loud = m;
    }
  }
  if (at < 0) return null;
  while (at - STEP >= 0 && mean(energy, at - STEP, at + 1.5) >= 0.85 * loud) at -= STEP;
  return { at, loud };
}

export function findPeak(map: SongMap): Peak | null {
  const { drops, energy, duration } = map;
  if (!energy.length || duration < 30) return null;
  const stretch = loudest(map);
  if (drops.length) {
    // (a drop in the last seconds is an outro hit, unless it's the only one)
    const options = drops.filter((d) => d < duration - MIN_S);
    const real = options.length ? options : drops;
    let at = real[real.length - 1];
    if (real.length >= 3 && real.length % 2 === 1) at = real[(real.length - 1) / 2];
    else {
      let best = -Infinity;
      for (const d of real) {
        const score = mean(energy, d, d + SECTION_S) + LATE * (d / duration);
        if (score >= best - 1e-9) {
          best = score;
          at = d;
        }
      }
    }
    const apart = stretch && drops.every((d) => Math.abs(d - stretch.at) > APART_S);
    if (!stretch || !apart || stretch.loud < mean(energy, at, at + STRETCH_S) + CLEARLY) return { at, end: release(map, at), drop: true };
    return { at: stretch.at, end: release(map, stretch.at), drop: false };
  }
  // no drops: the loudest stretch, if it stands out from the song
  if (!stretch || stretch.loud < 0.3 || stretch.loud < mean(energy, 0, duration) * 1.15) return null;
  return { at: stretch.at, end: release(map, stretch.at), drop: false };
}
