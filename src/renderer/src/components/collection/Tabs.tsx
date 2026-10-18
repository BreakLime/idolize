// The /my-collection/:tab views. Lists are fetched once (newest first) and sorted/filtered locally.
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { MediaItem, Track, Video } from '@/api/models';
import { playlistEdit } from '@/api/tidal';
import { PillButton } from '@/components/Buttons';
import { promptText } from '@/components/Dialog';
import { MediaGrid } from '@/components/HorizontalList';
import { CollectionIcon, type CollectionGlyph } from '@/components/icons/collection';
import { MediaTable, type Column } from '@/components/MediaTable';
import type { MenuItem } from '@/components/Menu';
import { navigate } from '@/lib/navigation';
import { invalidate, useQuery } from '@/lib/query';
import { useFavorites } from '@/state/favorites';
import { player, type PlaySource } from '@/state/player';
import * as data from './api';
import type { Entry } from './api';
import { GridCell } from './Cells';
import { Chips, CollectionPage, EmptyState, FilterInput, LoadError, openSortMenu, UnderlineTabs } from './parts';
import { loadSort, matchesFilter, nextSort, relativeAdded, saveSort, sortEntries, SORT_OPTIONS, type Sort, type SortKey, type SortTab } from './sorting';
import s from './Collection.module.css';

// ── shared state helpers ─────────────────────────────────────────────────────

function useSort(tab: SortTab): [Sort, (s: Sort) => void] {
  const [sort, setSort] = useState(() => loadSort(tab));
  return [
    sort,
    (next) => {
      setSort(next);
      saveSort(tab, next);
    },
  ];
}

const favKey = (i: MediaItem): [keyof ReturnType<typeof useFavorites.getState>['ids'], string] | null =>
  i.kind === 'folder' ? null : [i.kind, i.kind === 'playlist' ? i.uuid : String(i.id)];

/**
 * Hides entries the user un-hearted while this page is open (instant feedback; the invalidated
 * query refetches in the background). Only items seen as favorites are ever hidden, so own
 * playlists and folders are never affected.
 */
function useStillFavorite<T extends MediaItem>(entries: Entry<T>[] | undefined): Entry<T>[] | undefined {
  const ids = useFavorites((st) => st.ids);
  const loaded = useFavorites((st) => st.loaded);
  const seen = useRef(new Set<string>());
  return useMemo(() => {
    if (!entries || !loaded) return entries;
    return entries.filter((e) => {
      const k = favKey(e.item);
      if (!k) return true;
      const key = k.join(':');
      if (ids[k[0]].has(k[1])) {
        seen.current.add(key);
        return true;
      }
      return !seen.current.has(key);
    });
  }, [entries, ids, loaded]);
}

function useView<T extends MediaItem>(entries: Entry<T>[] | undefined, sort: Sort, filter: string) {
  const live = useStillFavorite(entries);
  return useMemo(() => (live ? sortEntries(live, sort).filter((e) => matchesFilter(e.item, filter)) : undefined), [live, sort, filter]);
}

// ── empty states (copy as in the real app) ───────────────────────────────────

interface EmptyCopy {
  icon: CollectionGlyph;
  text: string;
  action: string;
  to: string;
}
const added = (what: string, them = 'it') => `You haven't added any ${what} yet. Tap the heart icon on any ${what.replace(/s$/, '')} to add ${them} to your collection.`;
export const EMPTY: Record<'albums' | 'tracks' | 'artists' | 'playlists' | 'videos' | 'mixes', EmptyCopy> = {
  albums: { icon: 'albums', text: added('albums'), action: "View TIDAL's top albums", to: '/view/pages/mymusic_recommended_albums' },
  tracks: { icon: 'tracks', text: added('tracks'), action: "View TIDAL's top tracks", to: '/view/pages/mymusic_recommended_tracks' },
  artists: { icon: 'profiles', text: added('artists', 'them'), action: "View TIDAL's top artists", to: '/view/pages/mymusic_recommended_artists' },
  playlists: { icon: 'playlists', text: added('playlists'), action: "View TIDAL's top playlists", to: '/view/pages/mymusic_recommended_playlists' },
  videos: { icon: 'videos', text: added('videos'), action: "View TIDAL's top videos", to: '/view/pages/mymusic_recommended_videos' },
  mixes: {
    icon: 'mixes',
    text: "You haven't added any mixes yet. Tap the heart icon on any mix or radio to add it to your collection.",
    action: "View TIDAL's top mixes",
    to: '/view/pages/my_collection_my_mixes',
  },
};

