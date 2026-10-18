// The look-ahead, off the UI thread: the groove detector over a whole decoded track (mono PCM), the same way it runs
// live, twice (the first pass learns the track's levels, so its first drop counts too).
import { bandLevels, GrooveDetector } from '../player/groove';
import type { SongMap } from './songmap';

const FPS = 60;
const N = 1024;

function analyse(pcm: Float32Array, sr: number): SongMap {
  const half = N / 2;
  const hop = sr / FPS;
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / N) + 0.08 * Math.cos((4 * Math.PI * i) / N);
  const rev = new Uint32Array(N);
  const bits = Math.log2(N);
  for (let i = 0; i < N; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const db = new Float32Array(half);
  const frames = Math.max(0, Math.floor((pcm.length - N) / hop));
  // bands per frame, computed once for both passes
  const bands: ReturnType<typeof bandLevels>[] = [];
  for (let f = 0; f < frames; f++) {
    const off = Math.floor(f * hop);
    for (let i = 0; i < N; i++) {
      re[rev[i]] = pcm[off + i] * win[i];
      im[rev[i]] = 0;
    }
    for (let size = 2; size <= N; size *= 2) {
      const h = size / 2;
      const step = (-2 * Math.PI) / size;
      for (let s = 0; s < N; s += size)
        for (let k = 0; k < h; k++) {
          const a = step * k;
          const wr = Math.cos(a);
          const wi = Math.sin(a);
          const i = s + k;
          const j = i + h;
          const tr = wr * re[j] - wi * im[j];
          const ti = wr * im[j] + wi * re[j];
          re[j] = re[i] - tr;
          im[j] = im[i] - ti;
          re[i] += tr;
          im[i] += ti;
        }
    }
    for (let k = 0; k < half; k++) db[k] = 20 * Math.log10(Math.hypot(re[k], im[k]) / N + 1e-12);
    bands.push(bandLevels(db, sr / N));
  }
  const det = new GrooveDetector();
  for (const b of bands) det.update(1 / FPS, b);
  det.newTrack();
  const drops: number[] = [];
  const builds: [number, number][] = [];
  const energy: number[] = [];
  let buildFrom: number | null = null;
  let acc = 0;
  let conf = 0;
  let heard = 0;
  bands.forEach((b, f) => {
    const g = det.update(1 / FPS, b);
    if (b.full > -75) {
      conf += g.confidence;
      heard++;
    }
    const t = (f * hop + N) / sr;
    if (g.drop) drops.push(t);
    if (g.buildup > 0.3) buildFrom ??= t;
    else if (buildFrom !== null) {
      if (t - buildFrom > 1.5) builds.push([buildFrom, t]);
      buildFrom = null;
    }
    acc += g.intensity;
    if ((f + 1) % (FPS / 2) === 0) {
      energy.push(acc / (FPS / 2));
      acc = 0;
    }
  });
  const groove = Math.min(1, Math.max(0, (conf / Math.max(1, heard) - 0.12) / 0.12));
  // the detector knows a drop once the bass is fully back (a few hundred ms in); the show should hit with the music:
  // move each one back to the sharpest bass rise of the second before it, the kick the drop lands on
  const onset = (t: number) => {
    const end = Math.round((t * sr - N) / hop);
    let best = end;
    let bestRise = -Infinity;
    for (let f = Math.max(3, end - FPS); f <= end && f < bands.length; f++) {
      const rise = bands[f].bass - Math.min(bands[f - 1].bass, bands[f - 2].bass, bands[f - 3].bass);
      if (rise > bestRise) {
        bestRise = rise;
        best = f;
      }
    }
    return (best * hop + N * 0.75) / sr;
  };
  return { drops: drops.map(onset), builds, energy, groove, duration: pcm.length / sr };
}

self.onmessage = (e: MessageEvent<{ pcm: Float32Array; sampleRate: number }>) => {
  self.postMessage(analyse(e.data.pcm, e.data.sampleRate));
};
