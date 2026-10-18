// Live listening, shared by the dancing logo and the stage: one analyser read and one detector update per frame (at
// most 60 a second), however many of them ask. Drops are counted, so a consumer that missed the frame of one still
// sees it.
import { currentEntry, usePlayer } from '@/state/player';
import { audioAnalyser, outputVolume } from './engine';
import { bandLevels, GrooveDetector, type Bands, type GrooveFrame } from './groove';

export interface Listening {
  frame: GrooveFrame;
  /** band levels (dB) with the player's volume taken back out */
  bands: Bands;
  /** drops so far (compare with the last count seen) */
  drops: number;
}

const detector = new GrooveDetector();
let spectrum: Float32Array<ArrayBuffer> | null = null;
let lastAt = -1;
let prevAt = 0;
let last: Listening | null = null;
let drops = 0;
let wired = false;


function wire() {
  if (wired) return;
  wired = true;
  usePlayer.subscribe((s, prev) => {
    if (currentEntry(s)?.qid !== currentEntry(prev)?.qid) detector.newTrack();
    else if (Math.abs(s.currentTime - prev.currentTime) > 2) detector.seek();
  });
}

/** The music at this animation frame (`now`: the frame's timestamp, so callers in one frame share a reading). */
export function listen(now: number): Listening {
  wire();
  // at most 60 readings a second, as the detector was tuned offline (its kick measure spans a few frames), however
  // many callers ask and however fast the screen refreshes
  if (last && (now === lastAt || (prevAt && now - prevAt < 1000 / 61))) return last;
  const dt = prevAt ? (now - prevAt) / 1000 : 1 / 60;
  prevAt = now;
  lastAt = now;
  const a = audioAnalyser();
  spectrum ??= new Float32Array(a.frequencyBinCount);
  a.getFloatFrequencyData(spectrum);
  const bands = bandLevels(spectrum, a.context.sampleRate / a.fftSize);
  // the analyser hears the player's volume: take it back out, so turning it down isn't a breakdown
  const v = outputVolume();
  if (v > 0.001) {
    const k = -20 * Math.log10(v);
    bands.bass += k;
    bands.mid += k;
    bands.high += k;
    bands.full += k;
  }
  const frame = detector.update(dt, bands);
  if (frame.drop) drops++;
  last = { frame, bands, drops };
  return last;
}

/** Nobody listened for a while (paused, hidden): the next reading starts a fresh frame interval. */
export function listenPause() {
  prevAt = 0;
}

/** Builds the audio path before the music starts (building it mid-song could click). */
export const listenPrepare = () => void audioAnalyser();
