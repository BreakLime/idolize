// Player state: queue, order (shuffle), repeat, transport status. The audio engine (player/engine.ts) drives it.
import type { StreamMeta } from '@shared/ipc';
import { create } from 'zustand';
import type { Track, Video } from '@/api/models';
import { contentAllowed } from '@/lib/content';

export type RepeatMode = 'off' | 'all' | 'one';
export type Playable = Track;

export interface PlaySource {
  type: 'album' | 'playlist' | 'mix' | 'artist' | 'search' | 'collection' | 'track' | 'radio' | 'home' | 'queue';
  id: string;
  title: string;
  path?: string;
}

export interface QueueEntry {
  /** stable id per queue position, so the same track can appear twice */
  qid: string;
  track: Playable;
  /** entries added via "Play next"/"Add to queue" live in the manual section */
  manual?: boolean;
}

interface PersistedPlayer {
  entries: QueueEntry[];
  order: number[];
  pos: number;
  source: PlaySource | null;
  currentTime: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
}

export interface PlayerState extends PersistedPlayer {
  playing: boolean;
  buffering: boolean;
  duration: number;
  stream: StreamMeta | null;
  error: string | null;
  /** bumps whenever the current entry must be (re)loaded by the engine */
  loadToken: number;
  /** one-shot seek request for the engine */
  seekRequest: { t: number; token: number } | null;
}

const KEY = 'idolize:player';
let qidCounter = 0;
const qid = () => `${Date.now().toString(36)}-${(qidCounter++).toString(36)}`;

function restore(): Partial<PersistedPlayer> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<PersistedPlayer>;
  } catch {
    return {};
  }
}

const restored = restore();

export const usePlayer = create<PlayerState>(() => ({
  entries: restored.entries ?? [],
  order: restored.order ?? [],
  pos: restored.pos ?? 0,
  source: restored.source ?? null,
  currentTime: restored.currentTime ?? 0,
  volume: restored.volume ?? 0.8,
  muted: restored.muted ?? false,
  shuffle: restored.shuffle ?? false,
  repeat: restored.repeat ?? 'off',
  playing: false,
  buffering: false,
  duration: 0,
  stream: null,
  error: null,
  loadToken: 0,
  seekRequest: null,
}));

const MAX_PERSISTED = 2000;

/** Queue for storage: play order only (removed entries dropped), a window of MAX_PERSISTED around the current track. */
export function compactQueue(s: Pick<PlayerState, 'entries' | 'order' | 'pos'>): Pick<PersistedPlayer, 'entries' | 'order' | 'pos'> {
  const from = Math.max(0, Math.min(s.pos - 500, s.order.length - MAX_PERSISTED));
  const window = s.order.slice(from, from + MAX_PERSISTED);
  return { entries: window.map((i) => s.entries[i]), order: window.map((_, k) => k), pos: Math.max(0, s.pos - from) };
}

function persist() {
  const s = usePlayer.getState();
  const p: PersistedPlayer = {
    ...compactQueue(s),
    source: s.source,
    currentTime: s.currentTime,
    volume: s.volume,
    muted: s.muted,
    shuffle: s.shuffle,
    repeat: s.repeat,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* quota */
  }
}

// persist at most once a second — a throttle, not a debounce: currentTime changes 4×/s while playing,
// so a debounce would never fire during playback
let persistTimer: number | undefined;
usePlayer.subscribe(() => {
  persistTimer ??= window.setTimeout(() => {
    persistTimer = undefined;
    persist();
  }, 1000);
});
window.addEventListener('beforeunload', persist);

// ── selectors ────────────────────────────────────────────────────────────────

export const currentEntry = (s: PlayerState): QueueEntry | undefined => s.entries[s.order[s.pos]];
export const currentTrack = (s: PlayerState): Playable | undefined => currentEntry(s)?.track;
export const hasNext = (s: PlayerState) => s.pos < s.order.length - 1 || (s.repeat === 'all' && s.order.length > 0);
export const hasPrevious = (s: PlayerState) => s.order.length > 0;
/** upcoming entries in play order */
export const upNext = (s: PlayerState): QueueEntry[] => s.order.slice(s.pos + 1).map((i) => s.entries[i]);

// ── actions ──────────────────────────────────────────────────────────────────

const set = usePlayer.setState;
const get = usePlayer.getState;

