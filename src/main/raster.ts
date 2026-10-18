// Tiny anti-aliased rasterizer (4×4 supersampling) for app/tray/thumbar icons — avoids image dependencies.
// Shapes are given in a 24-unit design grid and scaled to the target size.

export type Pt = [number, number];
export type Shape = { kind: 'poly'; pts: Pt[] } | { kind: 'circle'; c: Pt; r: number } | { kind: 'rrect'; x: number; y: number; w: number; h: number; r: number };

const SS = 4;

function inside(shape: Shape, x: number, y: number): boolean {
  switch (shape.kind) {
    case 'circle':
      return (x - shape.c[0]) ** 2 + (y - shape.c[1]) ** 2 <= shape.r ** 2;
    case 'rrect': {
      const { x: rx, y: ry, w, h, r } = shape;
      if (x < rx || y < ry || x > rx + w || y > ry + h) return false;
      const cx = Math.min(Math.max(x, rx + r), rx + w - r);
      const cy = Math.min(Math.max(y, ry + r), ry + h - r);
      return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
    }
    case 'poly': {
      let inPoly = false;
      const p = shape.pts;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const [xi, yi] = p[i];
        const [xj, yj] = p[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inPoly = !inPoly;
      }
      return inPoly;
    }
  }
}

/** Thick polyline as a polygon strip (round-ish joins are fine at icon sizes). */
export function strokePath(pts: Pt[], width: number): Shape[] {
  const out: Shape[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = (-(y2 - y1) / len) * (width / 2);
    const ny = ((x2 - x1) / len) * (width / 2);
    out.push({ kind: 'poly', pts: [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]] });
    out.push({ kind: 'circle', c: [x2, y2], r: width / 2 });
  }
  out.push({ kind: 'circle', c: pts[0], r: width / 2 });
  return out;
}

export function quad(a: Pt, c: Pt, b: Pt, steps = 12): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]]);
  }
  return pts;
}

/** Renders layers of shapes (24-grid) into an RGBA buffer of size×size. */
export function rasterize(size: number, layers: { shapes: Shape[]; color: [number, number, number, number] }[], format: 'rgba' | 'bgra' = 'rgba'): Buffer {
  const buf = Buffer.alloc(size * size * 4);
  const scale = 24 / size;
  for (let py = 0; py < size; py++)
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (const layer of layers) {
        let hits = 0;
        for (let sy = 0; sy < SS; sy++)
          for (let sx = 0; sx < SS; sx++) {
            const x = (px + (sx + 0.5) / SS) * scale;
            const y = (py + (sy + 0.5) / SS) * scale;
            if (layer.shapes.some((s) => inside(s, x, y))) hits++;
          }
        if (!hits) continue;
        const cov = (hits / (SS * SS)) * (layer.color[3] / 255);
        // "over" compositing
        r = layer.color[0] * cov + r * (1 - cov);
        g = layer.color[1] * cov + g * (1 - cov);
        b = layer.color[2] * cov + b * (1 - cov);
        a = cov + a * (1 - cov);
      }
      const i = (py * size + px) * 4;
      const [c0, c2] = format === 'rgba' ? [r, b] : [b, r];
      // premultiplied → straight alpha
      buf[i] = a ? Math.round(c0 / a) : 0;
      buf[i + 1] = a ? Math.round(g / a) : 0;
      buf[i + 2] = a ? Math.round(c2 / a) : 0;
      buf[i + 3] = Math.round(a * 255);
    }
  return buf;
}

const WHITE: [number, number, number, number] = [255, 255, 255, 255];

/** Idolize's mark (same geometry as IdolLogo in the renderer). */
export function logoShapes(): Shape[] {
  return [
    { kind: 'circle', c: [12, 4.5], r: 2.5 },
    { kind: 'poly', pts: [[8.5, 9.5], [15.5, 9.5], [15.5, 20.5], [8.5, 20.5]] },
    ...strokePath(quad([3, 14.5], [5.75, 12.1], [8.5, 14.5]), 1.8),
    ...strokePath(quad([15.5, 14.5], [18.25, 12.1], [21, 14.5]), 1.8),
  ];
}

export function appIcon(size: number, format: 'rgba' | 'bgra' = 'rgba'): Buffer {
  // logo inset on a black rounded square
  const inset = (s: Shape): Shape =>
    s.kind === 'circle'
      ? { kind: 'circle', c: [s.c[0] * 0.66 + 4.08, s.c[1] * 0.66 + 4.08], r: s.r * 0.66 }
      : s.kind === 'poly'
        ? { kind: 'poly', pts: s.pts.map(([x, y]) => [x * 0.66 + 4.08, y * 0.66 + 4.08] as Pt) }
        : s;
  return rasterize(
    size,
    [
      { shapes: [{ kind: 'rrect', x: 0.5, y: 0.5, w: 23, h: 23, r: 5.5 }], color: [0, 0, 0, 255] },
      { shapes: logoShapes().map(inset), color: WHITE },
    ],
    format,
  );
}

export type TransportGlyph = 'play' | 'pause' | 'previous' | 'next';

export function transportIcon(glyph: TransportGlyph, size: number, format: 'rgba' | 'bgra' = 'bgra'): Buffer {
  const shapes: Record<TransportGlyph, Shape[]> = {
    play: [{ kind: 'poly', pts: [[7, 4.5], [19.5, 12], [7, 19.5]] }],
    pause: [
      { kind: 'rrect', x: 6, y: 4.5, w: 4, h: 15, r: 1 },
      { kind: 'rrect', x: 14, y: 4.5, w: 4, h: 15, r: 1 },
    ],
    previous: [
      { kind: 'rrect', x: 5, y: 5, w: 2.4, h: 14, r: 1 },
      { kind: 'poly', pts: [[19, 5], [8.5, 12], [19, 19]] },
    ],
    next: [
      { kind: 'rrect', x: 16.6, y: 5, w: 2.4, h: 14, r: 1 },
      { kind: 'poly', pts: [[5, 5], [15.5, 12], [5, 19]] },
    ],
  };
  return rasterize(size, [{ shapes: shapes[glyph], color: WHITE }], format);
}
