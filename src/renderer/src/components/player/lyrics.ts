// Timed-lyrics parsing for the Now Playing lyrics panel (pure; lyrics are fetched at runtime and never stored).
export interface LyricLine {
  t: number;
  text: string;
}

export interface Lyrics {
  lines: LyricLine[];
  timed: boolean;
  provider?: string;
}

/** Parses LRC-style subtitles ("[mm:ss.xx] text"); falls back to the plain text. */
export function parseLyrics(raw: { lyrics?: string; subtitles?: string; lyricsProvider?: string } | null): Lyrics | null {
  if (!raw) return null;
  const provider = raw.lyricsProvider || undefined;
  if (raw.subtitles) {
    const lines: LyricLine[] = [];
    for (const row of raw.subtitles.split(/\r?\n/)) {
      const m = /^\[(\d+):(\d+(?:\.\d+)?)\]\s?(.*)$/.exec(row.trim());
      if (m) lines.push({ t: Number(m[1]) * 60 + Number(m[2]), text: m[3] });
    }
    if (lines.length) return { lines, timed: true, provider };
  }
  if (raw.lyrics) return { lines: raw.lyrics.split(/\r?\n/).map((text) => ({ t: -1, text })), timed: false, provider };
  return null;
}

/** Index of the line being sung at time `now` (-1 before the first line). */
export function activeLine(lines: LyricLine[], now: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= now) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}
