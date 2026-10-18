// Album page (also rendered for /album/:albumId/track/:id): header, track table with volumes,
// release/copyright footer, "More Albums by …" / "Related …" shelves, and the /credits sub-page.
import { useMemo } from 'react';
import { coverUrl } from '@/api/images';
import { formatDuration, trackTitle, type Album, type MediaItem, type Track, type Video } from '@/api/models';
import { albums, pageModuleItems, type Page } from '@/api/tidal';
import { navigate } from '@/lib/navigation';
import { useIsPlayingSource } from '@/lib/play';
import { useQuery } from '@/lib/query';
import { toggleFavorite, useIsFavorite } from '@/state/favorites';
import { player, usePlayer, type PlaySource } from '@/state/player';
import { HeaderAction, PillButton } from '../Buttons';
import { Icon } from '../Icon';
import { MediaTable, type Column } from '../MediaTable';
import { albumMenu } from '../menus';
import { MetaText, PageHeader } from '../PageHeader';
import { AlbumCredits } from './AlbumCredits';
import { DetailLoading, DetailError } from './DetailStates';
import { GridShelf } from './GridShelf';
import { ArtistLine, CompactAction, QualityTag, actionGroup, naturalAction } from './HeaderParts';
import { reportContent, shareMenu } from './shareReport';
import s from './AlbumView.module.css';

const COLUMNS: Column[] = ['index', 'title', 'artist', 'time'];

