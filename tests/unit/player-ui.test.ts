// Pure helpers behind Now Playing. Synthetic data only.
import { describe, expect, it } from 'vitest';
import { bioParagraphs } from '../../src/renderer/src/components/player/bio';
import { activeLine, parseLyrics } from '../../src/renderer/src/components/player/lyrics';

describe('lyrics parsing', () => {
  const raw = { subtitles: '[00:01.50] alpha\n[00:04.00] beta\n[01:02.25] gamma\nnot a timed row', lyricsProvider: 'Provider' };

  it('parses timed subtitles into seconds', () => {
    const l = parseLyrics(raw)!;
    expect(l.timed).toBe(true);
    expect(l.provider).toBe('Provider');
    expect(l.lines.map((x) => x.t)).toEqual([1.5, 4, 62.25]);
    expect(l.lines.map((x) => x.text)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('falls back to plain text, and to null without data', () => {
    const l = parseLyrics({ lyrics: 'one\ntwo' })!;
    expect(l.timed).toBe(false);
    expect(l.lines).toHaveLength(2);
    expect(parseLyrics(null)).toBeNull();
    expect(parseLyrics({})).toBeNull();
  });

  it('finds the active line by binary search', () => {
    const { lines } = parseLyrics(raw)!;
    expect(activeLine(lines, 0)).toBe(-1);
    expect(activeLine(lines, 1.5)).toBe(0);
    expect(activeLine(lines, 30)).toBe(1);
    expect(activeLine(lines, 999)).toBe(2);
  });
});

describe('bio cleanup', () => {
  it('strips link markup and splits paragraphs', () => {
    expect(bioParagraphs('A [wimpLink artistId="1"]Name[/wimpLink] b.<br/><br/>Second  ')).toEqual(['A Name b.', 'Second']);
  });
});
