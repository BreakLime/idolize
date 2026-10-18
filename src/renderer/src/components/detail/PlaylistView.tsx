// Playlist page: header (editorial / other user's / own), filter field, track table, and for own playlists
// edit / visibility / delete / remove-track plus the "Recommended songs" module.
import { useCallback, useMemo, useState } from 'react';
import { squareUrl, wideUrl } from '@/api/images';
import { formatDuration, type Playlist, type Track, type Video } from '@/api/models';
import { playlistEdit, playlists } from '@/api/tidal';
import { navigate } from '@/lib/navigation';
import { useIsPlayingSource } from '@/lib/play';
import { fetchQuery, invalidate, setQueryData, setQueryPartial, useQuery } from '@/lib/query';
import { toggleFavorite, useIsFavorite } from '@/state/favorites';
import { player, usePlayer, type PlaySource } from '@/state/player';
import { useSession } from '@/state/session';
import { toast } from '@/state/ui';
import { HeaderAction, PillButton } from '../Buttons';
import { Icon } from '../Icon';
import { LockIcon, PencilIcon, SmallPlus, UnlockIcon } from '../icons/detail';
import { MediaTable, type Column } from '../MediaTable';
import { deletePlaylist, playlistMenu } from '../menus';
import { MetaText, PageHeader } from '../PageHeader';
import { playlistExtra, playlistMeta } from './detailApi';
import { DetailError, DetailLoading } from './DetailStates';
import { CompactAction, GlyphAction, actionGroup, naturalAction } from './HeaderParts';
import { editPlaylist } from './PlaylistDialogs';
import { shareMenu } from './shareReport';
import s from './PlaylistView.module.css';

const COLUMNS: Column[] = ['index', 'cover', 'title', 'artist', 'album', 'dateAdded', 'time'];
const SUGGESTED_PAGE = 6;

function fans(n: number) {
  const v = n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(n);
  return `${v} ${n === 1 ? 'FAN' : 'FANS'}`;
}

