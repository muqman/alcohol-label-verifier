// Geometry helpers for turning detected text regions into rotated rectangles.

export interface Pt {
  x: number;
  y: number;
}

/** A rotated rectangle given by its 4 corners in reading order: tl, tr, br, bl. */
export type Quad = [Pt, Pt, Pt, Pt];

const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Andrew's monotone chain. Returns hull in counter-clockwise order. */
export function convexHull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length <= 2) return pts;
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

export interface RotatedRect {
  cx: number;
  cy: number;
  /** Extent along unit vector (ux, uy). */
  w: number;
  /** Extent along the perpendicular (-uy, ux). */
  h: number;
  ux: number;
  uy: number;
}

/** Minimum-area enclosing rectangle via rotating calipers over hull edges. */
export function minAreaRect(hull: Pt[]): RotatedRect {
  if (hull.length === 0) return { cx: 0, cy: 0, w: 0, h: 0, ux: 1, uy: 0 };
  if (hull.length === 1) return { cx: hull[0].x, cy: hull[0].y, w: 0, h: 0, ux: 1, uy: 0 };
  let best: RotatedRect | null = null;
  let bestArea = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-9) continue;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const p of hull) {
      const u = p.x * ux + p.y * uy;
      const v = -p.x * uy + p.y * ux;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const area = (maxU - minU) * (maxV - minV);
    if (area < bestArea) {
      bestArea = area;
      const cu = (minU + maxU) / 2;
      const cv = (minV + maxV) / 2;
      best = { cx: cu * ux - cv * uy, cy: cu * uy + cv * ux, w: maxU - minU, h: maxV - minV, ux, uy };
    }
  }
  return best ?? { cx: hull[0].x, cy: hull[0].y, w: 0, h: 0, ux: 1, uy: 0 };
}

/**
 * Normalise a rotated rect so that `w` runs along the more horizontal
 * direction (reading direction for upright text) with ux >= 0, then return its
 * corners ordered tl, tr, br, bl.
 */
export function rectToQuad(r: RotatedRect): Quad {
  let { w, h, ux, uy } = r;
  // Make u the more horizontal axis.
  if (Math.abs(uy) > Math.abs(ux)) {
    [w, h] = [h, w];
    [ux, uy] = [uy, -ux];
  }
  if (ux < 0) {
    ux = -ux;
    uy = -uy;
  }
  const vx = -uy, vy = ux; // perpendicular pointing "down" in image coordinates
  const hw = w / 2, hh = h / 2;
  const c = { x: r.cx, y: r.cy };
  return [
    { x: c.x - ux * hw - vx * hh, y: c.y - uy * hw - vy * hh },
    { x: c.x + ux * hw - vx * hh, y: c.y + uy * hw - vy * hh },
    { x: c.x + ux * hw + vx * hh, y: c.y + uy * hw + vy * hh },
    { x: c.x - ux * hw + vx * hh, y: c.y - uy * hw + vy * hh },
  ];
}

export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export function quadBounds(q: Quad) {
  const xs = q.map((p) => p.x);
  const ys = q.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
