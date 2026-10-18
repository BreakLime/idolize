// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { formatTotal } from '@/api/models';
import { fetchQuery, invalidate } from '@/lib/query';

describe('query cache', () => {
  it('a response that was in flight during invalidate() is stored as stale', async () => {
    let resolve!: (v: string) => void;
    const first = fetchQuery('collection:track', () => new Promise<string>((r) => (resolve = r)));
    invalidate('collection:'); // e.g. a heart toggled while the list was loading
    resolve('old');
    await first;
    // stale → the next read refetches instead of serving the pre-mutation data for 60s
    expect(await fetchQuery('collection:track', async () => 'new')).toBe('new');
  });
});

describe('formatTotal', () => {
  it('carries rounded minutes into hours', () => {
    expect(formatTotal(7170)).toBe('2 hr 0 min');
    expect(formatTotal(3720)).toBe('1 hr 2 min');
    expect(formatTotal(2390)).toBe('39:50');
  });
});
