// Settings → Blocked (read-only): tracks, videos and profiles the user blocked in TIDAL.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { Link } from 'react-router';
import { artistUrl, coverUrl, videoImageUrl } from '@/api/images';
import { toArtist, toTrack, toVideo } from '@/api/models';
import { api, session } from '@/api/tidal';
import { Artwork } from '@/components/Artwork';
import { BlockIcon } from '@/components/icons/player';
import { useQuery } from '@/lib/query';
import { settingsStyles as s, TextTabs } from './SettingsUi';
import b from './BlocksTab.module.css';

type Kind = 'tracks' | 'videos' | 'artists';

const EMPTY: Record<Kind, string> = {
  tracks: "You haven't blocked any tracks. When you block a track, it won't appear in your mix or radio.",
  videos: "You haven't blocked any videos. When you block a video, it won't appear in your mix or radio.",
  artists: "You haven't blocked any profiles. When you block a profile, their music won't appear in your mix or radio.",
};

interface Blocked {
  id: number;
  title: string;
  subtitle: string;
  image?: string;
  round?: boolean;
  to: string;
}

async function loadBlocks(kind: Kind): Promise<Blocked[]> {
  const r = await api('v1', `users/${session.userId}/blocks/${kind}`, { offset: 0, limit: 50 });
  return (r.items ?? []).map((x: any): Blocked => {
    const raw = x.item ?? x;
    if (kind === 'artists') {
      const a = toArtist(raw);
      return { id: a.id, title: a.name, subtitle: 'Profile', image: artistUrl(a.picture, 48), round: true, to: `/artist/${a.id}` };
    }
    if (kind === 'videos') {
      const v = toVideo(raw);
      return { id: v.id, title: v.title, subtitle: v.artists.map((a) => a.name).join(', '), image: videoImageUrl(v.imageId, 85), to: `/video/${v.id}` };
    }
    const t = toTrack(raw);
    return { id: t.id, title: t.title, subtitle: t.artists.map((a) => a.name).join(', '), image: coverUrl(t.album.cover, 48), to: `/track/${t.id}` };
  });
}

export function BlocksTab() {
  const [kind, setKind] = useState<Kind>('tracks');
  const { data, loading, error } = useQuery(`settings:blocks:${kind}`, () => loadBlocks(kind));
  return (
    <div className={`${s.page} ${s.fullHeight}`} data-test="settings-blocks">
      <div className={s.header}>
        <h1 className={s.title}>Blocked</h1>
      </div>
      <TextTabs
        active={kind}
        tabs={[
          { id: 'tracks', label: 'Tracks', testId: 'blocks--tracks', onClick: () => setKind('tracks') },
          { id: 'videos', label: 'Videos', testId: 'blocks--videos', onClick: () => setKind('videos') },
          { id: 'artists', label: 'Profiles', testId: 'blocks--artists', onClick: () => setKind('artists') },
        ]}
      />
      {loading ? null : error ? (
        <div className={b.empty}>
          <p>Could not load your blocked content.</p>
        </div>
      ) : !data?.length ? (
        <div className={b.empty} data-test="blocks-empty">
          <BlockIcon size={120} className={b.emptyIcon} />
          <p>{EMPTY[kind]}</p>
        </div>
      ) : (
        <ul className={b.list} data-test="blocks-list">
          {data.map((it) => (
            <li key={it.id} className={b.item}>
              <Artwork src={it.image} size={48} round={it.round} radius={it.round ? undefined : 2} fallbackIcon={it.round ? 'artist' : 'album'} />
              <div className={b.text}>
                <Link to={it.to} className={`${b.title} link ellipsis`}>
                  {it.title}
                </Link>
                <span className={`${b.sub} ellipsis`}>{it.subtitle}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
