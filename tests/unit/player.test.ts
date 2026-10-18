// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Settings } from '@shared/ipc';
import type { Track } from '@/api/models';
import { compactQueue, currentTrack, hasNext, player, upNext, usePlayer } from '@/state/player';
import { useSettings } from '@/state/settings';

const track = (id: number, streamable = true): Track => ({
  kind: 'track',
  id,
  title: `T${id}`,
  version: null,
  duration: 200,
  trackNumber: id,
  volumeNumber: 1,
  explicit: false,
  audioQuality: 'LOSSLESS',
  mediaTags: [],
  artists: [{ id: 1, name: 'A' }],
  album: { id: 9, title: 'Al', cover: null },
  streamable,
});
const list = [1, 2, 3, 4, 5].map((i) => track(i));
const cur = () => currentTrack(usePlayer.getState())?.id;
const ids = () => usePlayer.getState().order.map((i) => usePlayer.getState().entries[i].track.id);

beforeEach(() => {
  usePlayer.setState({ entries: [], order: [], pos: 0, shuffle: false, repeat: 'off', currentTime: 0, playing: false });
});

describe('player queue', () => {
  it('plays a list from an index and skips unplayable tracks', () => {
    player.playList([track(0, false), ...list], 3, null);
    expect(cur()).toBe(3);
    expect(ids()).toEqual([1, 2, 3, 4, 5]);
    expect(usePlayer.getState().playing).toBe(true);
  });

  it('next/previous respect repeat modes', () => {
    player.playList(list, 4, null);
    player.next(true);
    expect(usePlayer.getState().playing).toBe(false); // end of list, repeat off
    player.cycleRepeat(); // all
    player.next(true);
    expect(cur()).toBe(1);
    player.cycleRepeat(); // one
    usePlayer.setState({ currentTime: 50 });
    player.next(true);
    expect(cur()).toBe(1);
    expect(usePlayer.getState().seekRequest?.t).toBe(0);
  });

  it('previous restarts the track after 3 seconds', () => {
    player.playList(list, 2, null);
    usePlayer.setState({ currentTime: 10 });
    player.previous();
    expect(cur()).toBe(3);
    usePlayer.setState({ currentTime: 1 });
    player.previous();
    expect(cur()).toBe(2);
  });

  it('shuffle keeps the current track and history, unshuffle restores order', () => {
    player.playList(list, 1, null);
    player.toggleShuffle();
    const s = usePlayer.getState();
    expect(cur()).toBe(2);
    expect(ids().slice(0, s.pos + 1)).toEqual([1, 2]); // history before the current track is kept
    expect([...ids()].sort()).toEqual([1, 2, 3, 4, 5]);
    player.toggleShuffle();
    expect(ids()).toEqual([1, 2, 3, 4, 5]);
    expect(cur()).toBe(2);
  });

  it('play next goes first, add to queue goes after other manual entries', () => {
    player.playList(list, 0, null);
    player.addToQueue([track(10)]);
    player.addToQueue([track(11)]);
    player.playNext([track(12)]);
    expect(upNext(usePlayer.getState()).map((e) => e.track.id).slice(0, 3)).toEqual([12, 10, 11]);
    expect(hasNext(usePlayer.getState())).toBe(true);
  });

  it('move/removeAt keep the current position consistent', () => {
    player.playList(list, 2, null);
    player.move(0, 4);
    expect(cur()).toBe(3);
    player.removeAt(0);
    expect(cur()).toBe(3);
    player.removeAt(usePlayer.getState().pos); // removing the current entry is ignored
    expect(cur()).toBe(3);
  });

  it('toggling shuffle never brings back removed tracks and keeps manual entries next', () => {
    player.playList(list, 0, null);
    player.removeAt(2); // remove track 3
    player.addToQueue([track(10)]);
    player.toggleShuffle();
    expect(ids()).not.toContain(3);
    expect(upNext(usePlayer.getState())[0].track.id).toBe(10);
    player.toggleShuffle();
    expect(ids()).toEqual([1, 10, 2, 4, 5]);
  });

  it('compacts the queue for storage around the current track', () => {
    const entries = Array.from({ length: 3000 }, (_, i) => ({ qid: String(i), track: track(i) }));
    const order = [...entries.keys()].reverse();
    const c = compactQueue({ entries, order, pos: 2500 });
    expect(c.entries).toHaveLength(2000);
    expect(c.entries[c.pos].track.id).toBe(order[2500]);
    expect(c.order).toEqual([...Array(2000).keys()]);
  });
});

describe('content settings (explicit / AI)', () => {
  const settings = (explicitContent: boolean, aiContent: boolean) =>
    useSettings.setState({ settings: { explicitContent, aiContent } as Settings });
  const explicit = { ...track(2), explicit: true };
  const ai = { ...track(4), ai: true };
  afterEach(() => useSettings.setState({ settings: null }));

  it('keeps disallowed tracks out of new queues', () => {
    settings(false, false);
    player.playList([track(1), explicit, track(3), ai, track(5)], 0, null);
    expect(ids()).toEqual([1, 3, 5]);
    settings(true, true);
    player.playList([track(1), explicit, track(3), ai, track(5)], 0, null);
    expect(ids()).toEqual([1, 2, 3, 4, 5]);
  });

  it('next/previous step over tracks that became disallowed after queueing', () => {
    settings(true, true);
    player.playList([track(1), explicit, track(3), ai, track(5)], 0, null);
    settings(false, false);
    player.next();
    expect(cur()).toBe(3);
    player.next();
    expect(cur()).toBe(5);
    player.previous();
    expect(cur()).toBe(3);
  });
});