// ── grid tabs (albums, playlists, profiles, mixes, videos) ────────────────────

type GridTabKind = 'albums' | 'artists' | 'playlists' | 'mixes' | 'videos';

const GRID_TABS: Record<GridTabKind, { title: string; filter: string; key: string; fetch: () => Promise<Entry[]>; emptyClass?: string }> = {
  albums: { title: 'Albums', filter: 'Filter albums', key: data.KEYS.albums, fetch: data.favoriteAlbums },
  artists: { title: 'Profiles', filter: 'Filter profiles', key: data.KEYS.artists, fetch: data.favoriteArtists },
  playlists: { title: 'Playlists', filter: 'Filter playlists', key: data.KEYS.playlists, fetch: () => data.folderEntries('root') },
  mixes: { title: 'Mixes & Radio', filter: 'Filter mixes', key: data.KEYS.mixes, fetch: data.favoriteMixes, emptyClass: s.emptyPadded },
  videos: { title: 'Videos', filter: 'Filter videos', key: data.KEYS.videos, fetch: data.favoriteVideos },
};

/** TIDAL's cell grids: 16px gaps, columns no narrower than ~200px (5 across at the default window). */
export function CellGrid({ entries }: { entries: Entry[] }) {
  const items = useMemo(() => entries.map((e) => e.item), [entries]);
  return <MediaGrid items={items} renderItem={(it) => <GridCell item={it} />} minItemWidth={200} gap={16} />;
}

async function createPlaylist() {
  const name = await promptText('Create playlist', 'Playlist title');
  if (!name) return;
  const r = await playlistEdit.create(name);
  invalidate('sidebar:');
  invalidate('collection:playlist');
  const uuid = r?.data?.uuid ?? r?.uuid;
  if (uuid) navigate(`/playlist/${uuid}`);
}

async function createFolder() {
  const name = await promptText('Create folder', 'Folder name');
  if (!name) return;
  await playlistEdit.createFolder(name);
  invalidate('sidebar:');
  invalidate('collection:playlist');
}

export function GridTab({ kind }: { kind: GridTabKind }) {
  const cfg = GRID_TABS[kind];
  const [sort, setSort] = useSort(kind);
  const [filter, setFilter] = useState('');
  const q = useQuery<Entry[]>(cfg.key, cfg.fetch);
  const view = useView(q.data, sort, filter);

  if (q.error && !q.data) return <LoadError onRetry={() => void q.refetch()} />;
  if (q.data && q.data.length === 0) {
    const e = EMPTY[kind];
    return <EmptyState icon={e.icon} text={e.text} action={e.action} to={e.to} className={cfg.emptyClass} />;
  }
  const extra: MenuItem[] =
    kind === 'playlists'
      ? [
          { label: 'Create playlist', testId: 'create-playlist', onClick: () => void createPlaylist() },
          { label: 'Create folder', testId: 'create-folder', onClick: () => void createFolder() },
        ]
      : [];
  return (
    <CollectionPage title={cfg.title} onOptions={(el) => openSortMenu(el, SORT_OPTIONS[kind], sort, setSort, extra)}>
      <div>
        <FilterInput placeholder={cfg.filter} value={filter} onChange={setFilter} />
        {view && <CellGrid entries={view} />}
      </div>
    </CollectionPage>
  );
}

// ── tracks ───────────────────────────────────────────────────────────────────

