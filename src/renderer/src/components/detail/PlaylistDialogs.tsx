// "Edit playlist" form and the "Show all playlists" picker (TIDAL opens both as modals).
import { useState } from 'react';
import { squareUrl, wideUrl } from '@/api/images';
import type { Playlist } from '@/api/models';
import { invalidate } from '@/lib/query';
import { toast } from '@/state/ui';
import { Artwork } from '../Artwork';
import { playlistMeta } from './detailApi';
import { openModal } from './Modal';
import s from './PlaylistDialogs.module.css';

function EditForm({ p, close }: { p: Playlist; close: () => void }) {
  const [title, setTitle] = useState(p.title);
  const [description, setDescription] = useState(p.description ?? '');
  const [isPublic, setPublic] = useState(!!p.isPublic);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      if (title.trim() !== p.title || description !== (p.description ?? '')) await playlistMeta.update(p.uuid, title.trim(), description);
      if (isPublic !== !!p.isPublic) await playlistMeta.setPublic(p.uuid, isPublic);
      invalidate(`playlist:${p.uuid}`);
      invalidate('sidebar:');
      invalidate('collection:');
      close();
    } catch (e) {
      toast(`Couldn't save the playlist (${(e as Error).message.slice(0, 60)})`);
      setBusy(false);
    }
  };
  return (
    <form
      className={s.form}
      data-test="playlist-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className={s.top}>
        <div className={s.imageCol}>
          <Artwork src={squareUrl(p.squareImage, 150) ?? wideUrl(p.image, 150)} size={150} radius={2} fallbackIcon="playlist" />
        </div>
        <div className={s.fields}>
          <label className={s.titleBox}>
            <span className={s.titleLabel} data-test="input-name">
              Title
            </span>
            <input className={s.titleInput} data-test="playlist-name-input" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </label>
          <div className={s.descWrap}>
            <textarea
              className={s.desc}
              data-test="playlist-description"
              placeholder="Write a description"
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <span className={s.counter}>{description.length}/500 characters</span>
          </div>
        </div>
      </div>
      <div className={s.publicBox}>
        <div>
          <span className={s.publicTitle}>Make it public</span>
          <span className={s.publicSub}>Your playlist will be visible on your Profile and accessible by anyone.</span>
        </div>
        <label className={`${s.switch} ${isPublic ? s.switchOn : ''}`}>
          <input type="checkbox" data-test="playlist-visibility-switch" checked={isPublic} onChange={(e) => setPublic(e.target.checked)} />
        </label>
      </div>
      <menu className={s.actions}>
        <button type="submit" className={s.save} data-test="save-playlist-btn" disabled={busy || !title.trim()}>
          <span>Save</span>
        </button>
      </menu>
    </form>
  );
}

export function editPlaylist(p: Playlist) {
  openModal('Edit playlist', (close) => <EditForm p={p} close={close} />);
}

/** "Show all playlists": pick one of the user's playlists. */
export function pickPlaylist(playlists: Playlist[], onPick: (p: Playlist) => void, title = 'Add to playlist') {
  openModal(title, (close) => (
    <ul className={s.pickList} data-test="playlist-picker">
      {playlists.length === 0 && <li className={s.empty}>You have no playlists yet.</li>}
      {playlists.map((p) => (
        <li key={p.uuid}>
          <button
            type="button"
            className={s.pickItem}
            onClick={() => {
              close();
              onPick(p);
            }}
          >
            <Artwork src={squareUrl(p.squareImage, 40) ?? wideUrl(p.image, 40)} size={40} radius={2} fallbackIcon="playlist" />
            <span className={s.pickText}>
              <span className="ellipsis">{p.title}</span>
              <span className={`${s.pickSub} ellipsis`}>{p.numberOfTracks + p.numberOfVideos} items</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  ));
}
