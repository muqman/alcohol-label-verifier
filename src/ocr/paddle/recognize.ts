// Text-line recognition with the PaddleOCR (SVTR/CTC) recognition model.
import type * as ortTypes from 'onnxruntime-web';
import type { RgbaImage } from '../types';
import { dist, type Quad } from './geometry';

type Ort = typeof ortTypes;

const REC_H = 48;
const MAX_RATIO = 80; // cap on width/height of a single text line crop
const MAX_BATCH = 8;

export interface RecResult {
  text: string;
  /** Mean probability of the emitted characters (0..1). */
  conf: number;
  /** Per character: probability and centre position along the line (0..1). */
  chars: { p: number; pos: number }[];
}

interface Crop {
  data: Float32Array; // 3 x REC_H x width, BGR, normalised to [-1, 1]
  width: number;
}

function sample(img: RgbaImage, x: number, y: number, out: number[]) {
  const W = img.width, H = img.height, d = img.data;
  x = Math.min(W - 1, Math.max(0, x));
  y = Math.min(H - 1, Math.max(0, y));
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1);
  const wx = x - x0, wy = y - y0;
  const i00 = (y0 * W + x0) * 4, i01 = (y0 * W + x1) * 4, i10 = (y1 * W + x0) * 4, i11 = (y1 * W + x1) * 4;
  for (let c = 0; c < 3; c++) {
    const top = d[i00 + c] + (d[i01 + c] - d[i00 + c]) * wx;
    const bot = d[i10 + c] + (d[i11 + c] - d[i10 + c]) * wx;
    out[c] += top + (bot - top) * wy;
  }
}

/** Sample a (possibly rotated) text-line quad into a REC_H-high network input. */
export function cropLine(img: RgbaImage, quad: Quad): Crop {
  const [tl, tr, , bl] = quad;
  const cropW = Math.max(dist(quad[0], quad[1]), dist(quad[3], quad[2]), 1);
  const cropH = Math.max(dist(quad[0], quad[3]), dist(quad[1], quad[2]), 1);
  const width = Math.max(8, Math.min(REC_H * MAX_RATIO, Math.ceil((REC_H * cropW) / cropH)));
  const ux = (tr.x - tl.x) / width, uy = (tr.y - tl.y) / width;
  const vx = (bl.x - tl.x) / REC_H, vy = (bl.y - tl.y) / REC_H;
  // Supersample when shrinking so thin strokes are not lost.
  const ss = Math.min(4, Math.max(1, Math.ceil(Math.max(Math.hypot(ux, uy), Math.hypot(vx, vy)))));
  const plane = REC_H * width;
  const data = new Float32Array(3 * plane);
  const acc = [0, 0, 0];
  for (let v = 0; v < REC_H; v++) {
    for (let u = 0; u < width; u++) {
      acc[0] = acc[1] = acc[2] = 0;
      for (let sy = 0; sy < ss; sy++) {
        const fv = v + (sy + 0.5) / ss;
        for (let sx = 0; sx < ss; sx++) {
          const fu = u + (sx + 0.5) / ss;
          sample(img, tl.x + fu * ux + fv * vx - 0.5, tl.y + fu * uy + fv * vy - 0.5, acc);
        }
      }
      const k = ss * ss;
      const i = v * width + u;
      data[i] = acc[2] / k / 127.5 - 1; // B
      data[plane + i] = acc[1] / k / 127.5 - 1; // G
      data[2 * plane + i] = acc[0] / k / 127.5 - 1; // R
    }
  }
  return { data, width };
}

/** Parse the dictionary file shipped with the model (one symbol per line). */
export function parseDictionary(text: string): string[] {
  const lines = text.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  // CTC class 0 is "blank"; PaddleOCR appends a space class at the end.
  return ['', ...lines.map((l) => l.replace(/\r$/, '')), ' '];
}

function ctcDecode(probs: Float32Array, offset: number, T: number, C: number, validT: number, dict: string[]): RecResult {
  let prev = -1;
  let text = '';
  const chars: RecResult['chars'] = [];
  for (let t = 0; t < T; t++) {
    let best = 0, bestP = -1;
    const base = offset + t * C;
    for (let c = 0; c < C; c++) {
      const p = probs[base + c];
      if (p > bestP) { bestP = p; best = c; }
    }
    if (best !== 0 && best !== prev && t < validT) {
      text += dict[best] ?? '';
      chars.push({ p: bestP, pos: (t + 0.5) / validT });
    }
    prev = best;
  }
  // Trim leading/trailing spaces but keep char alignment in sync.
  while (text.startsWith(' ')) { text = text.slice(1); chars.shift(); }
  while (text.endsWith(' ')) { text = text.slice(0, -1); chars.pop(); }
  const conf = chars.length ? chars.reduce((s, c) => s + c.p, 0) / chars.length : 0;
  return { text, conf, chars };
}

/** Recognise many line quads, batching lines of similar width together. */
export async function recognizeLines(
  ort: Ort,
  session: ortTypes.InferenceSession,
  img: RgbaImage,
  quads: Quad[],
  dict: string[],
): Promise<RecResult[]> {
  const crops = quads.map((q) => cropLine(img, q));
  const order = crops.map((_, i) => i).sort((a, b) => crops[a].width - crops[b].width);
  const results: RecResult[] = new Array(crops.length);

  for (let start = 0; start < order.length; start += MAX_BATCH) {
    const idx = order.slice(start, start + MAX_BATCH);
    const W = Math.max(...idx.map((i) => crops[i].width));
    const plane = REC_H * W;
    const batch = new Float32Array(idx.length * 3 * plane); // zero padding == mid grey
    idx.forEach((ci, b) => {
      const { data, width } = crops[ci];
      for (let c = 0; c < 3; c++) {
        for (let y = 0; y < REC_H; y++) {
          const src = c * REC_H * width + y * width;
          batch.set(data.subarray(src, src + width), b * 3 * plane + c * plane + y * W);
        }
      }
    });
    const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', batch, [idx.length, 3, REC_H, W]) });
    const t = out[session.outputNames[0]];
    const [, T, C] = t.dims as number[];
    const probs = t.data as Float32Array;
    idx.forEach((ci, b) => {
      const validT = Math.max(1, Math.min(T, Math.ceil((T * crops[ci].width) / W)));
      results[ci] = ctcDecode(probs, b * T * C, T, C, validT, dict);
    });
  }
  return results;
}
