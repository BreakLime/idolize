// Settings → "Allow explicit content" / "Allow AI content": when off, such tracks are greyed out and never played.
import { useCallback } from 'react';
import type { Settings } from '@shared/ipc';
import type { Track, Video } from '@/api/models';
import { useSettings } from '@/state/settings';

type Filter = Pick<Settings, 'explicitContent' | 'aiContent'>;

const allowedBy = (st: Filter | null | undefined, t: Track | Video) =>
  (st?.explicitContent !== false || !t.explicit) && (st?.aiContent !== false || !(t.kind === 'track' && t.ai));

/** Non-reactive check for queue/engine code. */
export const contentAllowed = (t: Track | Video) => allowedBy(useSettings.getState().settings, t);

/** Reactive predicate for rows: re-renders when either setting changes. */
export function useContentAllowed(): (t: Track | Video) => boolean {
  const explicitContent = useSettings((s) => s.settings?.explicitContent ?? true);
  const aiContent = useSettings((s) => s.settings?.aiContent ?? true);
  return useCallback((t: Track | Video) => allowedBy({ explicitContent, aiContent }, t), [explicitContent, aiContent]);
}
