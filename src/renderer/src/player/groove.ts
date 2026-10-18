// Beat and drop detection for the dancing logo, from per-frame band levels (dB) of the playing audio. Pure: the
// analyser feeds it in the app, tools/review/groove-scan.ts feeds it decoded tracks offline.
//
// Kicks are sharp rises of the bass (flux): the figure nods on them. The tempo comes from how the onset strength
// repeats (autocorrelation over the last 6 s, 75–150 BPM, leaning to 120); a beat clock runs at it (the arms sway on it)
// and is pulled onto the onsets. A drop comes after a breakdown of 3 s or more, in one of two ways, either back to near
// full within 1.5 s while the whole mix is near full too:
// - drums: the bass stops pumping (a sustained pad doesn't pump), then pumps again on a steady beat (not a ballad's
//   piano notes);
// - bass: the bass (1 s envelope) falls 10 dB under its full level, then slams back (also a sustained "reese" bass);
// - gap: the pre-drop pause of a build-up, the bass all but gone and the whole mix down for 0.35–3 s on a steady beat,
//   then the bass slamming back (a piano's pauses keep the mix up; a ballad has no steady beat).

export interface Bands {
  bass: number;
  mid: number;
  high: number;
  full: number;
}

/** Band levels (dB, summed power) from a dB spectrum such as AnalyserNode.getFloatFrequencyData. */
export function bandLevels(db: Float32Array, binHz: number): Bands {
  const band = (lo: number, hi: number) => {
    let p = 0;
    const a = Math.max(1, Math.round(lo / binHz));
    const b = Math.min(db.length - 1, Math.round(hi / binHz));
    for (let i = a; i <= b; i++) p += 10 ** (db[i] / 10);
    return 10 * Math.log10(p + 1e-12);
  };
  return { bass: band(30, 150), mid: band(150, 2000), high: band(2000, 12000), full: band(30, 16000) };
}

export interface GrooveFrame {
  /** seconds since the last kick (the nod) */
  sinceKick: number;
  /** the beat clock ticked this frame */
  beat: boolean;
  beatIndex: number;
  /** 0..1 through the current beat */
  phase: number;
  /** seconds per beat */
  period: number;
  /** 0..1 how much to move: loudness, and how sure the beat is */
  intensity: number;
  /** 0..1 how regular the beat is (a ballad's piano isn't; four to the floor is) */
  confidence: number;
  /** dB: how deep the bass pumps (a ballad ~4, orchestral ~7, EDM and hip-hop 11–19) */
  pump: number;
  /** 0..1 the kicks are out and the highs are rising (a build-up) */
  buildup: number;
  /** the music slammed back in after a breakdown */
  drop: boolean;
}

const SILENCE = -75; // full band, dB: nothing playing
const RATE = 60; // the onset-strength grid for the tempo, per second
const WINDOW = 6 * RATE;
const LAGS = [Math.round(RATE * 0.4), Math.round(RATE * 0.8)] as const; // 150–75 BPM
const KICK_DB = 4; // a bass rise counts from this much
const KICK_GAP = 0.25; // s between nods
const PUMP_DB = 6; // a bass range (0.4 s) counts as pumping beyond this
const REFRACTORY = 0.2;
const LOW = 0.35; // pumping under this share of its full depth …
const BREAKDOWN_S = 3; // … this long is a breakdown (bass; on a 1 s envelope)
const DRUMLESS_S = 6; // … this long without pumping is a breakdown (drums; on a 1.5 s envelope: about 7.5 s)
const BACK = 0.7; // back over this share (drums) …
const BASS_LOW_DB = 10; // bass this far under its full level (bass) …
const STEADY = 0.35; // beat regularity the drums need after a breakdown
const BACK_S = 1.5; // … within this long after the breakdown: a drop (slower is a swell)
const SLAM_S = 0.6; // bass: from 10 dB under its full level to within 4 dB this fast (a swell is slower)
const NEAR_DB = 6; // bass and whole mix this close to their full levels at the drop
const SETTLED_S = 10; // listened this long before any drop (the full levels have to be known)
const GAP_DB = 15; // gap: the bass this far under its full level …
const GAP_S = [0.35, 3] as const; // … for this long …
const GAP_MIX_DB = 8; // … with the whole mix this far down
const TRACK_START_S = 15; // no drop this early in a track (a track change, an intro still finding its levels)
const COOLDOWN = 40;

