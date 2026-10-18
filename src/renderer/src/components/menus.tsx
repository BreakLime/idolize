// Context menus for media items (right-click and "…" buttons), with TIDAL's items and order.
import type { Album, Artist, Folder, MediaItem, Mix, Playlist, Track, Video } from '@/api/models';
import { artistNames, formatDuration, trackTitle } from '@/api/models';
import { artistUrl, coverUrl, mixImageUrl, squareUrl, videoImageUrl, wideUrl } from '@/api/images';
import { artists as artistsApi, playlistEdit, tracks as tracksApi, user } from '@/api/tidal';
import { navigate } from '@/lib/navigation';
import { playItem, sourceOf, tracksOf } from '@/lib/play';
import { invalidate, fetchQuery, setQueryData } from '@/lib/query';
import { toggleFavorite, useFavorites } from '@/state/favorites';
import { player } from '@/state/player';
import { useSession } from '@/state/session';
import { toast } from '@/state/ui';
import { openArtistBio } from './artist/bioHost';
import { confirmDialog, promptText, showDialog } from './Dialog';
import { openMenu, type MenuItem } from './Menu';
import { CreditsList } from './CreditsList';
import { blocks, folders, playlistMeta, saveForLater } from './detail/detailApi';
import { editPlaylist, pickPlaylist } from './detail/PlaylistDialogs';

type At = HTMLElement | { clientX: number; clientY: number };

const isFav = (kind: 'track' | 'album' | 'artist' | 'playlist' | 'video' | 'mix', id: string | number) => useFavorites.getState().ids[kind].has(String(id));

const copy = (text: string, what = 'Link') => {
  void navigator.clipboard.writeText(text);
  toast(`${what} copied to clipboard`);
};

// ── shared submenus ──────────────────────────────────────────────────────────

const LinkGlyph = () => (
  <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden="true">
    <path d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2.2-2.2a2.6 2.6 0 0 0-3.7-3.7l-.9.9M9.4 6.6a2.6 2.6 0 0 0-3.7 0L3.5 8.8a2.6 2.6 0 0 0 3.7 3.7l.9-.9" />
  </svg>
);
const CodeGlyph = () => (
  <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" />
  </svg>
);
const PlusCircle = () => (
  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, marginLeft: 12, marginRight: 2, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }}>
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden="true">
      <path d="M6 1.5v9M1.5 6h9" />
    </svg>
  </span>
);

const EMBED: Record<string, string> = { track: 'tracks', video: 'videos', album: 'albums', playlist: 'playlists', mix: 'mixes' };

export function shareItems(kind: string, id: string | number): MenuItem[] {
  const url = `https://tidal.com/${kind}/${id}`;
  const items: MenuItem[] = [
    { header: { title: 'Share with anyone', subtitle: 'Music shared from TIDAL can be opened on other services' } },
    { label: 'Copy link', leading: <LinkGlyph />, testId: 'copy-share-link', onClick: () => copy(url) },
  ];
  if (EMBED[kind])
    items.push({
      label: 'Copy embed code',
      leading: <CodeGlyph />,
      testId: 'share-embed',
      onClick: () =>
        copy(`<iframe src="https://embed.tidal.com/${EMBED[kind]}/${id}" width="100%" height="300" allow="encrypted-media" sandbox="allow-same-origin allow-scripts allow-forms allow-popups" title="TIDAL Embed Player"></iframe>`, 'Embed code'),
    });
  return items;
}

const shareItem = (kind: string, id: string | number): MenuItem => ({ label: 'Share', testId: 'share', submenu: shareItems(kind, id) });

/** The user's own playlists, most recently updated first. */
async function ownPlaylists(): Promise<Playlist[]> {
  const me = useSession.getState().auth?.userId;
  const all = (await fetchQuery('sidebar:own-playlists', () => user.ownPlaylists()).catch(() => [] as Playlist[])).filter((p) => !me || p.creatorId === me);
  return [...all].sort((a, b) => (b.lastUpdated ?? '').localeCompare(a.lastUpdated ?? ''));
}

async function addTracksTo(p: Playlist, trackIds: number[]) {
  if (!trackIds.length) return;
  try {
    await playlistEdit.addTracks(p.uuid, trackIds);
    invalidate(`playlist:${p.uuid}`);
    invalidate('sidebar:');
    toast(`Added to ${p.title}`);
  } catch (e) {
    toast(`Couldn't add to ${p.title}`);
    console.warn('add to playlist failed', e);
  }
}