function shuffled(n: number, first: number): number[] {
  const rest = [...Array(n).keys()].filter((i) => i !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [first, ...rest];
}

const playableOnly = (items: (Track | Video)[]): Playable[] =>
  items.filter((t): t is Track => t.kind === 'track' && t.streamable && contentAllowed(t));

/** Next queue position in `dir` whose track the content settings still allow (they can change mid-queue). */
function stepAllowed(s: PlayerState, from: number, dir: 1 | -1): number {
  for (let p = from + dir; p >= 0 && p < s.order.length; p += dir) {
    const t = s.entries[s.order[p]]?.track;
    if (t && contentAllowed(t)) return p;
  }
  return -1;
}

export const player = {
  /** Replace the queue and start playing `start` (index into `items`). */
  playList(items: (Track | Video)[], start = 0, source: PlaySource | null = null, opts: { shuffle?: boolean } = {}) {
    const startItem = items[start];
    const list = playableOnly(items);
    if (!list.length) return;
    let startIdx = startItem ? list.indexOf(startItem as Track) : 0;
    if (startIdx < 0) startIdx = 0;
    const shuffle = opts.shuffle ?? get().shuffle;
    const first = opts.shuffle && start === 0 ? Math.floor(Math.random() * list.length) : startIdx;
    const entries = list.map((track) => ({ qid: qid(), track }));
    set({
      entries,
      order: shuffle ? shuffled(entries.length, first) : [...entries.keys()],
      pos: shuffle ? 0 : first,
      shuffle,
      source,
      currentTime: 0,
      playing: true,
      error: null,
      loadToken: get().loadToken + 1,
    });
  },

  playAt(pos: number) {
    if (pos < 0 || pos >= get().order.length) return;
    set({ pos, currentTime: 0, playing: true, error: null, loadToken: get().loadToken + 1 });
  },

  toggle() {
    const s = get();
    if (!currentEntry(s)) return;
    set({ playing: !s.playing });
  },
  play: () => currentEntry(get()) && set({ playing: true }),
  pause: () => set({ playing: false }),

  next(auto = false) {
    const s = get();
    if (auto && s.repeat === 'one') return player.seek(0, true);
    const ahead = stepAllowed(s, s.pos, 1);
    if (ahead >= 0) return player.playAt(ahead);
    const wrapped = s.repeat === 'all' ? stepAllowed(s, -1, 1) : -1;
    if (wrapped >= 0) return player.playAt(wrapped);
    if (auto) set({ playing: false, currentTime: 0, seekRequest: { t: 0, token: Date.now() } });
  },

  previous() {
    const s = get();
    const back = stepAllowed(s, s.pos, -1);
    if (s.currentTime > 3 || back < 0) return player.seek(0);
    player.playAt(back);
  },

  seek(t: number, play?: boolean) {
    set({ currentTime: t, seekRequest: { t, token: Date.now() }, ...(play ? { playing: true } : {}) });
  },

  setVolume(v: number) {
    set({ volume: Math.max(0, Math.min(1, v)), muted: false });
  },
  toggleMute: () => set({ muted: !get().muted }),

  /**
   * Only what is still queued after the current track is reordered: history stays, removed tracks stay
   * removed, and manually queued tracks ("Play next" / "Add to queue") stay first.
   */
  toggleShuffle() {
    const s = get();
    if (s.order[s.pos] === undefined) return set({ shuffle: !s.shuffle });
    const before = s.order.slice(0, s.pos + 1);
    const rest = s.order.slice(s.pos + 1);
    const manual = rest.filter((i) => s.entries[i]?.manual);
    const context = rest.filter((i) => !s.entries[i]?.manual);
    if (!s.shuffle) {
      const mixed = shuffled(context.length + 1, 0)
        .slice(1)
        .map((k) => context[k - 1]);
      set({ shuffle: true, order: [...before, ...manual, ...mixed] });
    } else {
      // back to the album/playlist order for what is left
      set({ shuffle: false, order: [...before, ...manual, ...context.sort((a, b) => a - b)] });
    }
  },

  cycleRepeat() {
    const next: Record<RepeatMode, RepeatMode> = { off: 'all', all: 'one', one: 'off' };
    set({ repeat: next[get().repeat] });
  },

  /** "Play next": insert right after the current track. */
  playNext(items: (Track | Video)[]) {
    const add = playableOnly(items).map((track) => ({ qid: qid(), track, manual: true }));
    if (!add.length) return;
    const s = get();
    if (!currentEntry(s)) return player.playList(add.map((e) => e.track), 0, null);
    const base = s.entries.length;
    set({
      entries: [...s.entries, ...add],
      order: [...s.order.slice(0, s.pos + 1), ...add.map((_, i) => base + i), ...s.order.slice(s.pos + 1)],
    });
  },

  /** "Add to queue": after the other manually queued tracks, before the context. */
  addToQueue(items: (Track | Video)[]) {
    const add = playableOnly(items).map((track) => ({ qid: qid(), track, manual: true }));
    if (!add.length) return;
    const s = get();
    if (!currentEntry(s)) return player.playList(add.map((e) => e.track), 0, null);
    const base = s.entries.length;
    let insertAt = s.pos + 1;
    while (insertAt < s.order.length && s.entries[s.order[insertAt]].manual) insertAt++;
    set({
      entries: [...s.entries, ...add],
      order: [...s.order.slice(0, insertAt), ...add.map((_, i) => base + i), ...s.order.slice(insertAt)],
    });
  },

  removeAt(pos: number) {
    const s = get();
    if (pos === s.pos) return;
    const order = s.order.filter((_, i) => i !== pos);
    set({ order, pos: pos < s.pos ? s.pos - 1 : s.pos });
  },

  move(from: number, to: number) {
    const s = get();
    const order = [...s.order];
    const [x] = order.splice(from, 1);
    order.splice(to, 0, x);
    let pos = s.pos;
    if (from === s.pos) pos = to;
    else if (from < s.pos && to >= s.pos) pos--;
    else if (from > s.pos && to <= s.pos) pos++;
    set({ order, pos });
  },

  clearUpNext() {
    const s = get();
    set({ order: s.order.slice(0, s.pos + 1) });
  },
};
