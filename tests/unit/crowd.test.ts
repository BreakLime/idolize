// The crowd's picks (main/crowd.ts): the song's video among search results, and which comments go on the stage (not
// the ones about the video); and when they come up there (stage/crowd.ts).
// (made-up results and comments)
import { describe, expect, it } from 'vitest';
import { parseCount, pickAlso, pickComments, pickVideo, publishedAt, type RawComment, type VideoCandidate } from '../../src/main/crowd';
import { CrowdShow, lifeOf } from '../../src/renderer/src/stage/crowd';

const q = { trackId: 1, artist: 'Nova Lane', title: 'Glass Hearts', duration: 200 };
const video = (o: Partial<VideoCandidate>): VideoCandidate => ({ id: 'x', title: 'Nova Lane - Glass Hearts', seconds: 200, views: 1000, channel: 'Nova Lane', artist: true, ...o });

describe('pickVideo', () => {
  it("takes the artist's own upload, the most watched of them, over others' bigger ones", () => {
    const found = [
      video({ id: 'fan', title: 'Glass Hearts (Nova Lane) HQ', views: 9e8, channel: 'Fan Uploads', artist: false }),
      video({ id: 'audio', title: 'Nova Lane - Glass Hearts (Official Audio)', views: 2e6 }),
      video({ id: 'mv', title: 'Nova Lane - Glass Hearts (Official Music Video)', seconds: 230, views: 5e7 }),
    ];
    expect(pickVideo(found, q)?.id).toBe('mv');
  });

  it('skips other takes on the song, other songs, and lengths far off', () => {
    const found = [
      video({ id: 'lyrics', title: 'Nova Lane - Glass Hearts (Lyrics)', views: 9e8 }),
      video({ id: 'live', title: 'Nova Lane - Glass Hearts LIVE at the Arena', views: 8e8 }),
      video({ id: 'other', title: 'Nova Lane - Paper Moon', views: 7e8 }),
      video({ id: 'hour', title: 'Nova Lane - Glass Hearts 1 hour loop', seconds: 3600, views: 6e8 }),
      video({ id: 'ok', title: 'Glass Hearts', views: 10 }),
    ];
    expect(pickVideo(found, q)?.id).toBe('ok');
    expect(pickVideo(found.slice(0, 4), q)).toBeNull();
  });

  it("allows a take the track itself is (its version), and matches the title without its extras", () => {
    const remix = { ...q, title: 'Glass Hearts (feat. Kit)', version: 'Remix' };
    expect(pickVideo([video({ id: 'r', title: 'Nova Lane - Glass Hearts (Remix)' })], remix)?.id).toBe('r');
  });
});

describe('pickComments', () => {
  const c = (text: string, likes: string, o: Partial<RawComment> = {}): RawComment => ({ author: '@someone', text, likes, pinned: false, owner: false, ...o });

  it('keeps liked, readable comments without links or promotion, the most liked first', () => {
    const picked = pickComments(
      [
        c('this one is fine and liked', '1.2K'),
        c('more liked than the first', '19K'),
        c('too few likes to show', '12'),
        c('listen to my mix at www.example.com', '5K'),
        c('pinned by the channel', '50K', { pinned: true }),
        c('from the channel itself', '40K', { owner: true }),
        c('🔥🔥🔥🔥🔥', '30K'),
        c('x'.repeat(240), '20K'),
      ],
    );
    expect(picked.map((p) => p.text)).toEqual(['more liked than the first', 'this one is fine and liked']);
    expect(picked[0].likes).toBe(19000);
  });

  it('leaves out comments about the video: it mentioned, or a moment in it pointed at', () => {
    const picked = pickComments([
      c('the dancer in this video is unreal', '9K'),
      c('Who is here from the music video premiere?', '8K'),
      c('this vid aged so well', '7K'),
      c('el vídeo es increíble', '6K'),
      c('лучшее видео года', '5K'),
      c('the MV gave me chills', '4K'),
      c('that clip at the end though', '3K'),
      c('the moment at 2:31 when he turns around', '2K'),
      c('an absolute classic, provided you play it loud', '1K'),
    ]);
    expect(picked.map((p) => p.text)).toEqual(['an absolute classic, provided you play it loud']);
  });

  it("asks fewer likes of a smaller song's comments (5 % of its most liked, at least 3)", () => {
    const picked = pickComments([194, 40, 12, 10, 9, 3, 2].map((n) => c(`a comment liked ${n} times`, String(n))));
    expect(picked.map((p) => p.likes)).toEqual([194, 40, 12, 10]);
    expect(pickComments([c('one small comment', '2'), c('another small one', '1')])).toEqual([]);
  });
});

