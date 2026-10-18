// Runtime data for the Now Playing panels (credits, radio/mixes, lyrics). Nothing here is persisted.
import { toMix, type Mix, type Track } from '@/api/models';
import { api, page, tracks } from '@/api/tidal';

export interface CreditGroup {
  type: string;
  contributors: { name: string; id?: number }[];
}

/** Track credits plus TIDAL's trailing "Released" / "Label" rows. */
export async function creditsFor(t: Track): Promise<CreditGroup[]> {
  const raw = await tracks.credits(t.id).catch(() => []);
  const groups: CreditGroup[] = (Array.isArray(raw) ? raw : [])
    .filter((g) => g?.type && g.contributors?.length)
    .map((g) => ({ type: g.type, contributors: g.contributors.map((c) => ({ name: c.name, id: c.id || undefined })) }));
  const year = t.album.releaseDate?.slice(0, 4);
  if (year) groups.push({ type: 'Released', contributors: [{ name: year }] });
  if (t.copyright) groups.push({ type: 'Label', contributors: [{ name: t.copyright }] });
  return groups;
}

async function mixMeta(id: string): Promise<Mix | null> {
  const p = await page('mix', { mixId: id }).catch(() => null);
  const header = p?.modules.find((m) => m.type === 'MIX_HEADER');
  return header?.raw?.mix ? toMix(header.raw.mix) : null;
}

export interface RadioCard {
  mix: Mix;
  title: string;
  subtitle: string;
}

/** "Mixes & Radio": an artist radio per main artist, then the track radio. */
export async function radiosFor(t: Track): Promise<RadioCard[]> {
  const mains = t.artists.filter((a) => a.main);
  const artistsForRadio = (mains.length ? mains : t.artists).slice(0, 2);
  const jobs: Promise<RadioCard | null>[] = artistsForRadio.map(async (a) => {
    const r = await api<{ id?: string }>('v1', `artists/${a.id}/mix`).catch(() => null);
    const mix = r?.id ? await mixMeta(r.id) : null;
    return mix ? { mix, title: a.name, subtitle: 'Artist radio' } : null;
  });
  if (t.mixId) {
    jobs.push(mixMeta(t.mixId).then((mix) => (mix ? { mix, title: t.title, subtitle: 'Track radio' } : null)));
  }
  return (await Promise.all(jobs)).filter((x): x is RadioCard => !!x);
}

export async function suggestedFor(t: Track): Promise<Track[]> {
  const r = await tracks.radio(t.id).catch(() => null);
  return (r?.items ?? []).filter((x) => x.id !== t.id).slice(0, 20);
}
