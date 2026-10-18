// resources.tidal.com image URLs. Ids are uuids whose dashes become path separators.
import type { Mix } from './models';

const base = (id: string) => `https://resources.tidal.com/images/${id.replace(/-/g, '/')}`;

const pick = (sizes: number[], want: number) => sizes.find((s) => s >= want) ?? sizes[sizes.length - 1];

const COVER = [80, 160, 320, 640, 750, 1080, 1280];
const ARTIST = [160, 320, 480, 750];
const SQUARE = [160, 320, 480, 640, 750, 1080];
const WIDE: [number, number][] = [
  [160, 107],
  [480, 320],
  [750, 500],
  [1080, 720],
];
const VIDEO: [number, number][] = [
  [160, 90],
  [320, 180],
  [480, 270],
  [640, 360],
  [750, 422],
  [1280, 720],
];

/** `px` is the rendered CSS size; we pick a source ≥ px × devicePixelRatio. */
const dpr = () => (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);

export function coverUrl(id: string | null | undefined, px = 160): string | undefined {
  if (!id) return undefined;
  const s = pick(COVER, px * dpr());
  return `${base(id)}/${s}x${s}.jpg`;
}

export function artistUrl(id: string | null | undefined, px = 160): string | undefined {
  if (!id) return undefined;
  const s = pick(ARTIST, px * dpr());
  return `${base(id)}/${s}x${s}.jpg`;
}

export function squareUrl(id: string | null | undefined, px = 160): string | undefined {
  if (!id) return undefined;
  const s = pick(SQUARE, px * dpr());
  return `${base(id)}/${s}x${s}.jpg`;
}

export function wideUrl(id: string | null | undefined, px = 480): string | undefined {
  if (!id) return undefined;
  const want = px * dpr();
  const [w, h] = WIDE.find(([w]) => w >= want) ?? WIDE[WIDE.length - 1];
  return `${base(id)}/${w}x${h}.jpg`;
}

export function videoImageUrl(id: string | null | undefined, px = 320): string | undefined {
  if (!id) return undefined;
  const want = px * dpr();
  const [w, h] = VIDEO.find(([w]) => w >= want) ?? VIDEO[VIDEO.length - 1];
  return `${base(id)}/${w}x${h}.jpg`;
}

export function mixImageUrl(mix: Pick<Mix, 'images'>, px = 320): string | undefined {
  const order = px * dpr() > 600 ? ['LARGE', 'MEDIUM', 'SMALL'] : px * dpr() > 300 ? ['MEDIUM', 'LARGE', 'SMALL'] : ['SMALL', 'MEDIUM', 'LARGE'];
  for (const k of order) if (mix.images?.[k]?.url) return mix.images[k].url;
  return undefined;
}

/** Profile pictures (user ids) come from a different bucket. */
export const userPictureUrl = (url: string | null | undefined) => url ?? undefined;