const longDate = (iso?: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' }) : '';

function countLabel(n: number, word = 'track') {
  return `${n} ${word.toUpperCase()}${n === 1 ? '' : 'S'}`;
}

export function AlbumView({ albumId, credits = false }: { albumId: string; credits?: boolean }) {
  const albumQ = useQuery(`album:${albumId}`, () => albums.get(albumId));
  const tracksQ = useQuery(`album-tracks:${albumId}`, () => albums.tracks(albumId));
  const pageQ = useQuery<Page | null>(`album-page:${albumId}`, () => albums.page(albumId).catch(() => null));
  const album = albumQ.data;

  if (albumQ.error && !album) return <DetailError error={albumQ.error} onRetry={() => void albumQ.refetch()} />;
  if (!album) return <DetailLoading />;
  return <AlbumContent album={album} items={tracksQ.data} page={pageQ.data ?? null} credits={credits} />;
}

function AlbumContent({ album, items, page, credits }: { album: Album; items?: (Track | Video)[]; page: Page | null; credits: boolean }) {
  const fav = useIsFavorite(album);
  const playingThis = useIsPlayingSource(album);
  const source: PlaySource = useMemo(() => ({ type: 'album', id: String(album.id), title: album.title, path: `/album/${album.id}` }), [album]);
  const list = items ?? [];
  const duration = album.duration || list.reduce((n, t) => n + t.duration, 0);
  const count = album.numberOfTracks || list.length;
  const itemsModule = page?.modules.find((m) => m.type === 'ALBUM_ITEMS');
  const releaseDate = itemsModule?.raw.releaseDate ?? album.releaseDate;
  const copyright = itemsModule?.raw.copyright ?? album.copyright;
  const shelves = (page?.modules ?? []).filter((m) => m.type === 'ALBUM_LIST' || m.type === 'ARTIST_LIST' || m.type === 'PLAYLIST_LIST' || m.type === 'MIX_LIST');

  const play = (shuffle = false) => {
    const st = usePlayer.getState();
    if (!shuffle && st.source?.type === 'album' && st.source.id === String(album.id)) return player.toggle();
    if (list.length) player.playList(list, 0, source, { shuffle });
  };
  const toCredits = () => navigate(`/album/${album.id}/credits`);
  const share = (e: React.MouseEvent<HTMLElement>) => shareMenu(e.currentTarget, 'album', album.id);
  const more = (e: React.MouseEvent<HTMLElement>) => void albumMenu(e.currentTarget, album);
  const year = album.releaseDate?.slice(0, 4);
  const menuCtx = useMemo(() => ({ albumId: album.id }), [album.id]);

  const header = (
    <PageHeader
      className={credits ? s.creditsHeader : undefined}
      layout={credits ? 'wide' : 'module'}
      image={coverUrl(album.cover, 240)}
      imageSmall={coverUrl(album.cover, 64)}
      backdrop={coverUrl(album.cover, 1280)}
      title={trackTitle(album)}
      subtitle={<ArtistLine artists={album.artists} />}
      smallSubtitle={<ArtistLine artists={album.artists} small />}
      meta={[
        <>
          <MetaText testId="grid-item-meta-item-count">{countLabel(count)}</MetaText>
          <MetaText>({formatDuration(duration)})</MetaText>
        </>,
        <>
          <MetaText testId="meta-release-date">{credits ? longDate(album.releaseDate) : year}</MetaText>
          <QualityTag tags={album.mediaTags} quality={album.audioQuality} />
        </>,
      ]}
      artOverlay={
        !credits && (
          <button type="button" className={s.coverCredits} data-test="credits-button" onClick={toCredits}>
            <span className={s.coverCreditsInner}>
              <Icon name="info" size={24} />
              <span>Credits</span>
            </span>
          </button>
        )
      }
      primary={
        <>
          <PillButton icon={playingThis ? 'pause' : 'play'} testId="play-all" onClick={() => play()} disabled={!list.length}>
            {playingThis ? 'Pause' : 'Play'}
          </PillButton>
          <PillButton icon="shuffle" variant="secondary" testId="shuffle-all" onClick={() => play(true)} disabled={!list.length}>
            Shuffle
          </PillButton>
        </>
      }
      actions={
        <>
          <div className={actionGroup}>
            <HeaderAction icon={fav ? 'heart-filled' : 'heart'} label={fav ? 'Added' : 'Add'} testId="favorite-button" role="switch" aria-checked={fav} onClick={() => void toggleFavorite(album)} />
            {!credits && <HeaderAction icon="info" label="Credits" testId="credits-button" onClick={toCredits} />}
            <HeaderAction icon="share" label="Share" testId="share-button" onClick={share} />
          </div>
          <HeaderAction icon="report" label="Report" testId="report-button" className={naturalAction} onClick={() => reportContent(album.artists[0]?.name)} />
          <HeaderAction icon="more" label="More" testId="show-context-menu-button" className={naturalAction} onClick={more} />
        </>
      }
      compact={
        <>
          <div className={actionGroup}>
            <CompactAction icon={playingThis ? 'pause' : 'play'} label={playingThis ? 'Pause' : 'Play'} testId="play-all" dim onClick={() => play()} />
            <CompactAction icon="shuffle" label="Shuffle" testId="shuffle-all" dim onClick={() => play(true)} />
            <CompactAction icon={fav ? 'heart-filled' : 'heart'} label={fav ? 'Added' : 'Add'} testId="favorite-button" onClick={() => void toggleFavorite(album)} />
            {!credits && <CompactAction icon="info" label="Credits" testId="credits-button" onClick={toCredits} />}
            <CompactAction icon="share" label="Share" testId="share-button" onClick={share} />
          </div>
          <CompactAction icon="report" label="Report" testId="report-button" natural onClick={() => reportContent(album.artists[0]?.name)} />
          <CompactAction icon="more" label="More" testId="show-context-menu-button" natural onClick={more} />
        </>
      }
    />
  );

  if (credits)
    return (
      <div className={s.page}>
        {header}
        <AlbumCredits album={album} />
      </div>
    );

  return (
    <div className={s.page}>
      {header}
      <div className={s.module} data-test="occluded-module">
        {items ? (
          <MediaTable items={list} source={source} numbering="trackNumber" volumes columns={COLUMNS} menuContext={menuCtx} />
        ) : (
          <div className={s.tableLoading} />
        )}
        {items && (
          <div className={s.footer}>
            <div className={s.footerLine}>
              {releaseDate && (
                <>
                  <span className={s.footerText} data-test="meta-release-date">
                    {longDate(releaseDate)}
                  </span>
                  <span className={s.footerText}>•</span>
                </>
              )}
              <span className={s.footerText} data-test="grid-item-meta-item-count">
                {countLabel(count)}
              </span>
              <span className={s.footerText}>({formatDuration(duration)})</span>
            </div>
            {copyright && <span className={s.footerText}>{copyright}</span>}
          </div>
        )}
      </div>
      {shelves.map((m) => (
        <GridShelf key={m.raw.id ?? m.title} title={m.title} items={pageModuleItems(m) as MediaItem[]} viewAll={m.raw.showMore?.apiPath ? `/view/${m.raw.showMore.apiPath}` : undefined} />
      ))}
    </div>
  );
}
