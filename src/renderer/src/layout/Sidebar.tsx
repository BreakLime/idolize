import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { squareUrl } from '@/api/images';
import type { MediaItem } from '@/api/models';
import { playlistEdit, user, type CollectionOrder } from '@/api/tidal';
import { Artwork } from '@/components/Artwork';
import { promptText } from '@/components/Dialog';
import { DancingLogo } from '@/components/DancingLogo';
import { Icon, type IconName } from '@/components/Icon';
import { CollectionIcon, type CollectionGlyph } from '@/components/icons/collection';
import { MiniPlay, SortArrow } from '@/components/icons/sidebar';
import { openMenu, type MenuItem } from '@/components/Menu';
import { folderMenu, playlistMenu } from '@/components/menus';
import { playItem } from '@/lib/play';
import { invalidate, useQuery } from '@/lib/query';
import { useSession } from '@/state/session';
import { updateSettings, useSettings } from '@/state/settings';
import { OverlayScrollbar } from './OverlayScrollbar';
import s from './Sidebar.module.css';

const NAV: { to: string; label: string; icon: IconName; test: string; end?: boolean }[] = [
  { to: '/', label: 'Music', icon: 'music', test: 'sidebar-music', end: true },
  { to: '/view/pages/explore', label: 'Explore', icon: 'globe', test: 'sidebar-explore' },
  { to: '/feed', label: 'Feed', icon: 'bell', test: 'sidebar-feed' },
];

const COLLECTION: { to: string; label: string; icon: CollectionGlyph; test: string }[] = [
  { to: '/my-collection/mixes', label: 'Mixes & Radio', icon: 'mixes', test: 'sidebar-collection-mixes-and-radio' },
  { to: '/my-collection/playlists', label: 'Playlists', icon: 'playlists', test: 'sidebar-collection-playlists' },
  { to: '/my-collection/albums', label: 'Albums', icon: 'albums', test: 'sidebar-collection-albums' },
  { to: '/my-collection/tracks', label: 'Tracks', icon: 'tracks', test: 'sidebar-collection-tracks' },
  { to: '/my-collection/videos', label: 'Videos', icon: 'videos', test: 'sidebar-collection-videos' },
  { to: '/my-collection/artists', label: 'Profiles', icon: 'profiles', test: 'sidebar-collection-artists' },
  { to: '/my-collection/purchases', label: 'Purchases', icon: 'purchases', test: 'sidebar-collection-purchases' },
  { to: '/my-collection/save-for-later', label: 'Save for Later', icon: 'save-for-later', test: 'sidebar-collection-save-for-later' },
];

// ── "Sorting & Filter" (TIDAL's sidebar list menu), remembered per profile ──

type Filter = '' | 'USER_PLAYLIST' | 'FAVORITE_PLAYLIST';
interface ListSort {
  order: CollectionOrder;
  dir: 'ASC' | 'DESC';
  filter: Filter;
}
const SORTS: { label: string; order: CollectionOrder; test: string }[] = [
  { label: 'Created date', order: 'DATE', test: 'sort-created' },
  { label: 'Updated date', order: 'DATE_UPDATED', test: 'sort-updated' },
  { label: 'Alphabetical', order: 'NAME', test: 'sort-alphabetical' },
];
const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All playlists', value: '' },
  { label: 'Your playlists', value: 'USER_PLAYLIST' },
  { label: 'Followed playlists', value: 'FAVORITE_PLAYLIST' },
];
const SORT_KEY = 'idolize:sidebar-sort';
const DEFAULT_SORT: ListSort = { order: 'DATE_UPDATED', dir: 'DESC', filter: '' };

function loadSort(): ListSort {
  try {
    const v = JSON.parse(localStorage.getItem(SORT_KEY) ?? 'null') as Partial<ListSort> | null;
    if (v && SORTS.some((o) => o.order === v.order) && (v.dir === 'ASC' || v.dir === 'DESC') && FILTERS.some((f) => f.value === v.filter)) return v as ListSort;
  } catch {
    /* storage unavailable: defaults */
  }
  return DEFAULT_SORT;
}
function saveSort(v: ListSort) {
  try {
    localStorage.setItem(SORT_KEY, JSON.stringify(v));
  } catch {
    /* not persisted */
  }
}

const rowKey = (it: MediaItem) => (it.kind === 'playlist' ? it.uuid : it.kind === 'folder' ? `folder-${it.id}` : String(Math.random()));

/** Collapsed sidebar: "Title · Subtitle" bubble beside a playlist row (fixed, since the list's scroller would clip it). */
type RowTip = { text: string; top: number; left: number } | null;