/** "Add to playlist" submenu: create, show all, recent playlists. `ids` may be lazy (album/playlist sources). */
async function addToPlaylistItems(ids: number[] | (() => Promise<number[]>)): Promise<MenuItem[]> {
  const resolve = async () => (typeof ids === 'function' ? await ids() : ids);
  const mine = await ownPlaylists();
  return [
    {
      label: 'Create new playlist',
      leading: <PlusCircle />,
      tall: true,
      testId: 'create-new-playlist',
      onClick: async () => {
        const name = await promptText('Create playlist', 'Playlist title');
        if (!name) return;
        const r = await playlistEdit.create(name);
        const uuid = r?.data?.uuid ?? r?.uuid;
        invalidate('sidebar:');
        if (uuid) await addTracksTo({ uuid, title: name } as Playlist, await resolve());
      },
    },
    { label: 'Show all playlists', onClick: () => pickPlaylist(mine, (p) => void resolve().then((l) => addTracksTo(p, l))) },
    ...(mine.length ? [{ section: 'Recent' } as MenuItem] : []),
    ...mine.slice(0, 5).map((p, i) => ({ label: p.title, testId: `sub-menu-item-recent-playlist-${i}`, onClick: () => void resolve().then((l) => addTracksTo(p, l)) })),
  ];
}

/** The "+" button on track rows: straight to the playlist picker. */
export async function addToPlaylistMenu(at: At, trackIds: number[]) {
  openMenu(at, await addToPlaylistItems(trackIds), { testId: 'add-to-playlist-menu' });
}

const trackIdsOf = async (item: Album | Playlist | Mix) => (await tracksOf(item)).filter((t): t is Track => t.kind === 'track').map((t) => t.id);

// ── save for later ───────────────────────────────────────────────────────────

type SflKind = 'tracks' | 'albums' | 'playlists' | 'videos' | 'artists';
const sflIds = () => fetchQuery('sfl:ids', () => saveForLater.ids()).catch(() => new Set<string>());

export async function saveForLaterItem(kind: SflKind, id: string | number): Promise<MenuItem> {
  const saved = (await sflIds()).has(`${kind}:${id}`);
  return {
    label: saved ? 'Remove from Save for Later' : 'Save for Later',
    testId: 'save-for-later',
    onClick: async () => {
      try {
        await (saved ? saveForLater.remove(kind, id) : saveForLater.add(kind, id));
        setQueryData<Set<string>>('sfl:ids', (prev) => {
          const next = new Set(prev ?? []);
          if (saved) next.delete(`${kind}:${id}`);
          else next.add(`${kind}:${id}`);
          return next;
        });
        invalidate('collection:saved');
        toast(saved ? 'Removed from Save for Later' : 'Saved for later');
      } catch (e) {
        toast("Couldn't update Save for Later");
        console.warn('save for later failed', e);
      }
    },
  };
}

// ── track / video ────────────────────────────────────────────────────────────

export interface TrackMenuContext {
  playlist?: Playlist;
  index?: number;
  onRemove?: () => void;
  /** opened on this album's page: no "Go to album" */
  albumId?: number;
  /** mix/radio rows: Block submenu */
  radio?: boolean;
}

