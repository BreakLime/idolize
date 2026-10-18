import { describe, expect, it } from 'vitest';
import { toMix } from '../../src/renderer/src/api/models';
import { feedBucket, groupFeed } from '../../src/renderer/src/components/home/feedGroups';

// Saturday 2026-10-17 12:00 local time (weeks start on Monday 2026-10-12)
const now = new Date(2026, 9, 17, 12, 0, 0);
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9, 0, 0).toISOString();

describe('feed recency buckets', () => {
  it('puts unseen activities first regardless of date', () => {
    expect(feedBucket({ seen: false, occurredAt: at(2020, 1, 1) }, now)).toBe('New updates');
  });
  it('buckets seen activities by calendar ranges', () => {
    expect(feedBucket({ seen: true, occurredAt: at(2026, 10, 17) }, now)).toBe('Today');
    expect(feedBucket({ seen: true, occurredAt: at(2026, 10, 13) }, now)).toBe('This Week');
    expect(feedBucket({ seen: true, occurredAt: at(2026, 10, 6) }, now)).toBe('Last week');
    expect(feedBucket({ seen: true, occurredAt: at(2026, 10, 2) }, now)).toBe('This month');
    expect(feedBucket({ seen: true, occurredAt: at(2026, 9, 20) }, now)).toBe('Last month');
    expect(feedBucket({ seen: true, occurredAt: at(2026, 8, 13) }, now)).toBe('Older');
  });
  it('groups in display order and drops empty buckets', () => {
    const g = groupFeed(
      [
        { seen: true, occurredAt: at(2026, 8, 13) },
        { seen: true, occurredAt: at(2026, 10, 2) },
        { seen: true, occurredAt: at(2026, 10, 1) },
      ],
      now,
    );
    expect(g.map(([k, l]) => [k, l.length])).toEqual([
      ['This month', 2],
      ['Older', 1],
    ]);
  });
});

describe('toMix', () => {
  it('accepts v2 mixImages arrays and v1 size-keyed records', () => {
    const v2 = toMix({ id: 'm', type: 'TRACK_MIX', titleTextInfo: { text: 'I Refuse' }, subtitleTextInfo: { text: 'Netsky' }, mixImages: [{ size: 'SMALL', url: 's', width: 320, height: 320 }, { size: 'LARGE', url: 'l', width: 1500, height: 1500 }] });
    expect(v2.title).toBe('I Refuse');
    expect(v2.mixType).toBe('TRACK_MIX');
    expect(v2.images.SMALL.url).toBe('s');
    expect(v2.images.LARGE.url).toBe('l');
    const v1 = toMix({ id: 'm', title: 'T', subTitle: 'S', mixType: 'DAILY_MIX', images: { MEDIUM: { url: 'm', width: 1, height: 1 } } });
    expect(v1.images.MEDIUM.url).toBe('m');
  });
});