const COLUMN_SORT: Partial<Record<Column, { key: SortKey; dir: 'ASC' | 'DESC' }>> = {
  index: { key: 'added', dir: 'DESC' },
  title: { key: 'name', dir: 'ASC' },
  artist: { key: 'artist', dir: 'ASC' },
  album: { key: 'album', dir: 'ASC' },
  dateAdded: { key: 'added', dir: 'DESC' },
  time: { key: 'length', dir: 'ASC' },
};
const SORT_COLUMN: Record<SortKey, Column> = { added: 'dateAdded', updated: 'dateAdded', name: 'title', artist: 'artist', album: 'album', release: 'dateAdded', length: 'time' };
const TRACK_COLUMNS: Column[] = ['index', 'cover', 'title', 'artist', 'album', 'dateAdded', 'time'];
const TRACKS_SOURCE: PlaySource = { type: 'collection', id: 'tracks', title: 'My Collection', path: '/my-collection/tracks' };

export function TrackList({ entries, source, sort, onSort }: { entries: Entry[]; source: PlaySource | null; sort?: Sort; onSort?: (s: Sort) => void }) {
  const items = useMemo(() => entries.map((e) => e.item).filter((i): i is Track | Video => i.kind === 'track' || i.kind === 'video'), [entries]);
  return (
    <div className={s.tracks}>
      <MediaTable
        items={items}
        columns={TRACK_COLUMNS}
        source={source}
        formatDate={relativeAdded}
        sort={
          sort && onSort
            ? {
                column: SORT_COLUMN[sort.key],
                dir: sort.dir,
                onSort: (c) => {
                  const m = COLUMN_SORT[c];
                  if (m) onSort(nextSort(sort, m.key, m.dir));
                },
              }
            : undefined
        }
      />
    </div>
  );
}

export function TracksTab() {
  const [sort, setSort] = useSort('tracks');
  const [filter, setFilter] = useState('');
  const q = useQuery<Entry[]>(data.KEYS.tracks, data.favoriteTracks);
  const view = useView(q.data, sort, filter);
  const list = useMemo(() => (view ?? []).map((e) => e.item as Track), [view]);

  if (q.error && !q.data) return <LoadError onRetry={() => void q.refetch()} />;
  if (q.data && q.data.length === 0) {
    const e = EMPTY.tracks;
    return <EmptyState icon={e.icon} text={e.text} action={e.action} to={e.to} />;
  }
  return (
    <CollectionPage title="Tracks" testId="my-tracks-page" className={s.tracksPage}>
      <div className={s.buttons}>
        <PillButton icon="play" testId="play-all" disabled={!list.length} onClick={() => player.playList(list, 0, TRACKS_SOURCE, { shuffle: false })}>
          Play
        </PillButton>
        <PillButton icon="shuffle" variant="secondary" testId="shuffle-all" disabled={!list.length} onClick={() => player.playList(list, 0, TRACKS_SOURCE, { shuffle: true })}>
          Shuffle
        </PillButton>
      </div>
      <div>
        <FilterInput placeholder="Filter tracks" value={filter} onChange={setFilter} className={s.filterTracks} />
        {view && <TrackList entries={view} source={TRACKS_SOURCE} sort={sort} onSort={setSort} />}
      </div>
    </CollectionPage>
  );
}

// ── purchases (read-only) ────────────────────────────────────────────────────

export function PurchasesTab() {
  const [tab, setTab] = useState<'albums' | 'tracks'>('albums');
  const q = useQuery<Entry[]>(data.KEYS.purchases(tab), () => data.purchases(tab));
  return (
    <CollectionPage title="Purchases">
      <UnderlineTabs
        testId="purchases-tabs"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'albums', label: 'Albums', testId: 'purchases-albums-tab' },
          { id: 'tracks', label: 'Tracks', testId: 'purchases-tracks-tab' },
        ]}
      />
      {q.error && !q.data ? (
        <LoadError onRetry={() => void q.refetch()} />
      ) : q.data && q.data.length === 0 ? (
        <EmptyState
          icon="purchases"
          badge
          testId="empty-state-purchases"
          className={s.emptyInPage}
          text={`You haven't purchased any ${tab} yet. Discover music uploaded directly by artists.`}
          action="View Uploads"
          to="/?vibe=uploads"
        />
      ) : q.data ? (
        <div className={s.section}>{tab === 'albums' ? <CellGrid entries={q.data} /> : <TrackList entries={q.data} source={{ type: 'collection', id: 'purchases', title: 'Purchases' }} />}</div>
      ) : null}
    </CollectionPage>
  );
}