export async function trackMenu(at: At, t: Track | Video, ctx: TrackMenuContext = {}) {
  const track = t.kind === 'track' ? t : null;
  const fav = isFav(t.kind, t.id);
  const [playlistItems, sfl] = await Promise.all([addToPlaylistItems([t.id]), saveForLaterItem(track ? 'tracks' : 'videos', t.id)]);
  const items: MenuItem[] = [
    {
      header: {
        image: track ? coverUrl(track.album.cover, 80) : videoImageUrl(t.kind === 'video' ? t.imageId : null, 80),
        title: trackTitle(t),
        subtitle: artistNames(t.artists),
      },
    },
    { label: 'Play next', testId: 'play-next', onClick: () => player.playNext([t]) },
  ];
  items.push({ label: 'Add to playlist', testId: 'add-to-playlist', submenu: playlistItems });
  if (ctx.playlist && ctx.index !== undefined && ctx.onRemove) items.push({ label: 'Remove from playlist', testId: 'remove-from-playlist', onClick: ctx.onRemove });
  items.push(
    { label: fav ? 'Remove from My Collection' : 'Add to My Collection', testId: 'add-to-remove-from-collection', onClick: () => void toggleFavorite(t) },
    sfl,
  );
  if (track) {
    items.push({ label: 'Go to track radio', testId: 'track-radio', link: true, onClick: () => void playTrackRadio(track) });
    if (ctx.albumId !== track.album.id) items.push({ label: 'Go to album', testId: 'go-to-album', onClick: () => navigate(`/album/${track.album.id}`) });
    items.push({ label: 'Credits', testId: 'show-track-info', onClick: () => void showCredits(track) });
  }
  if (t.artists.length > 1)
    items.push({ label: 'Go to artist', testId: 'go-to-artist', submenu: t.artists.map((a) => ({ label: a.name, onClick: () => navigate(`/artist/${a.id}`) })) });
  else if (t.artists[0]) items.push({ label: 'Go to artist', testId: 'go-to-artist', onClick: () => navigate(`/artist/${t.artists[0].id}`) });
  items.push(shareItem(t.kind, t.id));
  if (ctx.radio && track)
    items.push({
      label: 'Block',
      testId: 'block',
      submenu: [
        { label: 'Block track', testId: 'block-track', onClick: () => void blockTrack(track) },
        ...(track.artists[0] ? [{ label: 'Block artist', testId: 'block-artist', onClick: () => void blockArtist(track.artists[0].id, track.artists[0].name) }] : []),
      ],
    });
  openMenu(at, items);
}

async function playTrackRadio(t: Track) {
  if (t.mixId) return navigate(`/mix/${t.mixId}`);
  const r = await tracksApi.radio(t.id);
  player.playList([t, ...r.items.filter((x) => x.id !== t.id)], 0, { type: 'radio', id: String(t.id), title: `${trackTitle(t)} radio` });
}

async function showCredits(t: Track) {
  const credits = await tracksApi.credits(t.id).catch(() => []);
  await showDialog(`Credits · ${trackTitle(t)}`, <CreditsList credits={credits} />);
}

/** Radio/mix "Block" (row button and menu). */
export async function blockTrack(t: Track | Video) {
  if (!(await confirmDialog('Block track', `“${trackTitle(t)}” won't be played in your mixes and radio anymore. You can unblock it in Settings.`, 'Block'))) return;
  try {
    await blocks.track(t.id);
    toast('Track blocked');
  } catch (e) {
    toast("Couldn't block the track");
    console.warn('block failed', e);
  }
}

export async function blockArtist(id: number, name: string) {
  if (!(await confirmDialog('Block artist', `${name} won't be played in your mixes and radio anymore. You can unblock them in Settings.`, 'Block'))) return;
  try {
    await blocks.artist(id);
    toast('Artist blocked');
  } catch (e) {
    toast("Couldn't block the artist");
    console.warn('block failed', e);
  }
}

// ── album ────────────────────────────────────────────────────────────────────

export async function albumMenu(at: At, a: Album) {
  const fav = isFav('album', a.id);
  const [playlistItems, sfl] = await Promise.all([addToPlaylistItems(() => trackIdsOf(a)), saveForLaterItem('albums', a.id)]);
  openMenu(at, [
    { header: { image: coverUrl(a.cover, 80), title: a.title, subtitle: artistNames(a.artists), imageTestId: 'context-menu-album-image' } },
    { label: 'Play now', testId: 'play-now', onClick: () => void playNow(a) },
    { label: 'Play next', testId: 'play-next', onClick: () => void tracksOf(a).then((l) => player.playNext(l)) },
    { label: 'Add to playlist', testId: 'add-to-playlist', submenu: playlistItems },
    { label: fav ? 'Remove from My Collection' : 'Add to My Collection', testId: 'add-to-remove-from-collection', onClick: () => void toggleFavorite(a) },
    sfl,
    ...(a.artists[0] ? [{ label: 'Go to artist', testId: 'go-to-artist', onClick: () => navigate(`/artist/${a.artists[0].id}`) }] : []),
    shareItem('album', a.id),
  ]);
}

async function playNow(item: Album | Playlist | Mix) {
  player.playList(await tracksOf(item), 0, sourceOf(item), { shuffle: false });
}

// ── playlist ─────────────────────────────────────────────────────────────────

export interface PlaylistMenuOptions {
  onDelete?: () => void;
  /** own playlists: called after a successful edit / visibility change */
  onChanged?: () => void;
}

