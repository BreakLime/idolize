// Card variants used on artist pages (album cards show "2025 • Album" instead of the artist).
import type { MediaItem } from '@/api/models';
import { MediaCard } from '@/components/MediaCard';
import { albumYearType } from './format';

export function artistCard(item: MediaItem) {
  return item.kind === 'album' ? <MediaCard item={item} subtitle={<span>{albumYearType(item)}</span>} /> : <MediaCard item={item} />;
}