function matches(t: Track | Video, q: string) {
  const hay = [t.title, t.version ?? '', ...t.artists.map((a) => a.name), t.kind === 'track' ? t.album.title : ''].join(' ').toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

export function PlaylistView({ uuid }: { uuid: string }) {
  const pq = useQuery(`playlist:${uuid}`, () => playlists.get(uuid));
  const itemsKey = `playlist:${uuid}:items`;
  // big playlists: render the first page while the rest loads
  const iq = useQuery(itemsKey, () => playlists.items(uuid, (first) => setQueryPartial(itemsKey, first)));
  const xq = useQuery(`playlist:${uuid}:extra`, () => playlistExtra(uuid).catch(() => null));
  const p = pq.data;
  if (pq.error && !p) return <DetailError error={pq.error} onRetry={() => void pq.refetch()} />;
  if (!p) return <DetailLoading wide />;
  return (
    <PlaylistContent
      p={p}
      items={iq.data}
      itemsPending={iq.pending}
      loadAll={() => fetchQuery(itemsKey, () => playlists.items(uuid))}
      itemsError={iq.error}
      extra={xq.data ?? null}
      reloadItems={() => void iq.refetch()}
    />
  );
}

function PlaylistContent({
  p,
  items,
  itemsPending,
  loadAll,
  itemsError,
  extra,
  reloadItems,
}: {
  p: Playlist;
  items?: (Track | Video)[];
  /** items may still be partial (first page shown while the rest loads) */
  itemsPending: boolean;
  loadAll: () => Promise<(Track | Video)[]>;
  itemsError: unknown;
  extra: Awaited<ReturnType<typeof playlistExtra>> | null;
  reloadItems: () => void;
}) {
  const me = useSession((st) => st.auth?.userId);
  const own = !!me && p.creatorId === me;
  const fav = useIsFavorite(p);
  const playingThis = useIsPlayingSource(p);
  const [filter, setFilter] = useState('');
  const list = useMemo(() => items ?? [], [items]);
  const shown = useMemo(() => (filter.trim() ? list.filter((t) => matches(t, filter)) : list), [list, filter]);
  const source: PlaySource = useMemo(() => ({ type: 'playlist', id: p.uuid, title: p.title, path: `/playlist/${p.uuid}` }), [p.uuid, p.title]);
  const isPublic = p.isPublic ?? extra?.isPublic ?? false;
  const pl = useMemo(() => ({ ...p, isPublic }), [p, isPublic]);
  const count = p.numberOfTracks + p.numberOfVideos;
  const editorial = p.type === 'EDITORIAL' || p.creatorId === 0;
  const creator = own ? 'me' : editorial ? 'TIDAL' : p.creatorName || extra?.ownerName || 'user';

  const play = async (shuffle = false) => {
    const st = usePlayer.getState();
    if (!shuffle && st.source?.type === 'playlist' && st.source.id === p.uuid) return player.toggle();
    const all = itemsPending || !items ? await loadAll().catch(() => list) : list;
    if (all.length) player.playList(all, 0, source, { shuffle });
  };

  const onRemove = useCallback(
    async (i: number) => {
      const t = shown[i];
      const index = list.indexOf(t);
      if (index < 0) return;
      try {
        await playlistEdit.removeIndex(p.uuid, index);
        setQueryData<(Track | Video)[]>(`playlist:${p.uuid}:items`, (prev) => (prev ?? []).filter((_, k) => k !== index));
        invalidate(`playlist:${p.uuid}`);
        invalidate('sidebar:');
        toast(`Removed from ${p.title}`);
      } catch (e) {
        toast("Couldn't remove the track");
        console.warn('remove from playlist failed', e);
      }
    },
    [shown, list, p.uuid, p.title],
  );

  const toggleVisibility = async () => {
    try {
      await playlistMeta.setPublic(p.uuid, !isPublic);
      invalidate(`playlist:${p.uuid}`);
      invalidate('sidebar:');
      toast(isPublic ? 'Playlist is now private' : 'Playlist is now public');
    } catch {
      toast("Couldn't change the playlist's visibility");
    }
  };
  const onDelete = async () => {
    if (await deletePlaylist(p)) navigate('/my-collection/playlists');
  };
  const share = (e: React.MouseEvent<HTMLElement>) => shareMenu(e.currentTarget, 'playlist', p.uuid);
  const more = (e: React.MouseEvent<HTMLElement>) => void playlistMenu(e.currentTarget, pl, { onDelete: () => void onDelete() });
  const image = squareUrl(p.squareImage, 240) ?? wideUrl(p.image, 240);

  const actions = own ? (
    <>
      <div className={actionGroup}>
        <GlyphAction glyph={<PencilIcon />} label="Edit" testId="edit-button" onClick={() => editPlaylist(pl)} />
        <GlyphAction glyph={isPublic ? <UnlockIcon /> : <LockIcon />} label={isPublic ? 'Public' : 'Private'} testId="public-toggle-button" onClick={() => void toggleVisibility()} />
        <HeaderAction icon="share" label="Share" testId="share-button" onClick={share} />
      </div>
      <HeaderAction icon="more" label="More" testId="show-context-menu-button" className={naturalAction} onClick={more} />
    </>
  ) : (
    <>
      <div className={actionGroup}>
        <HeaderAction icon={fav ? 'heart-filled' : 'heart'} label={fav ? 'Added' : 'Add'} testId="favorite-button" role="switch" aria-checked={fav} onClick={() => void toggleFavorite(p)} />
        <HeaderAction icon="share" label="Share" testId="share-button" onClick={share} />
      </div>
      <HeaderAction icon="more" label="More" testId="show-context-menu-button" className={naturalAction} onClick={more} />
    </>
  );

  const compact = (
    <>
      <div className={actionGroup}>
        <CompactAction icon={playingThis ? 'pause' : 'play'} label={playingThis ? 'Pause' : 'Play'} testId="play-all" dim onClick={() => play()} />
        <CompactAction icon="shuffle" label="Shuffle" testId="shuffle-all" dim onClick={() => play(true)} />
        {own ? (
          <>
            <GlyphAction glyph={<PencilIcon />} label="Edit" testId="edit-button" onClick={() => editPlaylist(pl)} />
            <GlyphAction glyph={isPublic ? <UnlockIcon /> : <LockIcon />} label={isPublic ? 'Public' : 'Private'} testId="public-toggle-button" onClick={() => void toggleVisibility()} />
          </>
        ) : (
          <CompactAction icon={fav ? 'heart-filled' : 'heart'} label={fav ? 'Added' : 'Add'} testId="favorite-button" onClick={() => void toggleFavorite(p)} />
        )}
        <CompactAction icon="share" label="Share" testId="share-button" onClick={share} />
      </div>
      <CompactAction icon="more" label="More" testId="show-context-menu-button" natural onClick={more} />
    </>
  );

  const creatorLine = (
    <span className={s.creatorLine}>
      <span className={`${s.creator} ellipsis`} data-test="playlist-creator-text">
        {creator}
      </span>
      {own && (
        <button type="button" className={s.addCollaborator} data-test="add-collaborator" aria-label="Add collaborator" onClick={() => toast("Collaborative playlists aren't supported in Idolize")}>
          <SmallPlus />
        </button>
      )}
    </span>
  );

  return (
    <div className={s.page} data-test="playlist-page">
      <PageHeader
        layout="wide"
        testId="playlist-header-container"
        dataTestId="header-background"
        smallTestId="small-header"
        smallArtSize={68}
        image={image}
        imageSmall={squareUrl(p.squareImage, 68) ?? wideUrl(p.image, 68)}
        backdrop={squareUrl(p.squareImage, 1080) ?? wideUrl(p.image, 1080)}
        backdropBlur
        title={p.title}
        subtitle={creatorLine}
        smallSubtitle={
          <span className={`${s.creator} ellipsis`} data-test="playlist-creator-text">
            {creator}
          </span>
        }
        description={p.description ? <p>{p.description}</p> : undefined}
        meta={[
          <>
            <MetaText>{`${count} ${count === 1 ? 'TRACK' : 'TRACKS'}`}</MetaText>
            <MetaText>({formatDuration(p.duration)})</MetaText>
            {!!extra?.followers && (
              <>
                <MetaText muted>•</MetaText>
                <MetaText muted>{fans(extra.followers)}</MetaText>
              </>
            )}
          </>,
        ]}
        primary={
          <>
            <PillButton icon={playingThis ? 'pause' : 'play'} testId="play-all" onClick={() => void play()} disabled={!list.length && !count}>
              {playingThis ? 'Pause' : 'Play'}
            </PillButton>
            <PillButton icon="shuffle" variant="secondary" testId="shuffle-all" onClick={() => void play(true)} disabled={!list.length && !count}>
              Shuffle
            </PillButton>
          </>
        }
        actions={actions}
        compact={compact}
      />
      <div className={s.items}>
        {list.length > 0 && (
          <div className={s.filter}>
            <Icon name="search" size={16} />
            <input
              className={s.filterInput}
              data-test="playlist-filter-input"
              aria-label="Search"
              placeholder="Filter playlist on title, artist or album"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setFilter('')}
            />
          </div>
        )}
        {items ? (
          list.length ? (
            shown.length ? (
              <MediaTable items={shown} columns={COLUMNS} source={source} playlist={own ? pl : undefined} onRemove={own ? onRemove : undefined} dateStyle={editorial ? 'relative' : 'absolute'} />
            ) : (
              <p className={s.empty}>No tracks match “{filter}”.</p>
            )
          ) : (
            <div className={s.emptyState} data-test="empty-state">
              <h3 className={s.emptyTitle}>{own ? 'Your playlist is empty' : 'This playlist is empty'}</h3>
              {own && <p className={s.emptyText}>Find tracks you love and add them with the + button, or pick from the recommendations below.</p>}
            </div>
          )
        ) : itemsError ? (
          <DetailError error={itemsError} onRetry={reloadItems} />
        ) : (
          <div className={s.tableLoading} />
        )}
        {own && items && <Suggested p={p} />}
      </div>
    </div>
  );
}