export async function playlistMenu(at: At, p: Playlist, opts: PlaylistMenuOptions = {}) {
  const me = useSession.getState().auth?.userId;
  const own = !!me && p.creatorId === me;
  const fav = isFav('playlist', p.uuid);
  const count = p.numberOfTracks + p.numberOfVideos;
  const [playlistItems, sfl] = await Promise.all([addToPlaylistItems(() => trackIdsOf(p)), saveForLaterItem('playlists', p.uuid)]);
  const items: MenuItem[] = [
    {
      header: {
        image: squareUrl(p.squareImage, 80) ?? wideUrl(p.image, 80),
        title: p.title,
        subtitle: `${count} ${count === 1 ? 'item' : 'items'} (${formatDuration(p.duration)})`,
        imageTestId: 'context-menu-playlist-image',
      },
    },
    { label: 'Play now', testId: 'play-now', onClick: () => void playNow(p) },
    { label: 'Shuffle', testId: 'shuffle', onClick: () => void playItem(p, { shuffle: true }) },
    { label: 'Play next', testId: 'play-next', onClick: () => void tracksOf(p).then((l) => player.playNext(l)) },
    { label: 'Add to playlist', testId: 'add-to-playlist', submenu: playlistItems },
  ];
  if (own) {
    items.push({ label: 'Move to folder', testId: 'move-to-folder', submenu: await moveToFolderItems(p) }, sfl);
    items.push({ label: 'Edit playlist', testId: 'playlist-edit', onClick: () => editPlaylist(p) });
    items.push({
      label: p.isPublic ? 'Make private' : 'Make public',
      testId: 'toggle-playlist-public',
      onClick: async () => {
        try {
          await playlistMeta.setPublic(p.uuid, !p.isPublic);
          invalidate(`playlist:${p.uuid}`);
          invalidate('sidebar:');
          opts.onChanged?.();
          toast(p.isPublic ? 'Playlist is now private' : 'Playlist is now public');
        } catch {
          toast("Couldn't change the playlist's visibility");
        }
      },
    });
    items.push({ label: 'Delete playlist', testId: 'delete-playlist', onClick: () => (opts.onDelete ? opts.onDelete() : void deletePlaylist(p)) });
  } else {
    if (fav) items.push({ label: 'Move to folder', testId: 'move-to-folder', submenu: await moveToFolderItems(p) });
    items.push({ label: fav ? 'Unfollow' : 'Follow', testId: 'toggle-follow', onClick: () => void toggleFavorite(p) }, sfl);
  }
  items.push(shareItem('playlist', p.uuid));
  openMenu(at, items);
}

/** Confirm + delete an own playlist; resolves true when deleted. */
export async function deletePlaylist(p: Playlist): Promise<boolean> {
  if (!(await confirmDialog('Delete playlist', `Are you sure you want to delete “${p.title}”?`, 'Delete', true))) return false;
  try {
    await playlistEdit.remove(p.uuid);
    invalidate('sidebar:');
    invalidate('collection:');
    toast(`Deleted ${p.title}`);
    return true;
  } catch {
    toast("Couldn't delete the playlist");
    return false;
  }
}

async function moveToFolderItems(p: Playlist): Promise<MenuItem[]> {
  const root: MediaItem[] = await fetchQuery('detail:folders', () => user.folder('root', 'DATE', 'DESC')).catch(() => []);
  const folders = root.filter((x: MediaItem): x is Folder => x.kind === 'folder');
  const move = async (folderId: string, name: string) => {
    try {
      await playlistMeta.moveToFolder(p.uuid, folderId);
      invalidate('sidebar:');
      invalidate('folder:');
      invalidate('detail:folders');
      toast(`Moved to ${name}`);
    } catch {
      toast("Couldn't move the playlist");
    }
  };
  return [
    {
      label: 'Create folder',
      leading: <PlusCircle />,
      tall: true,
      testId: 'create-new-folder',
      onClick: async () => {
        const name = await promptText('Create folder', 'Folder name');
        if (!name) return;
        const r = await playlistEdit.createFolder(name);
        const id = r?.data?.id ?? r?.id;
        invalidate('sidebar:');
        if (id) await move(id, name);
      },
    },
    { label: 'Playlists', testId: 'move-to-my-playlists', onClick: () => void move('root', 'Playlists') },
    ...(folders.length ? [{ section: 'Recent' } as MenuItem] : []),
    ...folders.slice(0, 5).map((f, i) => ({ label: f.name, testId: `sub-menu-item-recent-folder-${i}`, onClick: () => void move(f.id, f.name) })),
  ];
}

// ── mix / artist ─────────────────────────────────────────────────────────────

