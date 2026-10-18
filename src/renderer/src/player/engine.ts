// The audio engine: one <audio> element fed by idol-media:// (decrypted in main), optional ReplayGain
// normalization through WebAudio, Media Session (Windows SMTC / media keys), title + taskbar sync.
import { artistNames, trackTitle } from '@/api/models';
import { coverUrl } from '@/api/images';
import { idol } from '@/lib/bridge';
import { contentAllowed } from '@/lib/content';
import { currentEntry, hasNext, hasPrevious, player, upNext, usePlayer, type PlayerState } from '@/state/player';
import { useSettings } from '@/state/settings';

const audio = new Audio();
audio.crossOrigin = 'anonymous';
audio.preload = 'auto';

let ctx: AudioContext | null = null;
let gain: GainNode | null = null;
let source: MediaElementAudioSourceNode | null = null;
let analyser: AnalyserNode | null = null;
let loadSeq = 0;
/** loadSeq of the last media-error recovery (one reload per load, then skip) */
let recoveredSeq = -1;
let lastTimeUpdate = 0;
let prewarmedFor = '';

// ── audio output device (Settings → Sound output); '' = system default ─────────
const SINK_KEY = 'idolize:sink';
type SinkCapable = { setSinkId?: (id: string) => Promise<void> };
let sinkId = (() => {
  try {
    return localStorage.getItem(SINK_KEY) ?? '';
  } catch {
    return '';
  }
})();
if (sinkId) void (audio as unknown as SinkCapable).setSinkId?.(sinkId).catch(() => {});

export const outputDevice = () => sinkId;

// ── restart (Settings → Window transparency) ──────────────────────────────────
const RESUME_KEY = 'idolize:resume-after-restart';