/** "Recommended songs" for own playlists: 6 at a time, "Refresh list" pages through them. */
function Suggested({ p }: { p: Playlist }) {
  const q = useQuery(`playlist:${p.uuid}:recs`, () => playlists.recommendations(p.uuid).then((r) => r.items));
  const [page, setPage] = useState(0);
  const [added, setAdded] = useState<Set<number>>(() => new Set());
  const all = useMemo(() => (q.data ?? []).filter((t) => !added.has(t.id)), [q.data, added]);
  const pages = Math.max(1, Math.ceil(all.length / SUGGESTED_PAGE));
  const rows = all.slice((page % pages) * SUGGESTED_PAGE, (page % pages) * SUGGESTED_PAGE + SUGGESTED_PAGE);
  const source: PlaySource = useMemo(() => ({ type: 'playlist', id: `${p.uuid}:recommended`, title: `Recommended for ${p.title}`, path: `/playlist/${p.uuid}` }), [p.uuid, p.title]);
  const onAdd = useCallback(
    async (t: Track | Video) => {
      try {
        await playlistEdit.addTracks(p.uuid, [t.id]);
        setAdded((prev) => new Set(prev).add(t.id));
        invalidate(`playlist:${p.uuid}`);
        invalidate('sidebar:');
        toast(`Added to ${p.title}`);
      } catch {
        toast(`Couldn't add to ${p.title}`);
      }
    },
    [p.uuid, p.title],
  );
  if (!rows.length) return null;
  return (
    <div className={s.suggested}>
      <div className={s.suggestedHeader}>
        <h2 className={s.suggestedTitle}>Recommended songs</h2>
      </div>
      <MediaTable
        items={rows}
        columns={COLUMNS}
        source={source}
        showHeader={false}
        testId="media-table-suggested-items"
        rowActions="suggested"
        onAddSuggested={(t) => void onAdd(t)}
        numbering="position"
        hideNumbers
      />
      {pages > 1 && (
        <button type="button" className={s.refresh} onClick={() => setPage((n) => n + 1)}>
          Refresh list
        </button>
      )}
    </div>
  );
}