export async function mixMenu(at: At, m: Mix) {
  const fav = isFav('mix', m.id);
  const playlistItems = await addToPlaylistItems(() => trackIdsOf(m));
  openMenu(at, [
    { label: 'Play next', testId: 'play-next', onClick: () => void tracksOf(m).then((l) => player.playNext(l)) },
    { label: 'Add to playlist', testId: 'add-to-playlist', submenu: playlistItems },
    { label: fav ? 'Remove from My Collection' : 'Add to My Collection', testId: 'add-to-remove-from-collection', onClick: () => void toggleFavorite(m) },
    shareItem('mix', m.id),
  ]);
}

async function artistRadio(a: Artist) {
  if (a.mixId) return navigate(`/mix/${a.mixId}`);
  const r = await artistsApi.radio(a.id);
  if (!r.items.length) return toast('No radio available for this artist');
  player.playList(r.items, 0, { type: 'radio', id: `artist-${a.id}`, title: `${a.name} radio`, path: `/artist/${a.id}` });
}

export async function artistMenu(at: At, a: Artist) {
  const fav = isFav('artist', a.id);
  const sfl = await saveForLaterItem('artists', a.id);
  openMenu(at, [
    { header: { image: artistUrl(a.picture, 80), round: true, title: a.name, imageTestId: 'context-menu-artist-image' } },
    { label: 'Bio', testId: 'artist-info', onClick: () => openArtistBio({ id: a.id, name: a.name, picture: a.picture }) },
    { label: 'Go to artist radio', testId: 'artist-radio', onClick: () => void artistRadio(a) },
    { label: 'Block', testId: 'block-artist', onClick: () => void blockArtist(a.id, a.name) },
    { label: 'Credits', testId: 'artist-credits', onClick: () => navigate(`/credits/${a.id}`) },
    { label: fav ? 'Unfollow' : 'Follow', testId: 'toggle-follow', onClick: () => void toggleFavorite(a) },
    sfl,
    { label: 'Share', testId: 'share', submenu: shareItems('artist', a.id).filter((x) => x.testId !== 'share-embed') },
  ]);
}

// ── folder ───────────────────────────────────────────────────────────────────

/** TIDAL's folder menu shows a small teal tile (its folder glyph is padded away to nothing) */
const FolderTile = () => <span style={{ display: 'block', flex: 'none', width: 20, height: 20, borderRadius: 8, background: 'rgb(36, 66, 64)' }} />;

const folderRefresh = (id: string) => {
  invalidate('sidebar:');
  invalidate(`folder:${id}`);
  invalidate('detail:folders');
  invalidate('collection:');
};

/** Folder rows/cards: Rename, Delete, Create playlist. */
export function folderMenu(at: At, f: Folder) {
  const n = f.numberOfItems;
  openMenu(at, [
    { header: { glyph: <FolderTile />, title: f.name, subtitle: `${n} playlist${n === 1 ? '' : 's'}` } },
    {
      label: 'Rename folder',
      testId: 'rename-folder',
      onClick: async () => {
        const next = await promptText('Rename folder', 'Folder name', f.name);
        if (!next || next === f.name) return;
        try {
          await folders.rename(f.id, next);
          folderRefresh(f.id);
        } catch {
          toast("Couldn't rename the folder");
        }
      },
    },
    {
      label: 'Delete folder',
      testId: 'delete-folder',
      onClick: async () => {
        if (!(await confirmDialog('Delete folder', `Are you sure you want to delete “${f.name}”? Playlists in it will be deleted too.`, 'Delete', true))) return;
        try {
          await playlistEdit.removeFolder(f.id);
          folderRefresh(f.id);
          if (location.pathname === `/folder/${f.id}`) navigate('/my-collection/playlists');
        } catch {
          toast("Couldn't delete the folder");
        }
      },
    },
    {
      label: 'Create playlist',
      testId: 'create-playlist',
      onClick: async () => {
        const title = await promptText('Create playlist', 'Playlist title');
        if (!title) return;
        try {
          const r = await playlistEdit.create(title, '', f.id);
          folderRefresh(f.id);
          const uuid = r?.data?.uuid ?? r?.uuid;
          if (uuid) navigate(`/playlist/${uuid}`);
        } catch {
          toast("Couldn't create the playlist");
        }
      },
    },
  ]);
}

/** Mix artwork for menu headers (used by pages that open mix menus with a header). */
export const mixMenuImage = (m: Mix) => mixImageUrl(m, 80);
