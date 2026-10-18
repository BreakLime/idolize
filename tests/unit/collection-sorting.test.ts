import { describe, expect, it } from 'vitest';
import { toAlbum, toTrack, type MediaItem } from '../../src/renderer/src/api/models';
import { matchesFilter, nextSort, relativeAdded, sortEntries } from '../../src/renderer/src/components/collection/sorting';

// Reference capture day (a Saturday); labels as TIDAL showed them on My Collection > Tracks.
const NOW = new Date(2026, 9, 17, 18, 0);
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();

describe('relativeAdded', () => {
  it('matches the labels of the reference capture', () => {
    expect(relativeAdded(at(2026, 10, 17), NOW)).toBe('Today');
    expect(relativeAdded(at(2026, 10, 16), NOW)).toBe('Yesterday');
    expect(relativeAdded(at(2026, 10, 13), NOW)).toBe('This week');
    expect(relativeAdded(at(2026, 10, 12), NOW)).toBe('This week'); // Monday
    expect(relativeAdded(at(2026, 10, 6), NOW)).toBe('Last week');
    expect(relativeAdded(at(2026, 9, 29), NOW)).toBe('Last month');
    expect(relativeAdded(at(2026, 9, 25), NOW)).toBe('Last month');
    expect(relativeAdded(at(2026, 6, 1), NOW)).toBe('Jun 1, 2026');
    expect(relativeAdded(undefined, NOW)).toBe('');
  });
  it('uses "This month" between last week and the previous month', () => {
    const late = new Date(2026, 9, 30, 12);
    expect(relativeAdded(at(2026, 10, 2), late)).toBe('This month');
  });
});

const album = (id: number, title: string, artist: string, releaseDate: string) =>
  toAlbum({ id, title, artists: [{ id, name: artist }], releaseDate }) as MediaItem;

describe('sortEntries', () => {
  const list = [
    { item: album(1, 'Contact', 'Sub Focus', '2025-02-01') },
    { item: album(2, 'I Love My Computer', 'Ninajirachi', '2025-08-01') },
    { item: album(3, 'Netsky', 'Netsky', '2010-06-01') },
  ];
  const titles = (l: { item: MediaItem }[]) => l.map((e) => (e.item.kind === 'album' ? e.item.title : ''));

  it('keeps API order for date added and reverses it for ascending', () => {
    expect(titles(sortEntries(list, { key: 'added', dir: 'DESC' }))).toEqual(['Contact', 'I Love My Computer', 'Netsky']);
    expect(titles(sortEntries(list, { key: 'added', dir: 'ASC' }))).toEqual(['Netsky', 'I Love My Computer', 'Contact']);
  });
  it('sorts by name, artist and release date', () => {
    expect(titles(sortEntries(list, { key: 'name', dir: 'ASC' }))).toEqual(['Contact', 'I Love My Computer', 'Netsky']);
    expect(titles(sortEntries(list, { key: 'artist', dir: 'ASC' }))).toEqual(['Netsky', 'I Love My Computer', 'Contact']);
    expect(titles(sortEntries(list, { key: 'release', dir: 'DESC' }))).toEqual(['I Love My Computer', 'Contact', 'Netsky']);
  });
  it('flips direction when the active option is picked again', () => {
    expect(nextSort({ key: 'name', dir: 'ASC' }, 'name', 'ASC')).toEqual({ key: 'name', dir: 'DESC' });
    expect(nextSort({ key: 'name', dir: 'DESC' }, 'added', 'DESC')).toEqual({ key: 'added', dir: 'DESC' });
  });
});

describe('matchesFilter', () => {
  const t = toTrack({ id: 1, title: 'Even If', version: 'Original Mix', artists: [{ id: 2, name: 'Calibre' }], album: { id: 3, title: 'Even If' } });
  it('matches title, artist and album case/diacritic-insensitively', () => {
    expect(matchesFilter(t, 'calibre')).toBe(true);
    expect(matchesFilter(t, 'EVEN')).toBe(true);
    expect(matchesFilter(t, 'évèn')).toBe(true);
    expect(matchesFilter(t, 'netsky')).toBe(false);
    expect(matchesFilter(t, '  ')).toBe(true);
  });
});
