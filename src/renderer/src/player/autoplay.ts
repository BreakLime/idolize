// Settings → Autoplay: when the last track of the queue starts, append similar tracks (track radio)
// so playback keeps going like TIDAL. Appended entries carry an "auto-" qid so the queue can label them.
import { tracks } from '@/api/tidal';
import { contentAllowed } from '@/lib/content';
import { currentEntry, usePlayer } from '@/state/player';
import { useSettings } from '@/state/settings';

export const AUTO_PREFIX = 'auto-';
export const isAutoplayEntry = (qid: string) => qid.startsWith(AUTO_PREFIX);

let started = false;
let lastFor = '';

async function check() {
  const s = usePlayer.getState();
  const st = useSettings.getState().settings;
  if (!st?.autoplay || s.repeat !== 'off') return;
  const cur = currentEntry(s);
  if (!cur || s.pos !== s.order.length - 1 || lastFor === cur.qid) return;
  lastFor = cur.qid;
  const r = await tracks.radio(cur.track.id).catch(() => null);
  const now = usePlayer.getState();
  if (currentEntry(now)?.qid !== cur.qid || now.pos !== now.order.length - 1) return;
  const known = new Set(now.order.map((i) => now.entries[i]?.track.id));
  const add = (r?.items ?? []).filter((t) => t.streamable && !known.has(t.id) && contentAllowed(t)).slice(0, 25);
  if (!add.length) return;
  const base = now.entries.length;
  const stamp = Date.now().toString(36);
  usePlayer.setState({
    entries: [...now.entries, ...add.map((track, i) => ({ qid: `${AUTO_PREFIX}${stamp}-${i}`, track }))],
    order: [...now.order, ...add.map((_, i) => base + i)],
  });
}

export function startAutoplay() {
  if (started) return;
  started = true;
  usePlayer.subscribe((s, prev) => {
    if (s.pos !== prev.pos || s.order !== prev.order || s.repeat !== prev.repeat || s.loadToken !== prev.loadToken) void check();
  });
  useSettings.subscribe((s, prev) => s.settings?.autoplay && !prev.settings?.autoplay && void check());
  void check();
}