function PlaylistRow({ item, collapsed, onTip }: { item: MediaItem; collapsed: boolean; onTip: (tip: RowTip) => void }) {
  const myId = useSession((st) => st.auth?.userId);
  if (item.kind !== 'playlist' && item.kind !== 'folder') return null;
  const to = item.kind === 'folder' ? `/folder/${item.id}` : `/playlist/${item.uuid}`;
  const title = item.kind === 'folder' ? item.name : item.title;
  let sub: string;
  if (item.kind === 'folder') sub = `${item.numberOfItems} playlist${item.numberOfItems === 1 ? '' : 's'}`;
  else if (item.creatorId === myId || item.type === 'USER') sub = `${item.numberOfTracks} item${item.numberOfTracks === 1 ? '' : 's'}`;
  else sub = item.creatorName || (item.type === 'EDITORIAL' ? 'TIDAL' : '');
  const menu = (e: React.MouseEvent) => {
    e.preventDefault();
    const at = { clientX: e.clientX, clientY: e.clientY };
    if (item.kind === 'folder') folderMenu(at, item);
    else void playlistMenu(at, item);
  };
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `${s.plRow} ${isActive ? s.plActive : ''}`}
      data-test="sidebar-playlist"
      onContextMenu={menu}
      onMouseEnter={(e) => {
        if (!collapsed) return;
        const r = e.currentTarget.getBoundingClientRect();
        onTip({ text: sub ? `${title} · ${sub}` : title, top: r.top + (r.height - 40) / 2, left: r.right + 8 });
      }}
      onMouseLeave={() => onTip(null)}
    >
      {item.kind === 'folder' ? (
        <span className={s.thumb}>
          <Icon name="folder" size={16} className={s.folderGlyph} />
        </span>
      ) : (
        <span className={s.thumb}>
          <Artwork src={squareUrl(item.squareImage ?? item.image, 80)} size={36} radius={0} fallbackIcon="playlist" className={s.thumbArt} />
          {/* TIDAL: no play overlay while collapsed (the bubble names the playlist instead) */}
          {!collapsed && (
            <span className={s.overlay}>
              <button
                type="button"
                className={s.overlayPlay}
                aria-label="Play"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void playItem(item);
                }}
              >
                <MiniPlay />
              </button>
            </span>
          )}
        </span>
      )}
      {!collapsed && (
        <span className={s.plText}>
          <span className={`${s.plTitle} ellipsis`}>{title}</span>
          <span className={`${s.plSub} ellipsis`}>{sub}</span>
        </span>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const listsRef = useRef<HTMLDivElement>(null);
  const collapsed = useSettings((st) => st.settings?.sidebarCollapsed ?? false);
  const loggedIn = useSession((st) => st.auth?.loggedIn);
  const [sort, setSortState] = useState<ListSort>(loadSort);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [rowTip, setRowTip] = useState<RowTip>(null);
  useEffect(() => {
    // a scrolled list or an expanded sidebar leaves no row under the bubble
    const el = listsRef.current;
    const hide = () => setRowTip(null);
    el?.addEventListener('scroll', hide, { passive: true });
    hide();
    return () => el?.removeEventListener('scroll', hide);
  }, [collapsed]);
  const nav = useNavigate();
  const loc = useLocation();
  const { data: items } = useQuery(loggedIn ? `sidebar:folder:root:${sort.order}:${sort.dir}:${sort.filter}` : null, () => user.folder('root', sort.order, sort.dir, sort.filter));
  const inCollection = loc.pathname.startsWith('/my-collection');

  // fixed layers (detail headers' compact bar) start at the sidebar's edge
  useEffect(() => {
    document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
  }, [collapsed]);

  const setSort = (v: ListSort) => {
    setSortState(v);
    saveSort(v);
  };

  const create = (e: React.MouseEvent<HTMLButtonElement>) =>
    openMenu(e.currentTarget, [
      {
        label: 'Create playlist',
        icon: 'playlist',
        testId: 'create-playlist',
        onClick: async () => {
          const name = await promptText('Create playlist', 'Playlist title');
          if (!name) return;
          const r = await playlistEdit.create(name);
          invalidate('sidebar:');
          invalidate('collection:playlist');
          const uuid = r?.data?.uuid ?? r?.uuid;
          if (uuid) nav(`/playlist/${uuid}`);
        },
      },
      {
        label: 'Create folder',
        icon: 'folder',
        testId: 'create-folder',
        onClick: async () => {
          const name = await promptText('Create folder', 'Folder name');
          if (!name) return;
          await playlistEdit.createFolder(name);
          invalidate('sidebar:');
          invalidate('collection:playlist');
        },
      },
    ]);

  const sortMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    const items: MenuItem[] = [
      { heading: 'Sort' },
      ...SORTS.map(
        (o): MenuItem => ({
          label: o.label,
          testId: o.test,
          // TIDAL: a white arrow 8px from the row's edge
          trail:
            sort.order === o.order ? (
              <span style={{ display: 'flex', marginRight: -4, color: 'var(--c-text)' }}>
                <SortArrow descending={sort.dir === 'DESC'} />
              </span>
            ) : undefined,
          // the active order flips direction; another starts descending (A→Z for names)
          onClick: () => setSort({ ...sort, order: o.order, dir: sort.order === o.order ? (sort.dir === 'DESC' ? 'ASC' : 'DESC') : o.order === 'NAME' ? 'ASC' : 'DESC' }),
        }),
      ),
      { separator: true, wide: true },
      { heading: 'Filter' },
      ...FILTERS.map((f): MenuItem => ({ label: f.label, selected: sort.filter === f.value, onClick: () => setSort({ ...sort, filter: f.value }) })),
    ];
    // TIDAL drops this menu just below-right of the pointer (keyboard: under the button)
    const at = e.detail ? { clientX: e.clientX + 7, clientY: e.clientY + 7 } : e.currentTarget;
    openMenu(at, items, { testId: 'folders-playlists-sort-menu' });
  };

  return (
    <div className={`${s.wrapper} ${collapsed ? s.collapsed : ''}`} data-test="main-layout-sidebar-wrapper">
      <aside className={s.aside}>
        <div className={s.top}>
          {collapsed ? (
            // collapsed: the logo is the expand control (the arrow replaces it on hover)
            <button className={`${s.logo} ${s.logoExpand}`} type="button" data-test="sidebar-expand" aria-label="Expand sidebar" onClick={() => updateSettings({ sidebarCollapsed: false })}>
              <span className={s.logoMark}>
                <DancingLogo />
              </span>
              <Icon name="sidebar-expand" size={16} className={s.expandIcon} />
            </button>
          ) : (
            <>
              <button className={s.logo} type="button" data-test="sidebar-logo" aria-label="Home" onClick={() => nav('/')}>
                <DancingLogo />
              </button>
              <button className={s.collapse} type="button" data-test="sidebar-collapse" aria-label="Collapse sidebar" onClick={() => updateSettings({ sidebarCollapsed: true })}>
                <Icon name="sidebar-collapse" size={16} />
              </button>
            </>
          )}
        </div>
        <nav className={s.nav}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `${s.item} ${isActive ? s.active : ''}`} data-test={n.test}>
              <Icon name={n.icon} size={24} />
              <span className={`${s.label} ellipsis`}>{n.label}</span>
              {collapsed && (
                <span className={s.tip} role="tooltip">
                  {n.label}
                </span>
              )}
            </NavLink>
          ))}
          <div className={s.collectionWrap} onMouseEnter={() => setCollectionOpen(true)} onMouseLeave={() => setCollectionOpen(false)}>
            <button type="button" className={`${s.item} ${inCollection ? s.active : ''}`} data-test="sidebar-collection-menu" onClick={() => nav('/my-collection')}>
              <Icon name="collection" size={24} />
              <span className={`${s.label} ellipsis`}>Collection</span>
              <Icon name="chevron-right" size={16} className={s.chev} />
            </button>
            {/* always mounted (like TIDAL) and faded in on hover */}
            <div className={`${s.flyout} ${collectionOpen ? s.flyoutOpen : ''}`} role="menu" aria-hidden={!collectionOpen}>
              {COLLECTION.map((c) => (
                <NavLink
                  key={c.to}
                  to={c.to}
                  className={({ isActive }) => `${s.flyItem} ${isActive ? s.active : ''}`}
                  data-test={c.test}
                  tabIndex={collectionOpen ? 0 : -1}
                  onClick={() => setCollectionOpen(false)}
                >
                  <CollectionIcon name={c.icon} size={24} stroke={2} className={s.flyIcon} />
                  <span>{c.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </nav>
        <div className={s.listsWrap}>
          <div className={s.lists} ref={listsRef}>
            <div className={s.listHeader}>
              {!collapsed && <span className={s.listTitle}>All playlists</span>}
              <div className={s.listActions}>
                <button type="button" className={s.iconBtn} data-test="create-folder-or-playlist" aria-label="Create" onClick={create}>
                  <Icon name="plus-circle" size={16} />
                </button>
                {!collapsed && (
                  <button type="button" className={s.iconBtn} data-test="sidebar-sort" aria-label="Sorting & Filter" onClick={sortMenu}>
                    <Icon name="sort" size={16} />
                  </button>
                )}
              </div>
            </div>
            <nav className={s.scroll} data-test="sidebar-scrollable-nav" aria-label="Playlists">
              {(items ?? []).map((it) => (
                <PlaylistRow key={rowKey(it)} item={it} collapsed={collapsed} onTip={setRowTip} />
              ))}
            </nav>
            {rowTip &&
              createPortal(
                <span className={`${s.tip} ${s.tipFixed}`} role="tooltip" style={{ top: rowTip.top, left: rowTip.left }}>
                  {rowTip.text}
                </span>,
                document.body,
              )}
          </div>
          <OverlayScrollbar target={listsRef} />
        </div>
      </aside>
    </div>
  );
}