/** Quits and starts again; what is playing now carries on after the restart (it normally reopens paused). */
export function relaunchApp() {
  try {
    if (usePlayer.getState().playing) localStorage.setItem(RESUME_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  idol.app.relaunch();
}

/** a stale flag (the restart never came) must not start playback on some later start */
function takeResumeFlag() {
  try {
    const at = Number(localStorage.getItem(RESUME_KEY));
    localStorage.removeItem(RESUME_KEY);
    return Date.now() - at < 60_000;
  } catch {
    return false;
  }
}

export async function setOutputDevice(id: string) {
  sinkId = id;
  try {
    localStorage.setItem(SINK_KEY, id);
  } catch {
    /* ignore */
  }
  await (audio as unknown as SinkCapable).setSinkId?.(id).catch(() => {});
  if (ctx) await (ctx as unknown as SinkCapable).setSinkId?.(id).catch(() => {});
}

/** ReplayGain → linear gain, clipped so peaks stay ≤ 1 (TIDAL's normalization). */
function normalizationGain(s: PlayerState): number {
  const settings = useSettings.getState().settings;
  if (!settings?.loudnessNormalization || !s.stream) return 1;
  const album = settings.normalizationMode === 'album';
  const db = (album ? s.stream.albumReplayGain : s.stream.trackReplayGain) ?? 0;
  const peak = (album ? s.stream.albumPeakAmplitude : s.stream.trackPeakAmplitude) ?? 1;
  return Math.min(10 ** (db / 20), 1 / Math.max(peak, 1e-3));
}

/** The Web Audio path (element → gain → output), built once it's needed: normalization or the dancing logo. */
function graph(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    if (sinkId) void (ctx as unknown as SinkCapable).setSinkId?.(sinkId).catch(() => {});
    gain = ctx.createGain();
    source = ctx.createMediaElementSource(audio);
    source.connect(gain).connect(ctx.destination);
    // the music now plays through the context: it must never sit suspended (that would be silence)
    audio.addEventListener('play', () => ctx?.state === 'suspended' && void ctx.resume());
    if (ctx.state === 'suspended') void ctx.resume();
  }
  return ctx;
}

/** The dancing logo's tap on the playing audio (before normalization, after the player volume). */
export function audioAnalyser(): AnalyserNode {
  if (!analyser) {
    analyser = graph().createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0;
    source!.connect(analyser);
  }
  return analyser;
}

/** The element's volume (0..1, the player's curve applied): the analyser hears the audio at this level. */
export const outputVolume = () => audio.volume;

/** Where playback is right now (the store's currentTime only updates every 250 ms). */
export const playbackPosition = () => audio.currentTime;

/** Seconds between the playback position and what is heard (the Web Audio path's output delay). */
export const outputLatency = () => (ctx ? (ctx.outputLatency || 0) + (ctx.baseLatency || 0) : 0);

function applyGain() {
  const s = usePlayer.getState();
  const g = normalizationGain(s);
  if (g !== 1) graph();
  if (gain) gain.gain.value = g;
  audio.volume = s.muted ? 0 : s.volume ** 2; // perceptual curve
}

async function load(autoplay: boolean, startAt = 0) {
  const seq = ++loadSeq;
  const s = usePlayer.getState();
  const entry = currentEntry(s);
  if (!entry) {
    audio.removeAttribute('src');
    audio.load();
    return;
  }
  usePlayer.setState({ buffering: true, error: null, duration: entry.track.duration, currentTime: startAt });
  try {
    const meta = await idol.media.prepare(entry.track.id);
    if (seq !== loadSeq) return;
    usePlayer.setState({ stream: meta });
    audio.src = meta.url;
    if (startAt > 0) audio.currentTime = startAt;
    applyGain();
    updateMediaSession();
    if (autoplay) await audio.play().catch(() => {});
  } catch (e) {
    if (seq !== loadSeq) return;
    usePlayer.setState({ buffering: false, error: e instanceof Error ? e.message : String(e) });
    // unavailable track: move on like TIDAL does
    if (autoplay) setTimeout(() => seq === loadSeq && player.next(true), 1500);
  }
}

/** Explicit/AI content was switched off while such a track was queued: move on, as TIDAL skips greyed tracks. */
function skipDisallowed() {
  audio.pause();
  const before = usePlayer.getState().loadToken;
  player.next(); // steps to the next allowed track (or wraps on repeat all)
  if (usePlayer.getState().loadToken === before) usePlayer.setState({ playing: false });
}

function updateMediaSession() {
  const s = usePlayer.getState();
  const t = currentEntry(s)?.track;
  if (!('mediaSession' in navigator) || !t) return;
  const art = coverUrl(t.album.cover, 640);
  navigator.mediaSession.metadata = new MediaMetadata({
    title: trackTitle(t),
    artist: artistNames(t.artists),
    album: t.album.title,
    artwork: art ? [{ src: art, sizes: '640x640', type: 'image/jpeg' }] : [],
  });
}

function syncWindow(s: PlayerState) {
  const t = currentEntry(s)?.track;
  idol.window.setPlaybackStatus({
    playing: s.playing,
    hasNext: hasNext(s),
    hasPrevious: hasPrevious(s),
    hasTrack: !!t,
    shuffle: s.shuffle,
    repeat: s.repeat,
    title: t ? trackTitle(t) : undefined,
    artist: t ? artistNames(t.artists) : undefined,
  });
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = s.playing ? 'playing' : 'paused';
}

export function startEngine() {
  audio.addEventListener('timeupdate', () => {
    const now = performance.now();
    if (now - lastTimeUpdate < 250) return;
    lastTimeUpdate = now;
    usePlayer.setState({ currentTime: audio.currentTime });
    const s = usePlayer.getState();
    // resolve the next stream ahead of time so the transition is instant
    const next = upNext(s)[0];
    if (next && s.duration - audio.currentTime < 30 && prewarmedFor !== next.qid) {
      prewarmedFor = next.qid;
      void idol.media.prepare(next.track.id).catch(() => {});
    }
    if ('mediaSession' in navigator && Number.isFinite(audio.duration))
      navigator.mediaSession.setPositionState({ duration: audio.duration, position: Math.min(audio.currentTime, audio.duration), playbackRate: 1 });
  });
  audio.addEventListener('durationchange', () => Number.isFinite(audio.duration) && usePlayer.setState({ duration: audio.duration }));
  audio.addEventListener('waiting', () => usePlayer.setState({ buffering: true }));
  audio.addEventListener('playing', () => usePlayer.setState({ buffering: false, playing: true }));
  audio.addEventListener('canplay', () => usePlayer.setState({ buffering: false }));
  audio.addEventListener('pause', () => {
    // pause events also fire when a new src loads; only reflect user/OS pauses
    if (!audio.ended && audio.src && usePlayer.getState().playing && !audio.seeking && audio.readyState > 2) usePlayer.setState({ playing: false });
  });
  audio.addEventListener('ended', () => player.next(true));
  audio.addEventListener('error', () => {
    const err = audio.error;
    if (!err || !audio.src) return;
    const s = usePlayer.getState();
    usePlayer.setState({ error: `Playback error (${err.code})`, buffering: false });
    if (!s.playing) return;
    // mid-track failure (expired CDN link, network drop): reload once from where we were, then move on
    if (recoveredSeq !== loadSeq) {
      const at = audio.currentTime || s.currentTime;
      void load(true, at).then(() => {
        recoveredSeq = loadSeq;
      });
    } else {
      const seq = loadSeq;
      setTimeout(() => seq === loadSeq && player.next(true), 1500);
    }
  });

  usePlayer.subscribe((s, prev) => {
    const starting = s.playing && (s.loadToken !== prev.loadToken || !prev.playing);
    const cur = currentEntry(s);
    if (starting && cur && !contentAllowed(cur.track)) return skipDisallowed();
    if (s.loadToken !== prev.loadToken) void load(s.playing, s.currentTime);
    else if (s.playing !== prev.playing) {
      if (s.playing) {
        if (!audio.src && currentEntry(s)) void load(true, s.currentTime);
        else void audio.play().catch(() => {});
      } else audio.pause();
    }
    if (s.seekRequest && s.seekRequest !== prev.seekRequest) {
      audio.currentTime = s.seekRequest.t;
      // repeat-one restarts an ended (paused) element; `playing` itself did not change
      if (s.playing && audio.paused && audio.src) void audio.play().catch(() => {});
    }
    if (s.volume !== prev.volume || s.muted !== prev.muted || s.stream !== prev.stream) applyGain();
    if (s.playing !== prev.playing || s.pos !== prev.pos || s.order !== prev.order || s.repeat !== prev.repeat || s.shuffle !== prev.shuffle) syncWindow(s);
  });
  useSettings.subscribe(() => applyGain());

  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => player.play());
    ms.setActionHandler('pause', () => player.pause());
    ms.setActionHandler('previoustrack', () => player.previous());
    ms.setActionHandler('nexttrack', () => player.next());
    ms.setActionHandler('seekto', (d) => d.seekTime !== undefined && player.seek(d.seekTime));
  }

  // restore last session paused at its position (TIDAL reopens on the last track, paused), playing after relaunchApp()
  const s = usePlayer.getState();
  audio.volume = s.muted ? 0 : s.volume ** 2; // the element mirrors the stored volume from the start
  usePlayer.setState({ playing: false });
  const resume = takeResumeFlag();
  if (currentEntry(s)) void load(resume, s.currentTime);
  syncWindow(usePlayer.getState());
}

/** Test/diagnostic hook: lets E2E tests observe the real media element. */
export const engineDebug = () => ({
  src: audio.src,
  currentTime: audio.currentTime,
  paused: audio.paused,
  readyState: audio.readyState,
  error: audio.error?.code ?? null,
  duration: audio.duration,
  volume: audio.volume,
});
