// The artist card that floats above the player's track info in Now Playing's artwork view, for the artist whose name
// was clicked (hidden until then). The biography is fetched at runtime and only rendered (never stored).
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { artistUrl } from '@/api/images';
import type { Track } from '@/api/models';
import { artists } from '@/api/tidal';
import { showDialog } from '@/components/Dialog';
import { useQuery } from '@/lib/query';
import { toggleFavorite, useIsFavorite } from '@/state/favorites';
import { toast, useUi } from '@/state/ui';
import { bioParagraphs } from './bio';
import s from './ArtistInfoCard.module.css';

export function ArtistInfoCard({ track }: { track: Track }) {
  const picked = useUi((st) => (st.nowPlayingOpen && st.nowPlayingTab === 'playing' ? st.artistCardId : null));
  const shown = picked !== null ? track.artists.find((a) => a.id === picked) : undefined;
  const open = !!shown;
  // the last shown artist stays while the card fades out; the main artist is kept ready so the usual click opens instantly
  const last = useRef<number | undefined>(undefined);
  if (shown) last.current = shown.id;
  const ref = shown ?? track.artists.find((a) => a.id === last.current) ?? track.artists.find((a) => a.main) ?? track.artists[0];
  const id = ref?.id;
  const { data: artist } = useQuery(id ? `np:artist:${id}` : null, () => artists.get(id!));
  const { data: bio } = useQuery(id ? `np:artist-bio:${id}` : null, () => artists.bio(id!));
  const following = useIsFavorite(artist);

  // the next track doesn't have that artist: hidden for good (not back when a later one has)
  useEffect(() => {
    if (picked !== null && !shown) useUi.setState({ artistCardId: null });
  }, [picked, shown]);
  // a click anywhere else closes it (the names toggle it themselves; dialogs and menus it opens keep it)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element).closest?.('[data-test="artist-info-card"], [data-artist-card], [role="dialog"], [role="menu"]')) return;
      useUi.setState({ artistCardId: null });
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open]);

  if (!ref) return null;
  const paragraphs = bioParagraphs(bio?.text || bio?.summary || '');
  const picture = artist?.picture ?? ref.picture;
  const name = artist?.name ?? ref.name;
  // the artist page, with Now Playing closed (it would open behind the view)
  const page = { to: `/artist/${ref.id}`, tabIndex: open ? 0 : -1, onClick: () => useUi.setState({ nowPlayingOpen: false }) };

  return (
    <div className={`${s.card} ${open ? s.open : ''}`} data-test="artist-info-card" aria-hidden={!open}>
      <Link {...page} className={s.media} aria-label={name}>
        {picture ? (
          <img className={s.image} data-test="artist-info-artwork" src={artistUrl(picture, 320)} alt="" draggable={false} />
        ) : (
          <div className={s.image} data-test="artist-info-artwork" />
        )}
      </Link>
      <div className={s.content}>
        <Link {...page} className={s.name} data-test="artist-info-name">
          {name}
        </Link>
        {paragraphs.length > 0 && (
          <div className={s.bio}>
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
        <div className={s.actions}>
          <button
            type="button"
            className={`${s.btn} ${s.primary}`}
            data-test="artist-info-follow"
            tabIndex={open ? 0 : -1}
            disabled={!artist}
            onClick={() =>
              artist &&
              void toggleFavorite(artist)
                .then((now) => toast(now ? `Following ${artist.name}` : `Unfollowed ${artist.name}`))
                .catch(() => toast('Could not update follow'))
            }
          >
            <span>{following ? 'Following' : 'Follow'}</span>
          </button>
          {paragraphs.length > 0 && (
            <button
              type="button"
              className={`${s.btn} ${s.ghost}`}
              data-test="artist-info-read-more"
              tabIndex={open ? 0 : -1}
              onClick={() =>
                void showDialog(
                  name,
                  <div className={s.dialogBio}>
                    {paragraphs.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>,
                )
              }
            >
              <span>Read more</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
