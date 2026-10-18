// The crowd's picks, without the network: which YouTube video is the song (youtube.ts searches), and which of its top
// comments go on the stage. Pure, for the tests.
import type { CrowdComment, CrowdQuery } from '../shared/ipc';

export interface VideoCandidate {
  id: string;
  title: string;
  /** seconds (0: unknown) */
  seconds: number;
  views: number;
  channel: string;
  /** the artist's own channel (YouTube's verified-artist mark) */
  artist: boolean;
}

export interface RawComment {
  author: string;
  text: string;
  /** as YouTube shows it: "19K", "1.2M", "372" */
  likes: string;
  pinned: boolean;
  /** by the video's channel (mostly promotion) */
  owner: boolean;
  /** as YouTube shows it: "5 years ago", "3 hours ago (edited)" */
  published?: string;
}

const UNIT_MS: Record<string, number> = { second: 1e3, minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6, year: 31536e6 };

/** "5 years ago" → about when, in ms (from `now`); undefined when it can't be read. */
export function publishedAt(s: string | undefined, now: number): number | undefined {
  const m = /(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i.exec(s ?? '');
  return m ? now - Number(m[1]) * UNIT_MS[m[2].toLowerCase()] : undefined;
}

const MAX_COMMENTS = 24;
/** a comment's likes to show it: 50 on a big song, fewer on a smaller one (5 % of its most liked, at least 3) */
const minLikes = (best: number) => Math.min(50, Math.max(3, Math.round(best * 0.05)));
/** about the video, not the song: it's mentioned (in the languages most comments come in), or a moment in it is
 * pointed at ("2:31 when he…") */
const ABOUT_THE_VIDEO = /\b(vid(eo|éo|eos|s)?|vídeos?|videoclips?|clips?|mvs?|music ?videos?)\b|видео|клип|\d{1,2}:\d{2}/iu;
/** what makes a video another take on the song, unless the track itself says so */
const OTHER_TAKES = ['lyrics', 'lyric', 'cover', 'karaoke', 'live', 'remix', 'sped up', 'slowed', 'reverb', 'nightcore', '8d', 'instrumental', 'tribute', 'reaction', 'full album', 'tutorial', 'piano', 'acoustic', 'extended', 'mashup', 'bass boosted'];

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** The title without its extras: "(feat. …)", "[…]", " - 2011 Remaster". */
const core = (title: string) => normalize(title.replace(/\s*[([].*?[)\]]/g, '').replace(/\s+-\s+.*$/, '')) || normalize(title);

/** "19K" → 19000, "1.2M" → 1200000, "372" → 372 */
export function parseCount(s: string | undefined): number {
  const m = /([\d.,]+)\s*([KMB])?/i.exec(s ?? '');
  if (!m) return 0;
  const n = Number(m[1].replace(/,/g, ''));
  const k = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] ?? '').toUpperCase() as 'K' | 'M' | 'B'] ?? 1;
  return Number.isFinite(n) ? Math.round(n * k) : 0;
}

/** The song's video among the search results: its title has the song's title and isn't another take (a lyric video,
 * a cover, live…; `allow`: takes that count here), its length is the song's give or take; the artist's own channel
 * first, then the most watched. */
export function pickVideo(found: VideoCandidate[], q: CrowdQuery, allow: string[] = []): VideoCandidate | null {
  const want = core(q.title);
  const own = normalize(`${q.title} ${q.version ?? ''}`);
  const artist = normalize(q.artist);
  const fits = found.filter((v) => {
    const t = normalize(v.title);
    if (!t.includes(want)) return false;
    if (OTHER_TAKES.some((w) => new RegExp(`\\b${w}\\b`).test(t) && !own.includes(w) && !allow.includes(w))) return false;
    return !v.seconds || !q.duration || (v.seconds > q.duration * 0.5 && v.seconds < q.duration * 2.5);
  });
  const ownChannel = fits.filter((v) => v.artist || normalize(v.channel).includes(artist) || normalize(v.channel) === `${artist} topic`);
  const pool = ownChannel.length ? ownChannel : fits;
  return pool.reduce<VideoCandidate | null>((best, v) => (!best || v.views > best.views ? v : best), null);
}

/** Another upload of the song, read too when its own video has few comments to show (a smaller song's comments are
 * often under its lyric video): a lyric video counts here, the first pick doesn't. */
export function pickAlso(found: VideoCandidate[], q: CrowdQuery, first: string): VideoCandidate | null {
  return pickVideo(
    found.filter((v) => v.id !== first),
    q,
    ['lyrics', 'lyric'],
  );
}

/** The comments for the stage: about the song, not its video (the stage plays the music, not the video); liked (as
 * much as the song's comments are: minLikes), readable, short enough to read in a few seconds, no links or promotion;
 * the most liked first. */
export function pickComments(raw: RawComment[], now = Date.now()): CrowdComment[] {
  const all = raw
    .filter((c) => !c.pinned && !c.owner)
    .map((c) => ({ author: c.author.trim(), text: c.text.replace(/\s+/g, ' ').trim(), likes: parseCount(c.likes), date: publishedAt(c.published, now) }));
  const least = minLikes(Math.max(0, ...all.map((c) => c.likes)));
  return all
    .filter((c) => c.likes >= least && c.text.length >= 8 && c.text.length <= 200)
    .filter((c) => !/https?:\/\/|www\.|\.(com|net|org|ly)\b/i.test(c.text))
    .filter((c) => (c.text.match(/\p{L}/gu)?.length ?? 0) >= 4)
    .filter((c) => !ABOUT_THE_VIDEO.test(c.text))
    .sort((a, b) => b.likes - a.likes)
    .slice(0, MAX_COMMENTS);
}
