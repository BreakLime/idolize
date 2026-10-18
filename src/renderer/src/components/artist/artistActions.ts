// Artist header actions shared by the hero, the compact bar and the "More" menu.
import type { Artist, Track } from '@/api/models';
import { artists } from '@/api/tidal';
import { openMenu, type MenuItem } from '@/components/Menu';
import { blockArtist, saveForLaterItem } from '@/components/menus';
import { navigate } from '@/lib/navigation';
import { toggleFavorite, useFavorites } from '@/state/favorites';
import { player } from '@/state/player';
import { toast } from '@/state/ui';
import type { ArtistHeaderInfo } from './artistApi';

type At = HTMLElement | { clientX: number; clientY: number };

export interface ArtistActionHandlers {
  id: string;
  info: ArtistHeaderInfo;
  artist: Artist;
  tracks: Track[];
  onReadMore: () => void;
}

const link = (id: string) => `https://tidal.com/artist/${id}`;

export async function playArtistRadio(id: string, name: string) {
  const r = await artists.radio(id);
  if (!r.items.length) return toast('No radio available for this artist');
  player.playList(r.items, 0, { type: 'radio', id: `artist-${id}`, title: `${name} radio`, path: `/artist/${id}` });
}

export function artistActions(p: ArtistActionHandlers) {
  const following = () => useFavorites.getState().ids.artist.has(String(p.id));
  const follow = async () => {
    const now = await toggleFavorite(p.artist);
    toast(now ? `Following ${p.info.name}` : `Unfollowed ${p.info.name}`);
  };
  const radio = () => (p.info.mixId ? navigate(`/mix/${p.info.mixId}`) : playArtistRadio(p.id, p.info.name));
  const copyLink = () => {
    void navigator.clipboard.writeText(link(p.id));
    toast('Link copied to clipboard');
  };
  const shareItems: MenuItem[] = [{ label: 'Copy link', testId: 'copy-share-link', onClick: copyLink }];
  /** TIDAL opens the header menus beside the button (right edge at its left side) */
  const beside = (at: At): At => {
    if (!(at instanceof HTMLElement)) return at;
    const r = at.getBoundingClientRect();
    return { clientX: r.left, clientY: r.top + 14 };
  };
  const report = (at: At) =>
    openMenu(beside(at), [{ label: 'Report an issue with this profile', testId: 'report-profile', onClick: () => window.open('https://support.tidal.com/hc/en-us/requests/new', '_blank') }], {
      align: 'end',
    });
  const more = async (at: At) => {
    const sfl = await saveForLaterItem('artists', p.id);
    const items: MenuItem[] = [];
    if (p.info.biography) items.push({ label: 'Bio', testId: 'artist-info', onClick: p.onReadMore });
    // TIDAL's order
    items.push(
      { label: 'Go to artist radio', testId: 'artist-radio', onClick: () => void radio() },
      { label: 'Block', testId: 'block-artist', onClick: () => void blockArtist(Number(p.id), p.info.name) },
      { label: 'Report', testId: 'report-artist', onClick: () => report(at) },
      { label: 'Credits', testId: 'artist-credits', onClick: () => navigate(`/credits/${p.id}`) },
      { label: following() ? 'Unfollow' : 'Follow', testId: 'add-to-remove-from-collection', onClick: () => void follow() },
      sfl,
      { label: 'Share', testId: 'share', submenu: shareItems },
    );
    openMenu(beside(at), items, { align: at instanceof HTMLElement ? 'end' : undefined, testId: 'context-menu' });
  };
  const share = (at: HTMLElement) => openMenu(beside(at), shareItems, { align: 'end' });
  return { follow, radio, share, report, more };
}
