// The crowd from YouTube: a song's video found by search and its top comments, read anonymously through YouTube.js
// (the InnerTube client open-source YouTube apps use: no API key, no account). YouTube changes its internals now and
// then; until the library catches up (and the app with it) this finds nothing and the stage shows no comments, nothing
// else is affected. Kept on disk per track for a week (a song not found: for a day) in crowd.json; entries picked by
// older rules (VERSION) are looked up again.
import { app } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Innertube } from 'youtubei.js';
import type { Crowd, CrowdQuery } from '../shared/ipc';
import { pickAlso, pickComments, pickVideo, type RawComment, type VideoCandidate } from './crowd';

const FOUND_MS = 7 * 24 * 3600_000;
const MISSING_MS = 24 * 3600_000;
const TIMEOUT_MS = 15_000;
const MAX_ENTRIES = 400;
const ENOUGH = 8; // comments to show, below which another upload's are read too
/** the picking rules' version: 2 leaves out comments about the video, 3 reads two pages and keeps 24, 4 dates them,
 * 5 asks fewer likes of a smaller song's and reads another upload when there are few */
const VERSION = 5;

type Entry = { t: number; v?: number; crowd: Crowd | null };

let client: Promise<Innertube> | null = null;
const youtube = () =>
  (client ??= Innertube.create({ retrieve_player: false, generate_session_locally: true, lang: 'en' }).catch((e: unknown) => {
    client = null;
    throw e;
  }));

let cache: Record<string, Entry> | null = null;
const file = () => join(app.getPath('userData'), 'crowd.json');
function entries() {
  if (!cache) {
    try {
      cache = JSON.parse(readFileSync(file(), 'utf8')) as Record<string, Entry>;
    } catch {
      cache = {};
    }
  }
  return cache;
}
function remember(id: number, crowd: Crowd | null) {
  const all = entries();
  all[id] = { t: Date.now(), v: VERSION, crowd };
  const keys = Object.keys(all);
  if (keys.length > MAX_ENTRIES) keys.sort((a, b) => all[a].t - all[b].t).slice(0, keys.length - MAX_ENTRIES).forEach((k) => delete all[k]);
  try {
    writeFileSync(file(), JSON.stringify(all));
  } catch {
    /* a cache */
  }
}

const text = (v: unknown) => (v == null ? '' : String(v));

async function lookUp(q: CrowdQuery): Promise<Crowd | null> {
  const yt = await youtube();
  const res = await yt.search(`${q.artist} ${q.title}${q.version ? ` ${q.version}` : ''}`, { type: 'video' });
  const found: VideoCandidate[] = res.videos
    .filter((v) => v.type === 'Video')
    .slice(0, 10)
    .map((n) => {
      const v = n as unknown as { video_id: string; title: unknown; duration?: { seconds?: number }; view_count?: unknown; author?: { name?: string; is_verified_artist?: boolean } };
      return {
        id: v.video_id,
        title: text(v.title),
        seconds: v.duration?.seconds ?? 0,
        views: Number(text(v.view_count).replace(/\D/g, '')) || 0,
        channel: v.author?.name ?? '',
        artist: !!v.author?.is_verified_artist,
      };
    });
  const video = pickVideo(found, q);
  if (!video) return null;
  let raw = await readComments(yt, video.id);
  let comments = pickComments(raw);
  // few to show (a smaller song): another upload's too, often its lyric video
  const also = comments.length < ENOUGH ? pickAlso(found, q, video.id) : null;
  if (also) {
    const seen = new Set(raw.map((c) => c.text));
    raw = raw.concat((await readComments(yt, also.id)).filter((c) => !seen.has(c.text)));
    comments = pickComments(raw);
  }
  return { videoId: video.id, videoTitle: video.title, comments };
}

/** A video's first two pages of top comments (~40: enough left after the picking for a card every few seconds); none
 * when it has them off or they can't be read. */
async function readComments(yt: Innertube, id: string): Promise<RawComment[]> {
  const raw: RawComment[] = [];
  try {
    let thread = await yt.getComments(id, 'TOP_COMMENTS');
    for (let page = 0; ; page++) {
      for (const t of thread.contents) {
        type View = { content?: unknown; author?: { name?: string }; like_count?: string; is_pinned?: boolean; author_is_channel_owner?: boolean; published_time?: string };
        const c = (t as unknown as { comment?: View }).comment;
        if (c) raw.push({ author: c.author?.name ?? '', text: text(c.content), likes: c.like_count ?? '', pinned: !!c.is_pinned, owner: !!c.author_is_channel_owner, published: c.published_time });
      }
      if (page >= 1 || !thread.has_continuation) break;
      thread = await thread.getContinuation();
    }
  } catch {
    /* comments off, or unreadable: what's there */
  }
  return raw;
}

const pending = new Map<number, Promise<Crowd | null>>();

/** The song's crowd (null: none to be had: no video found, or YouTube couldn't be read just now). */
export function crowd(q: CrowdQuery): Promise<Crowd | null> {
  const hit = entries()[q.trackId];
  if (hit && hit.v === VERSION && Date.now() - hit.t < (hit.crowd ? FOUND_MS : MISSING_MS)) return Promise.resolve(hit.crowd);
  let p = pending.get(q.trackId);
  if (!p) {
    p = Promise.race([lookUp(q), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out')), TIMEOUT_MS))])
      .then((c) => {
        // (not found is remembered; a failure isn't: the next play tries again)
        remember(q.trackId, c);
        return c;
      })
      .catch((e: unknown) => {
        console.warn(`crowd: ${q.artist} – ${q.title}: ${e instanceof Error ? e.message : String(e)}`);
        return null;
      })
      .finally(() => pending.delete(q.trackId));
    pending.set(q.trackId, p);
  }
  return p;
}
