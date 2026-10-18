// Playlist folder: title + "…" menu (create playlist, sorting, rename, delete) and its playlists (grid),
// or the "Start moving playlists to your folder." empty state.
import { useEffect, useRef, useState } from 'react';
import type { Folder, MediaItem, Playlist } from '@/api/models';
import { playlistEdit, user, type CollectionOrder } from '@/api/tidal';
import { navigate } from '@/lib/navigation';
import { invalidate, useQuery } from '@/lib/query';
import { useSession } from '@/state/session';
import { toast } from '@/state/ui';
import { confirmDialog, promptText } from '../Dialog';
import { Icon } from '../Icon';
import { FolderGlyph } from '../icons/detail';
import { openMenu, type MenuItem } from '../Menu';
import { folders, playlistMeta } from './detailApi';
import { DetailError } from './DetailStates';
import { GridCell } from './GridShelf';
import { pickPlaylist } from './PlaylistDialogs';
import s from './FolderView.module.css';

type Sort = { order: CollectionOrder; dir: 'ASC' | 'DESC' };
const SORTS: { label: string; order: CollectionOrder }[] = [
  { label: 'Created date', order: 'DATE' },
  { label: 'Updated date', order: 'DATE_UPDATED' as CollectionOrder },
  { label: 'Alphabetical', order: 'NAME' },
];

const GAP = 16;
const MIN = 200;

export function FolderView({ id }: { id: string }) {
  const [sort, setSort] = useState<Sort>({ order: 'DATE', dir: 'DESC' });
  const [filter, setFilter] = useState('');
  const meta = useQuery(`folder:${id}:meta`, () => folders.get(id));
  const q = useQuery(`folder:${id}:${sort.order}:${sort.dir}`, () => user.folder(id, sort.order, sort.dir));
  const me = useSession((st) => st.auth?.userId);
  const grid = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(6);
  useEffect(() => {
    const el = grid.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setCols(Math.max(2, Math.floor((e.contentRect.width + GAP) / (MIN + GAP)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [q.data]);

  const name = meta.data?.name ?? '';
  const items = (q.data ?? []).filter((x): x is Playlist | Folder => x.kind === 'playlist' || x.kind === 'folder');
  const needle = filter.trim().toLowerCase();
  const shown = needle ? items.filter((x) => (x.kind === 'folder' ? x.name : x.title).toLowerCase().includes(needle)) : items;

  const refresh = () => {
    invalidate(`folder:${id}`);
    invalidate('sidebar:');
    invalidate('detail:folders');
  };

  const movePlaylists = async () => {
    const own = (await user.ownPlaylists().catch(() => [] as Playlist[])).filter((p) => !me || p.creatorId === me);
    const here = new Set(items.filter((x): x is Playlist => x.kind === 'playlist').map((p) => p.uuid));
    pickPlaylist(
      own.filter((p) => !here.has(p.uuid)),
      async (p) => {
        try {
          await playlistMeta.moveToFolder(p.uuid, id);
          refresh();
          toast(`Moved ${p.title} to ${name || 'folder'}`);
        } catch {
          toast("Couldn't move the playlist");
        }
      },
      'Move playlists',
    );
  };

  const menu = (e: React.MouseEvent<HTMLElement>) => {
    const sortItems: MenuItem[] = SORTS.map((o) => ({
      label: o.label,
      checked: sort.order === o.order,
      onClick: () => setSort((cur) => (cur.order === o.order ? { order: o.order, dir: cur.dir === 'DESC' ? 'ASC' : 'DESC' } : { order: o.order, dir: o.order === 'NAME' ? 'ASC' : 'DESC' })),
    }));
    openMenu(e.currentTarget, [
      {
        label: 'Create playlist',
        testId: 'create-playlist',
        onClick: async () => {
          const title = await promptText('Create playlist', 'Playlist title');
          if (!title) return;
          try {
            const r = await playlistEdit.create(title, '', id);
            refresh();
            const uuid = r?.data?.uuid ?? r?.uuid;
            if (uuid) navigate(`/playlist/${uuid}`);
          } catch {
            toast("Couldn't create the playlist");
          }
        },
      },
      { label: 'Sorting', testId: 'sort', submenu: sortItems },
      {
        label: 'Rename folder',
        testId: 'rename-folder',
        onClick: async () => {
          const next = await promptText('Rename folder', 'Folder name', name);
          if (!next || next === name) return;
          try {
            await folders.rename(id, next);
            refresh();
          } catch {
            toast("Couldn't rename the folder");
          }
        },
      },
      {
        label: 'Delete folder',
        testId: 'delete-folder',
        onClick: async () => {
          if (!(await confirmDialog('Delete folder', `Are you sure you want to delete “${name}”? Playlists in it will be deleted too.`, 'Delete', true))) return;
          try {
            await playlistEdit.removeFolder(id);
            refresh();
            navigate('/my-collection/playlists');
          } catch {
            toast("Couldn't delete the folder");
          }
        },
      },
    ]);
  };

  if (q.error && !q.data) return <DetailError error={q.error} onRetry={() => void q.refetch()} />;

  return (
    <div className={s.page} data-test="page-title-container">
      <div className={s.titleRow}>
        <h1 className={s.title}>{name}</h1>
        <div className={s.titleActions}>
          <button type="button" className={s.more} data-test="folder-page-context-menu-button" aria-label="Show options" title="Show options" onClick={menu}>
            <Icon name="more" size={24} />
          </button>
        </div>
      </div>
      <div className={s.content} ref={grid}>
        {q.data === undefined ? null : items.length === 0 ? (
          <div className={s.empty} data-test="empty-state">
            <FolderGlyph />
            <h3 className={s.emptyText}>Start moving playlists to your folder.</h3>
            <button type="button" className={s.emptyButton} onClick={() => void movePlaylists()}>
              Move Playlists
            </button>
          </div>
        ) : (
          <>
            <div className={s.filter}>
              <Icon name="search" size={16} />
              <input
                className={s.filterInput}
                data-test="playlist-filter-input"
                aria-label="Search"
                placeholder="Filter playlists"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setFilter('')}
              />
            </div>
            <section className={s.grid} data-test="grid" role="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {shown.map((it: MediaItem) => (
                <div key={it.kind === 'folder' ? it.id : (it as Playlist).uuid} className={s.gridCell} role="row">
                  {it.kind === 'folder' ? <FolderCell f={it} /> : <GridCell item={it} variant="folder" />}
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function FolderCell({ f }: { f: Folder }) {
  return (
    <article className={s.folderCell} data-test="grid-item-folder" onClick={() => navigate(`/folder/${f.id}`)}>
      <div className={s.folderArt}>
        <Icon name="folder" size={48} />
      </div>
      <div className={`${s.folderName} ellipsis`}>{f.name}</div>
      <div className={s.folderSub}>
        {f.numberOfItems} {f.numberOfItems === 1 ? 'playlist' : 'playlists'}
      </div>
    </article>
  );
}
