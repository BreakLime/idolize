import { describe, expect, it } from 'vitest';
import { bioExcerpt, bioParagraphs } from '../../src/renderer/src/components/artist/bio';
import { albumYearType, fansLabel, hostOf } from '../../src/renderer/src/components/artist/format';
import { prefixHighlights, splitHighlights } from '../../src/renderer/src/components/search/highlight';

describe('artist formatting', () => {
  it('formats fan counts like TIDAL ("8.9K fans")', () => {
    expect(fansLabel(8864)).toBe('8.9K fans');
    expect(fansLabel(18700)).toBe('18.7K fans');
    expect(fansLabel(1)).toBe('1 fan');
    expect(fansLabel(950)).toBe('950 fans');
    expect(fansLabel(1_250_000)).toBe('1.3M fans');
  });
  it('shows the bare website host', () => {
    expect(hostOf('https://ninajirachi.com')).toBe('ninajirachi.com');
    expect(hostOf('http://www.example.org/path')).toBe('example.org');
    expect(hostOf('not a url')).toBe('not a url');
  });
  it('labels album cards with year and release type', () => {
    expect(albumYearType({ releaseDate: '2025-08-08', type: 'ALBUM' })).toBe('2025 • Album');
    expect(albumYearType({ releaseDate: '2026-01-02', type: 'SINGLE' })).toBe('2026 • Single');
    expect(albumYearType({ releaseDate: null, type: 'EP' })).toBe('EP');
  });
});

describe('bio markup', () => {
  // synthetic markup in the API's format (no real bio text is stored in the repo)
  const raw = 'First [wimpLink artistId="1"]A[/wimpLink] line<br />still first<br /><br />Second &amp; last';
  it('splits paragraphs on double line breaks', () => {
    expect(bioParagraphs(raw)).toEqual(['First [wimpLink artistId="1"]A[/wimpLink] line\nstill first', 'Second &amp; last']);
  });
  it('flattens links for the header excerpt', () => {
    expect(bioExcerpt(raw)).toContain('First A line');
  });
});

describe('suggestion highlights', () => {
  it('splits text into highlighted and plain runs', () => {
    expect(splitHighlights('daft punk alive', [{ start: 0, length: 9 }])).toEqual([
      { text: 'daft punk', hl: true },
      { text: ' alive', hl: false },
    ]);
    expect(
      splitHighlights('daft punk is', [
        { start: 5, length: 4 },
        { start: 0, length: 4 },
      ]),
    ).toEqual([
      { text: 'daft', hl: true },
      { text: ' ', hl: false },
      { text: 'punk', hl: true },
      { text: ' is', hl: false },
    ]);
    expect(splitHighlights('plain', [])).toEqual([{ text: 'plain', hl: false }]);
  });
  it('highlights the typed prefix of a stored query', () => {
    expect(prefixHighlights('Netsky', 'net')).toEqual([{ start: 0, length: 3 }]);
    expect(prefixHighlights('Netsky', 'sky')).toEqual([]);
  });
});