const smoothing = (dt: number, tau: number) => 1 - Math.exp(-dt / tau);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export class GrooveDetector {
  private t = 0;
  private heard = 0;
  // onsets
  private bassRecent: number[] = [];
  private pump: [number, number][] = [];
  private midRecent: number[] = [];
  private fluxMean = 0;
  private fluxVar = 4;
  private lastOnset = -Infinity;
  private lastKick = -Infinity;
  private kickMean = 0;
  private kickVar = 4;
  // tempo: onset strength on a fixed grid, autocorrelated now and then
  private grid: number[] = [];
  private gridAcc = 0;
  private gridMax = 0;
  private sinceTempo = 0;
  private confidence = 0;
  // the beat clock
  private period = 0.5;
  private phase = 0;
  private beatIndex = 0;
  // envelopes and full levels
  private driveSlow = 0;
  private driveFast = 0;
  private drivePeak = 0;
  private bassFast = -100;
  private bassSlow = -100;
  private bassSlowPeak = -Infinity;
  private fullFast = -100;
  private highFast = -100;
  private bassPeak = -Infinity;
  private fullPeak = -Infinity;
  // breakdown → drop, for each kind
  private lowSince: number | null = null;
  private highAtLow = 0;
  private exitAt: number | null = null;
  private bassLowSince: number | null = null;
  private bassArmed = false;
  private riseStart: number | null = null;
  private gapSince: number | null = null;
  private gapMix = 0;
  private gapRise: number | null = null;
  private trackStart = 0;
  private lastDrop = -Infinity;
  private buildup = 0;

  /** A new track: short-term state goes, the full levels carry over a little lower (a mix of similar tracks). */
  newTrack() {
    this.seek();
    this.bassPeak -= 6;
    this.bassSlowPeak -= 6;
    this.fullPeak -= 6;
    this.drivePeak *= 0.5;
    this.confidence *= 0.5;
  }

  /** A jump in the track: no kick or drop across it. */
  seek() {
    this.bassRecent = [];
    this.midRecent = [];
    this.pump = [];
    this.lastOnset = -Infinity;
    this.lowSince = null;
    this.exitAt = null;
    this.bassLowSince = null;
    this.bassArmed = false;
    this.riseStart = null;
    this.gapSince = null;
    this.gapRise = null;
    this.trackStart = this.t;
    this.buildup = 0;
  }

  /** Levels of the latest analysis frame, dt seconds after the previous one. */
  update(dt: number, b: Bands): GrooveFrame {
    dt = Math.min(Math.max(dt, 0), 0.1);
    this.t += dt;
    const t = this.t;
    const audible = b.full > SILENCE;
    if (audible) this.heard += dt;

    // level envelopes; the "full" levels follow every peak and slowly forget
    this.bassFast += (b.bass - this.bassFast) * smoothing(dt, 0.25);
    this.bassSlow += (b.bass - this.bassSlow) * smoothing(dt, 1);
    this.bassSlowPeak = Math.max(this.bassSlowPeak - 0.25 * dt, this.bassSlow);
    this.fullFast += (b.full - this.fullFast) * smoothing(dt, 0.25);
    this.highFast += (b.high - this.highFast) * smoothing(dt, 0.5);
    this.bassPeak = Math.max(this.bassPeak - 0.25 * dt, this.bassFast);
    this.fullPeak = Math.max(this.fullPeak - 0.25 * dt, this.fullFast);

    // onset strength: how sharply the bass (kicks) and, less, the mids rose against the last few frames
    const rise = (recent: number[], v: number) => {
      recent.push(v);
      if (recent.length > 4) recent.shift();
      return recent.length > 1 ? Math.max(0, v - Math.min(...recent.slice(0, -1))) : 0;
    };
    // (a sustained bass jitters by a few dB from frame to frame; kicks swing it by 10–20 dB)
    const kick = audible ? Math.max(0, rise(this.bassRecent, b.bass) - KICK_DB) : 0;
    const strength = kick + 0.5 * (audible ? Math.max(0, rise(this.midRecent, b.mid) - 3) : 0);

    // kick activity: how deep the bass pumps (its range over the last 0.4 s; a pad or a snare roll barely moves it)
    this.pump.push([t, audible ? b.bass : -120]);
    while (this.pump.length && this.pump[0][0] < t - 0.4) this.pump.shift();
    let hi = -Infinity;
    let lo = Infinity;
    for (const [, v] of this.pump) {
      hi = Math.max(hi, v);
      lo = Math.min(lo, v);
    }
    const pumping = audible ? Math.max(0, hi - lo - PUMP_DB) : 0;
    this.driveSlow += (pumping - this.driveSlow) * smoothing(dt, 1.5);
    this.driveFast += (pumping - this.driveFast) * smoothing(dt, 0.4);
    this.drivePeak = Math.max(this.drivePeak * Math.exp(-dt / 40), this.driveSlow);

    // onsets for the clock's phase: strength over an adaptive threshold
    const threshold = Math.max(2, this.fluxMean + 1.5 * Math.sqrt(this.fluxVar));
    const onset = strength > threshold && t - this.lastOnset > REFRACTORY;
    const a = smoothing(dt, 1.5);
    const diff = strength - this.fluxMean;
    this.fluxMean += a * diff;
    this.fluxVar = (1 - a) * (this.fluxVar + a * diff * diff);
    if (onset) this.lastOnset = t;
    // a kick to nod on: a bass rise over its own adaptive threshold
    const kickThreshold = Math.max(2, this.kickMean + 1.5 * Math.sqrt(this.kickVar));
    if (kick > kickThreshold && t - this.lastKick > KICK_GAP) this.lastKick = t;
    const kd = kick - this.kickMean;
    this.kickMean += a * kd;
    this.kickVar = (1 - a) * (this.kickVar + a * kd * kd);

    this.tempo(dt, strength);

    // the clock: ticks every period, pulled toward each onset
    let beat = false;
    const tick = () => {
      if (this.phase >= 1) {
        this.phase -= 1;
        this.beatIndex++;
        beat = true;
      }
    };
    this.phase += dt / this.period;
    tick();
    if (onset) {
      if (this.phase < 0.5) this.phase *= 0.6;
      else this.phase += (1 - this.phase) * 0.4;
      tick();
    }

    // breakdown → drop
    const full =
      this.fullPeak - this.fullFast <= NEAR_DB && this.heard >= SETTLED_S && t - this.trackStart >= TRACK_START_S && t - this.lastDrop > COOLDOWN;
    let drop = false;
    // drums: the bass stops pumping …
    if (audible && this.drivePeak > 0 && this.driveSlow < LOW * this.drivePeak) {
      if (this.lowSince === null) {
        this.lowSince = t;
        this.highAtLow = this.highFast;
      }
    } else if (this.lowSince !== null) {
      this.exitAt = t - this.lowSince >= DRUMLESS_S ? t : null;
      this.lowSince = null;
    }
    if (this.exitAt !== null) {
      if (t - this.exitAt > BACK_S) this.exitAt = null;
      else if (full && this.driveFast >= BACK * this.drivePeak && this.bassPeak - this.bassFast <= NEAR_DB && this.confidence >= STEADY) drop = true;
    }
    // … or the bass goes away (slow envelope) and slams back (fast one)
    if (audible && Number.isFinite(this.bassSlowPeak) && this.bassSlow < this.bassSlowPeak - BASS_LOW_DB) {
      this.bassLowSince ??= t;
      if (t - this.bassLowSince >= BREAKDOWN_S) this.bassArmed = true;
    } else this.bassLowSince = null;
    if (this.bassArmed) {
      if (this.bassFast >= this.bassPeak - BASS_LOW_DB) this.riseStart ??= t;
      else this.riseStart = null;
      if (this.riseStart !== null) {
        if (t - this.riseStart > SLAM_S) this.bassArmed = false; // a swell
        else if (this.bassFast >= this.bassPeak - 4) {
          if (full) drop = true;
          this.bassArmed = false;
        }
      }
      if (this.bassLowSince === null && this.bassSlow >= this.bassSlowPeak - NEAR_DB) this.bassArmed = false;
    }
    // … or a short gap, and the bass slams back
    if (Number.isFinite(this.bassPeak) && this.bassFast < this.bassPeak - GAP_DB) {
      if (this.gapSince === null) {
        this.gapSince = t;
        this.gapMix = this.fullFast;
      }
      this.gapMix = Math.min(this.gapMix, this.fullFast);
    } else if (this.gapSince !== null) {
      const len = t - this.gapSince;
      this.gapRise = len >= GAP_S[0] && len <= GAP_S[1] && this.fullPeak - this.gapMix >= GAP_MIX_DB ? t : null;
      this.gapSince = null;
    }
    if (this.gapRise !== null) {
      if (t - this.gapRise > SLAM_S) this.gapRise = null;
      else if (this.bassFast >= this.bassPeak - 4) {
        if (full && this.confidence >= STEADY) drop = true;
        this.gapRise = null;
      }
    }
    if (drop) {
      this.lastDrop = t;
      this.gapRise = null;
      this.exitAt = null;
      this.bassArmed = false;
      this.riseStart = null;
    }
    // build-up: while a breakdown has lasted a moment, how far the highs have risen since it began
    const since = Math.min(this.lowSince ?? Infinity, this.bassLowSince ?? Infinity);
    if (this.lowSince === null && this.bassLowSince !== null && t === this.bassLowSince) this.highAtLow = this.highFast;
    const target = Number.isFinite(since) && t - since > 1 ? clamp01((this.highFast - this.highAtLow) / 9) : 0;
    this.buildup += (target - this.buildup) * smoothing(dt, 0.4);

    const loud = clamp01((this.fullFast - (this.fullPeak - 20)) / 20);
    const intensity = audible ? (0.7 + 0.3 * this.confidence) * loud : 0;
    return {
      sinceKick: t - this.lastKick,
      beat,
      beatIndex: this.beatIndex,
      phase: this.phase,
      period: this.period,
      intensity,
      confidence: this.confidence,
      pump: this.driveSlow,
      buildup: this.buildup,
      drop,
    };
  }

  /** Onset strength onto the fixed grid; twice a second, the period from its autocorrelation. */
  private tempo(dt: number, strength: number) {
    this.gridMax = Math.max(this.gridMax, strength);
    this.gridAcc += dt;
    while (this.gridAcc >= 1 / RATE) {
      this.gridAcc -= 1 / RATE;
      this.grid.push(this.gridMax);
      this.gridMax = 0;
      if (this.grid.length > WINDOW) this.grid.shift();
    }
    this.sinceTempo += dt;
    if (this.sinceTempo < 0.5 || this.grid.length < WINDOW / 2) return;
    this.sinceTempo = 0;
    const g = this.grid;
    const mean = g.reduce((s, v) => s + v, 0) / g.length;
    const x = g.map((v) => v - mean);
    const ac = (lag: number) => {
      let s = 0;
      for (let i = lag; i < x.length; i++) s += x[i] * x[i - lag];
      return s / (x.length - lag);
    };
    const zero = ac(0);
    if (zero <= 1e-6) {
      this.confidence = Math.max(0, this.confidence - 0.1);
      return;
    }
    let best = 0;
    let bestScore = -Infinity;
    const scores: number[] = [];
    for (let lag = LAGS[0]; lag <= LAGS[1]; lag++) {
      // the beat repeats at 2 and 3 beats too (an off-beat pattern doesn't)
      const repeats = ac(lag) + 0.5 * (2 * lag < x.length ? ac(2 * lag) : 0) + 0.25 * (3 * lag < x.length ? ac(3 * lag) : 0);
      const score = repeats * Math.exp(-0.5 * (Math.log2(lag / (RATE / 2)) / 0.6) ** 2);
      scores[lag] = score;
      if (score > bestScore) {
        bestScore = score;
        best = lag;
      }
    }
    // a sub-frame peak position
    const l = scores[best - 1] ?? bestScore;
    const r = scores[best + 1] ?? bestScore;
    const curve = l - 2 * bestScore + r;
    const lag = best + (curve < 0 ? (0.5 * (l - r)) / curve : 0);
    const strengthOfBeat = clamp01(ac(best) / zero);
    this.confidence += (strengthOfBeat - this.confidence) * 0.3;
    if (strengthOfBeat > 0.1) this.period += (lag / RATE - this.period) * 0.3;
  }

  /** For the scan tool's plots. */
  get levels() {
    return { bass: this.bassFast, bassPeak: this.bassPeak, high: this.highFast, drive: this.driveSlow, drivePeak: this.drivePeak, confidence: this.confidence };
  }
}
