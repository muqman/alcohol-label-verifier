// Text detection with the PaddleOCR DB (Differentiable Binarization) model.
// The model outputs a per-pixel "is text" probability map; we threshold it,
// label connected regions and fit a rotated rectangle around each.
import type * as ortTypes from 'onnxruntime-web';
import { resize } from '../image';
import type { RgbaImage } from '../types';
import { convexHull, minAreaRect, rectToQuad, type Pt, type Quad } from './geometry';

export interface DetOptions {
  /** Longest side fed to the network (larger = finds smaller text, slower). */
  maxSide: number;
  /** Images whose shorter side is below this are enlarged first. */
  minSide: number;
  /** Probability above which a pixel counts as text. */
  thresh: number;
  /** Minimum mean probability of a region to keep it. */
  boxThresh: number;
  /** How far to grow the tight region box (DB "unclip" ratio). */
  unclipRatio: number;
}

export const DEFAULT_DET: DetOptions = {
  maxSide: 1280,
  minSide: 736,
  thresh: 0.3,
  boxThresh: 0.6,
  unclipRatio: 1.6,
};

export interface DetectedBox {
  /** Corners (tl, tr, br, bl) in the coordinates of the input image. */
  quad: Quad;
  score: number;
}

type Ort = typeof ortTypes;

export async function detectText(
  ort: Ort,
  session: ortTypes.InferenceSession,
  img: RgbaImage,
  opt: DetOptions = DEFAULT_DET,
): Promise<DetectedBox[]> {
  // 1. Scale so the short side is at least minSide and the long side at most maxSide.
  let scale = 1;
  const short = Math.min(img.width, img.height);
  const long = Math.max(img.width, img.height);
  if (short < opt.minSide) scale = opt.minSide / short;
  if (long * scale > opt.maxSide) scale = opt.maxSide / long;
  const w = Math.max(32, Math.round((img.width * scale) / 32) * 32);
  const h = Math.max(32, Math.round((img.height * scale) / 32) * 32);
  const small = resize(img, w, h);

  // 2. HWC RGBA -> CHW BGR float, normalised to [-1, 1].
  const plane = w * h;
  const input = new Float32Array(3 * plane);
  const d = small.data;
  for (let i = 0, j = 0; i < plane; i++, j += 4) {
    input[i] = d[j + 2] / 127.5 - 1; // B
    input[plane + i] = d[j + 1] / 127.5 - 1; // G
    input[2 * plane + i] = d[j] / 127.5 - 1; // R
  }
  const feeds = { [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, h, w]) };
  const out = await session.run(feeds);
  const prob = out[session.outputNames[0]].data as Float32Array;

  // 3. Post-process at network resolution, then map back.
  const boxes = boxesFromProbMap(prob, w, h, opt);
  const fx = img.width / w;
  const fy = img.height / h;
  return boxes.map((b) => ({
    score: b.score,
    quad: b.quad.map((p) => ({ x: p.x * fx, y: p.y * fy })) as Quad,
  }));
}

/** Connected components on the thresholded map -> rotated boxes. */
export function boxesFromProbMap(prob: Float32Array, w: number, h: number, opt: DetOptions): DetectedBox[] {
  const n = w * h;
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = prob[i] > opt.thresh ? 1 : 0;

  const visited = new Uint8Array(n);
  const stack = new Int32Array(n);
  // Per-row min/max x of the current component (-1 = row not touched).
  const rowMin = new Int32Array(h).fill(-1);
  const rowMax = new Int32Array(h).fill(-1);
  const rows: number[] = [];
  const results: DetectedBox[] = [];

  for (let start = 0; start < n; start++) {
    if (!mask[start] || visited[start]) continue;
    // Flood fill (8-connected), tracking per-row extremes for the hull.
    let sp = 0;
    stack[sp++] = start;
    visited[start] = 1;
    let count = 0;
    let probSum = 0;
    rows.length = 0;
    while (sp > 0) {
      const p = stack[--sp];
      const py = (p / w) | 0;
      const px = p - py * w;
      count++;
      probSum += prob[p];
      if (rowMin[py] < 0) {
        rows.push(py);
        rowMin[py] = px;
        rowMax[py] = px;
      } else {
        if (px < rowMin[py]) rowMin[py] = px;
        if (px > rowMax[py]) rowMax[py] = px;
      }
      for (let dy = -1; dy <= 1; dy++) {
        const ny = py + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx;
          if (nx < 0 || nx >= w) continue;
          const q = ny * w + nx;
          if (mask[q] && !visited[q]) {
            visited[q] = 1;
            stack[sp++] = q;
          }
        }
      }
    }

    const pts: Pt[] = [];
    for (const y of rows) {
      const x0 = rowMin[y];
      const x1 = rowMax[y];
      // Pixel corners so a 1-pixel-high row still has area.
      pts.push({ x: x0, y }, { x: x0, y: y + 1 }, { x: x1 + 1, y }, { x: x1 + 1, y: y + 1 });
      rowMin[y] = -1;
      rowMax[y] = -1;
    }
    if (count < 6) continue;
    const score = probSum / count;
    if (score < opt.boxThresh) continue;

    const rect = minAreaRect(convexHull(pts));
    if (Math.min(rect.w, rect.h) < 3) continue;
    // DB "unclip": grow by area * ratio / perimeter on every side.
    const grow = (rect.w * rect.h * opt.unclipRatio) / (2 * (rect.w + rect.h));
    const grown = { ...rect, w: rect.w + 2 * grow, h: rect.h + 2 * grow };
    if (Math.min(grown.w, grown.h) < 5) continue;
    results.push({ quad: rectToQuad(grown), score });
  }
  return results;
}
