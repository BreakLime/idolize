// Feed recency buckets (same rules as TIDAL): unseen first, then calendar buckets; weeks start on Monday.

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfWeek = (d: Date) => {
  const s0 = startOfDay(d);
  return new Date(s0.getTime() - ((s0.getDay() + 6) % 7) * DAY);
};

export const FEED_BUCKETS = ['New updates', 'Today', 'This Week', 'Last week', 'This month', 'Last month', 'Older'] as const;
export type FeedBucket = (typeof FEED_BUCKETS)[number];

export function feedBucket(a: { seen: boolean; occurredAt: string }, now = new Date()): FeedBucket {
  if (!a.seen) return 'New updates';
  const t = new Date(a.occurredAt);
  if (startOfDay(t).getTime() === startOfDay(now).getTime()) return 'Today';
  const week = startOfWeek(now);
  if (t > week) return 'This Week';
  if (t > new Date(week.getTime() - 7 * DAY)) return 'Last week';
  if (t.getMonth() === now.getMonth() && t.getFullYear() === now.getFullYear()) return 'This month';
  if (t > new Date(now.getFullYear(), now.getMonth() - 1, 1)) return 'Last month';
  return 'Older';
}

/** Groups in display order; empty buckets are dropped. */
export function groupFeed<T extends { seen: boolean; occurredAt: string }>(list: T[], now = new Date()): [FeedBucket, T[]][] {
  const by = new Map<FeedBucket, T[]>();
  for (const a of list) {
    const k = feedBucket(a, now);
    by.set(k, [...(by.get(k) ?? []), a]);
  }
  return FEED_BUCKETS.filter((k) => by.has(k)).map((k) => [k, by.get(k)!]);
}
