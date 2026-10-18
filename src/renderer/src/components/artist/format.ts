// Pure formatting helpers for artist pages (unit-tested).
import type { Album } from '@/api/models';

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

/** 8864 → "8.9K fans" */
export const fansLabel = (n: number) => `${compact.format(n)} ${n === 1 ? 'fan' : 'fans'}`;

/** "https://www.ninajirachi.com/x" → "ninajirachi.com/x" without the scheme/www (TIDAL shows the bare host) */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const TYPE_LABEL: Record<string, string> = { ALBUM: 'Album', EP: 'EP', SINGLE: 'Single', COMPILATION: 'Compilation' };

/** "2025 • Album" under album cards on artist pages */
export function albumYearType(a: Pick<Album, 'releaseDate' | 'type'>): string {
  const year = a.releaseDate?.slice(0, 4);
  return [year, TYPE_LABEL[a.type] ?? 'Album'].filter(Boolean).join(' • ');
}
