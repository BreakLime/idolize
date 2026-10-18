// /artist/:id — hero header + the v2 artist page modules (top tracks, carousels, credits, social links).
import { useCallback, useRef, useState } from 'react';
import { useParams } from 'react-router';
import type { Artist as ArtistModel, Track } from '@/api/models';
import type { FeedModule } from '@/api/tidal';
import { ArtistHeader } from '@/components/artist/ArtistHeader';
import { ArtistTrackTable } from '@/components/artist/ArtistTrackTable';
import { artistPage, creditTracks } from '@/components/artist/artistApi';
import { BioDialog } from '@/components/artist/BioDialog';
import { artistCard } from '@/components/artist/cards';
import { LoadError } from '@/components/artist/LoadError';
import { SocialLinks } from '@/components/artist/SocialLinks';
import { useMainWidth } from '@/components/artist/useMainWidth';
import { HorizontalList, SectionHeader } from '@/components/HorizontalList';
import { useQuery } from '@/lib/query';
import s from '@/components/artist/ArtistPage.module.css';

/** API view-all paths ("artist/ARTIST_ALBUMS/view-all?artistId=1") become app routes. */
export const viewAllPath = (m: FeedModule, artistId: string) => (m.type === 'ARTIST_TRACK_CREDITS_CARD' ? `/credits/${artistId}` : m.viewAll ? `/${m.viewAll.replace(/^\//, '')}` : undefined);

function Module({ m, id, name, topTracks }: { m: FeedModule; id: string; name: string; topTracks: Track[] }) {
  switch (m.type) {
    case 'TRACK_LIST':
      return (
        <div className={s.module}>
          <SectionHeader title={m.title} viewAll={viewAllPath(m, id)} />
          <ArtistTrackTable items={topTracks} source={{ type: 'artist', id, title: name, path: `/artist/${id}` }} />
        </div>
      );
    case 'ARTIST_TRACK_CREDITS_CARD': {
      const items = creditTracks(m);
      return (
        <div className={s.module}>
          <SectionHeader title={m.title} viewAll={viewAllPath(m, id)} />
          <ArtistTrackTable items={items} source={{ type: 'artist', id: `${id}-credits`, title: `${name} credits`, path: `/credits/${id}` }} />
        </div>
      );
    }
    case 'LINKS_LIST':
      return <SocialLinks title={m.title} links={(m.raw.items ?? []).map((x: { data: { siteName: string; url: string } }) => x.data)} />;
    default:
      if (!m.items.length) return null;
      return (
        <div className={s.carousel}>
          <HorizontalList title={m.title} items={m.items} moduleId={m.moduleId} viewAll={viewAllPath(m, id)} renderItem={artistCard} />
        </div>
      );
  }
}

export default function Artist() {
  const { id = '' } = useParams();
  const { data, error, refetch } = useQuery(id ? `artist:${id}:page` : null, () => artistPage(id));
  const [bio, setBio] = useState(false);
  const openBio = useCallback(() => setBio(true), []);
  const closeBio = useCallback(() => setBio(false), []);
  const root = useRef<HTMLDivElement>(null);
  useMainWidth(root);

  if (error && !data) return <LoadError error={error} onRetry={() => void refetch()} />;
  if (!data) return <div className={s.page} data-test="artist-profile" ref={root} />;

  const topModule = data.modules.find((m) => m.type === 'TRACK_LIST');
  const topTracks = (topModule?.items ?? []).filter((x): x is Track => x.kind === 'track');
  const artist: ArtistModel = { kind: 'artist', id: Number(id), name: data.header.name, picture: data.header.picture, mixId: data.header.mixId };

  return (
    <div className={s.page} data-test="artist-profile" ref={root}>
      <ArtistHeader id={id} info={data.header} artist={artist} tracks={topTracks} onReadMore={openBio} />
      <div className={s.modules}>
        {data.modules.map((m) => (
          <Module key={m.moduleId} m={m} id={id} name={data.header.name} topTracks={topTracks} />
        ))}
      </div>
      {bio && <BioDialog artistId={id} name={data.header.name} picture={data.header.picture} fallback={data.header.biography} onClose={closeBio} />}
    </div>
  );
}
