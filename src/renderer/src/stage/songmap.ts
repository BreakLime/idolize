// The stage's look-ahead: the track again in CD quality (about 30 MB for 5 minutes), decoded at 22 kHz mono and run
// through the groove detector in a worker, so the show knows where the build-ups and drops are before they come.
// Kept per track.
import { idol } from '@/lib/bridge';

export interface SongMap {
  /** seconds */
  drops: number[];
  /** build-ups: [start, end] seconds */
  builds: [number, number][];
  /** 0..1 how much is going on, per half second */
  energy: number[];
  /** 0..1 whether the track drives (its beat's regularity over the whole track: a ballad, orchestral or chill track
   * stays near 0 however loud; EDM, rock and pop near 1; measured on 14 tracks) */
  groove: number;
  duration: number;
}

const cache = new Map<number, Promise<SongMap | null>>();
/** why the last map couldn't be made (for the debug handle) */
export let lastError = '';
const RATE = 22050;

async function decode(trackId: number): Promise<{ pcm: Float32Array; sampleRate: number }> {
  // CD quality: TIDAL's smaller AAC streams are segmented (DASH), which the media protocol doesn't serve
  const meta = await idol.media.prepare(trackId, 'LOSSLESS');
  const buf = await (await fetch(meta.url)).arrayBuffer();
  const audio = await new OfflineAudioContext(1, 1, RATE).decodeAudioData(buf);
  const pcm = new Float32Array(audio.length);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const d = audio.getChannelData(c);
    for (let i = 0; i < d.length; i++) pcm[i] += d[i] / audio.numberOfChannels;
  }
  return { pcm, sampleRate: audio.sampleRate };
}

function analyse(pcm: Float32Array, sampleRate: number): Promise<SongMap> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./songmap.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<SongMap>) => {
      resolve(e.data);
      worker.terminate();
    };
    worker.onerror = (e) => {
      reject(new Error(e.message));
      worker.terminate();
    };
    worker.postMessage({ pcm, sampleRate }, [pcm.buffer]);
  });
}

/** The map of a track (null when it can't be made: the show then only reacts). */
export function songMap(trackId: number): Promise<SongMap | null> {
  let p = cache.get(trackId);
  if (!p) {
    p = decode(trackId)
      .then(({ pcm, sampleRate }) => analyse(pcm, sampleRate))
      .catch((e) => {
        lastError = e instanceof Error ? e.message : String(e);
        return null;
      });
    cache.set(trackId, p);
    if (cache.size > 24) cache.delete(cache.keys().next().value!);
  }
  return p;
}
