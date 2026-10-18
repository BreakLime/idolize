// The show's colours from the album cover: its three strongest hues as neon light, and a deep tone for the dark parts.

export type Rgb = [number, number, number];

/** Neutral light for black-and-white covers. */
const NEUTRAL: Rgb[] = [
  [0.75, 0.85, 1],
  [1, 1, 1],
  [0.55, 0.7, 1],
  [0.04, 0.05, 0.08],
];

function hsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

/** Light of a hue: full brightness, strong saturation. */
function neon([r, g, b]: Rgb): Rgb {
  const max = Math.max(r, g, b, 1e-3);
  const [, s] = hsv(r, g, b);
  const grey = (r + g + b) / 3 / max;
  const boost = Math.max(1, 0.85 / Math.max(s, 0.2));
  return [r, g, b].map((c) => Math.min(1, Math.max(0, grey + (c / max - grey) * boost))) as Rgb;
}

/** Four colours from an image that allows reading its pixels: three lights, then the deep tone. */
export function palette(img: CanvasImageSource): Rgb[] {
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, size, size);
  const px = g.getImageData(0, 0, size, size).data;
  // hue buckets weighted by how colourful and bright each pixel is
  const buckets = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  let dark: Rgb = [0, 0, 0];
  let darkW = 0;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i] / 255;
    const gg = px[i + 1] / 255;
    const b = px[i + 2] / 255;
    const [h, s, v] = hsv(r, gg, b);
    const w = s * s * v;
    const k = buckets[Math.floor(h / 30) % 12];
    k.w += w;
    k.r += r * w;
    k.g += gg * w;
    k.b += b * w;
    if (v < 0.35) {
      dark = [dark[0] + r, dark[1] + gg, dark[2] + b];
      darkW++;
    }
  }
  const strong = buckets.filter((k) => k.w > 0).sort((a, b) => b.w - a.w);
  const total = strong.reduce((s, k) => s + k.w, 0);
  if (!strong.length || total < size * size * 0.02) return NEUTRAL;
  const lights = strong.slice(0, 3).map((k) => neon([k.r / k.w, k.g / k.w, k.b / k.w]));
  while (lights.length < 3) lights.push(lights[lights.length - 1].map((c, i) => Math.min(1, c * 0.8 + (i === 2 ? 0.3 : 0))) as Rgb);
  const deep: Rgb = darkW ? (dark.map((c) => (c / darkW) * 0.8 + 0.01) as Rgb) : [0.03, 0.03, 0.05];
  return [...lights, deep];
}

export const css = ([r, g, b]: Rgb, a = 1) => `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;

/** How much of a cover is white or light (0..1): the share of its pixels (RGBA bytes) whose darkest channel is over
 * 0.6. From DARKEN_SHARE on, the stage's pulse darkens the cover's light parts instead of brightening its colours. */
export function whiteShare(px: ArrayLike<number>): number {
  let white = 0;
  let all = 0;
  for (let i = 0; i + 3 < px.length; i += 4) {
    all++;
    if (Math.min(px[i], px[i + 1], px[i + 2]) > 153) white++;
  }
  return all ? white / all : 0;
}
export const DARKEN_SHARE = 0.4;