describe('pickAlso', () => {
  it("finds another upload for a song with few comments, its lyric video too, not the first pick nor a cover", () => {
    const found = [
      video({ id: 'own', title: 'Nova Lane - Glass Hearts (Official Audio)' }),
      video({ id: 'cover', title: 'Glass Hearts (cover)', views: 9e6, channel: 'Someone', artist: false }),
      video({ id: 'lyrics', title: 'Nova Lane - Glass Hearts (Lyrics)', views: 5e5, channel: 'Lyric Channel', artist: false }),
    ];
    expect(pickVideo(found, q)?.id).toBe('own');
    expect(pickAlso(found, q, 'own')?.id).toBe('lyrics');
  });
});

describe('helpers', () => {
  it('reads like counts', () => {
    expect([parseCount('372'), parseCount('19K'), parseCount('1.2M'), parseCount('1,204'), parseCount('')]).toEqual([372, 19000, 1200000, 1204, 0]);
  });

  it('reads when a comment was written, about, from "5 years ago"', () => {
    const now = Date.UTC(2026, 9, 18);
    const day = 864e5;
    expect(publishedAt('5 years ago', now)).toBe(now - 5 * 365 * day);
    expect(publishedAt('3 hours ago (edited)', now)).toBe(now - 3 * 36e5);
    expect(publishedAt('1 month ago', now)).toBe(now - 30 * day);
    expect(publishedAt('', now)).toBeUndefined();
    const [c] = pickComments([{ author: '@a', text: 'a comment with a date', likes: '2K', pinned: false, owner: false, published: '2 weeks ago' }], now);
    expect(c.date).toBe(now - 14 * day);
  });
});

describe('CrowdShow', () => {
  /** plays `seconds` at 10 updates a second; returns when each card came up (and which) */
  function play(show: CrowdShow, seconds: number, calm: (pos: number) => boolean) {
    const up: { pos: number; text: string }[] = [];
    let key = 0;
    for (let i = 0; i <= seconds * 10; i++) {
      const pos = i / 10;
      const c = show.update(pos, calm(pos));
      if (c && c.key !== key) {
        key = c.key;
        up.push({ pos, text: c.comment.text });
      }
    }
    return up;
  }
  const comment = (text: string, likes: number) => ({ author: '@a', text, likes });

  it('puts them up one at a time when the show leaves room, a few seconds apart, most liked first', () => {
    const show = new CrowdShow([comment('first', 900), comment('second', 500), comment('third', 100)]);
    // room until 30 s, none until 60 (a build-up, the peak…), room again
    const up = play(show, 90, (p) => p < 30 || p >= 60);
    expect(up.map((u) => u.text)).toEqual(['first', 'second', 'third']);
    expect(up[0].pos).toBeGreaterThan(4);
    expect(up[1].pos - up[0].pos).toBeGreaterThanOrEqual(lifeOf('first') + 3 - 0.11);
    expect(up[1].pos - up[0].pos).toBeLessThan(lifeOf('first') + 3.3);
    expect(up.every((u) => u.pos < 30 || u.pos >= 60)).toBe(true);
  });

  it('puts the cards beside the wall in turn, higher or lower', () => {
    const show = new CrowdShow(Array.from({ length: 8 }, (_, i) => comment(`comment ${i}`, 900 - i)));
    const cards: { side: string; top: number }[] = [];
    let key = 0;
    for (let i = 0; i <= 2000; i++) {
      const c = show.update(i / 10, true);
      if (c && c.key !== key) {
        key = c.key;
        cards.push({ side: c.side, top: c.top });
      }
    }
    expect(cards.length).toBe(8);
    expect(cards.every((c) => c.top < 22 || c.top > 58)).toBe(true);
    expect(cards.map((c) => c.side).join(' ')).toBe('left right left right left right left right');
  });

  it('takes a card down on a jump back past it', () => {
    const show = new CrowdShow([comment('one', 900)]);
    for (let p = 0; p <= 6; p += 0.1) show.update(p, true);
    expect(show.card).not.toBeNull();
    expect(show.update(1, true)).toBeNull();
  });
});