// ── save for later ───────────────────────────────────────────────────────────

type SflFilter = 'all' | 'albums' | 'tracks' | 'artists' | 'playlists' | 'videos';
const SFL_KIND: Record<Exclude<SflFilter, 'all'>, MediaItem['kind']> = { albums: 'album', tracks: 'track', artists: 'artist', playlists: 'playlist', videos: 'video' };

export function SaveForLaterTab() {
  const [f, setF] = useState<SflFilter>('all');
  const q = useQuery<Entry[]>(data.KEYS.saveForLater, data.saveForLater);
  const shown = useMemo(() => (q.data ?? []).filter((e) => f === 'all' || e.item.kind === SFL_KIND[f]), [q.data, f]);
  const empty = EMPTY[f === 'all' ? 'tracks' : f];
  return (
    <CollectionPage title="Save for Later">
      <Chips
        testPrefix="save-for-later-filter"
        value={f}
        onChange={setF}
        items={[
          { id: 'all', label: 'All' },
          { id: 'albums', label: 'Albums' },
          { id: 'tracks', label: 'Tracks' },
          { id: 'artists', label: 'Artists' },
          { id: 'playlists', label: 'Playlists' },
          { id: 'videos', label: 'Videos' },
        ]}
      />
      {q.error && !q.data ? (
        <LoadError onRetry={() => void q.refetch()} />
      ) : q.data && shown.length === 0 ? (
        <EmptyState icon={empty.icon} text={empty.text} action={empty.action} to={empty.to} testId="empty-state-save-for-later" className={s.emptySaved} />
      ) : q.data ? (
        <div className={s.section}>{f === 'tracks' ? <TrackList entries={shown} source={{ type: 'collection', id: 'save-for-later', title: 'Save for Later' }} /> : <CellGrid entries={shown} />}</div>
      ) : null}
    </CollectionPage>
  );
}

// ── /my-collection index ─────────────────────────────────────────────────────

export const SECTIONS: { tab: string; label: string; icon: CollectionGlyph; test: string }[] = [
  { tab: 'mixes', label: 'Mixes & Radio', icon: 'mixes', test: 'sidebar-collection-mixes-and-radio' },
  { tab: 'playlists', label: 'Playlists', icon: 'playlists', test: 'sidebar-collection-playlists' },
  { tab: 'albums', label: 'Albums', icon: 'albums', test: 'sidebar-collection-albums' },
  { tab: 'tracks', label: 'Tracks', icon: 'tracks', test: 'sidebar-collection-tracks' },
  { tab: 'videos', label: 'Videos', icon: 'videos', test: 'sidebar-collection-videos' },
  { tab: 'artists', label: 'Profiles', icon: 'profiles', test: 'sidebar-collection-artists' },
  { tab: 'purchases', label: 'Purchases', icon: 'purchases', test: 'sidebar-collection-purchases' },
  { tab: 'save-for-later', label: 'Save for Later', icon: 'save-for-later', test: 'sidebar-collection-save-for-later' },
];

export function CollectionIndex() {
  return (
    <CollectionPage title="Collection" testId="my-collection-page">
      <nav className={s.indexNav}>
        {SECTIONS.map((x) => (
          <Link key={x.tab} to={`/my-collection/${x.tab}`} className={s.indexItem} data-test={x.test}>
            {x.tab === 'purchases' ? (
              <span className={s.indexBadge}>
                <CollectionIcon name={x.icon} size={24} stroke={2} />
              </span>
            ) : (
              <CollectionIcon name={x.icon} size={24} stroke={2} className={s.indexIcon} />
            )}
            <span className={s.indexLabel}>{x.label}</span>
            <CollectionIcon name="chevron-right" size={16} stroke={1.8} className={s.indexChevron} />
          </Link>
        ))}
      </nav>
    </CollectionPage>
  );
}
