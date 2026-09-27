// PaddleOCR pipeline: detect text lines -> fix page orientation -> recognise
// lines -> group into blocks for reading order -> OcrPage.
import type * as ortTypes from 'onnxruntime-web';
import { rotate, unrotatePoint } from '../image';
import type { Box, OcrLine, OcrPage, OcrWord, RgbaImage } from '../types';
import { DEFAULT_DET, detectText, type DetectedBox, type DetOptions } from './detect';
import { dist, type Pt, type Quad } from './geometry';
import { recognizeLines, type RecResult } from './recognize';

type Ort = typeof ortTypes;

export interface PaddleModels {
  det: ortTypes.InferenceSession;
  rec: ortTypes.InferenceSession;
  dict: string[];
}

export interface PaddleOptions {
  det?: Partial<DetOptions>;
  /**
   * Words another engine (Tesseract) already read confidently. A detected line
   * made up entirely of such words reuses them instead of being recognised
   * again, which saves most of the recognition time on typical labels.
   */
  knownWords?: OcrWord[];
}

const KNOWN_MIN_CONF = 0.85;

/** Confident known words whose centre lies inside the quad, left to right. */
function reusableWords(quad: Quad, known: OcrWord[]): OcrWord[] | null {
  const xs = quad.map((p) => p.x), ys = quad.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const inside = known.filter((w) => {
    const cx = w.box.x + w.box.w / 2, cy = w.box.y + w.box.h / 2;
    return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
  });
  if (!inside.length || inside.some((w) => w.conf < KNOWN_MIN_CONF)) return null;
  const alnum = inside.map((w) => w.text).join('').replace(/[^A-Za-z0-9]/g, '').length;
  if (alnum < 2) return null;
  // The known words must fill the line: no big uncovered stretch at either
  // end or between words (that would be text the other engine missed).
  const words = inside.sort((a, b) => a.box.x - b.box.x);
  const slack = y1 - y0;
  if (words[0].box.x - x0 > slack) return null;
  const last = words[words.length - 1];
  if (x1 - (last.box.x + last.box.w) > slack) return null;
  for (let i = 1; i < words.length; i++) {
    if (words[i].box.x - (words[i - 1].box.x + words[i - 1].box.w) > slack) return null;
  }
  if (words.some((w) => w.box.x < x0 - slack / 2 || w.box.x + w.box.w > x1 + slack / 2)) return null;
  return words;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const quadW = (q: Quad) => Math.max(dist(q[0], q[1]), dist(q[3], q[2]));
const quadH = (q: Quad) => Math.max(dist(q[0], q[3]), dist(q[1], q[2]));

/** Re-order corners so reading runs along a different edge. */
const readTopToBottom = (q: Quad): Quad => [q[1], q[2], q[3], q[0]];
const readBottomToTop = (q: Quad): Quad => [q[3], q[0], q[1], q[2]];
const upsideDown = (q: Quad): Quad => [q[2], q[3], q[0], q[1]];

function meanConf(results: RecResult[]): number {
  let s = 0, n = 0;
  for (const r of results) {
    const k = Math.max(1, r.text.length);
    s += r.conf * k;
    n += k;
  }
  return n ? s / n : 0;
}

const largest = (dets: DetectedBox[], k: number) =>
  [...dets].sort((a, b) => quadW(b.quad) * quadH(b.quad) - quadW(a.quad) * quadH(a.quad)).slice(0, k);

export async function runPaddleOcr(ort: Ort, models: PaddleModels, original: RgbaImage, options: PaddleOptions = {}): Promise<OcrPage> {
  const t0 = now();
  const detOpt = { ...DEFAULT_DET, ...options.det };
  let rotation: 0 | 90 | 180 | 270 = 0;
  let img = original;
  let dets = await detectText(ort, models.det, img, detOpt);

  // --- Sideways photo? Most text regions are tall and thin. ---------------
  const area = (d: DetectedBox) => quadW(d.quad) * quadH(d.quad);
  const vertical = dets.filter((d) => quadH(d.quad) > 1.5 * quadW(d.quad));
  const totalArea = dets.reduce((s, d) => s + area(d), 0);
  if (vertical.length >= 2 && vertical.reduce((s, d) => s + area(d), 0) > 0.5 * totalArea) {
    const probe = largest(vertical, 6);
    const down = await recognizeLines(ort, models.rec, img, probe.map((d) => readTopToBottom(d.quad)), models.dict);
    const up = await recognizeLines(ort, models.rec, img, probe.map((d) => readBottomToTop(d.quad)), models.dict);
    rotation = meanConf(down) >= meanConf(up) ? 270 : 90;
    img = rotate(original, rotation);
    dets = await detectText(ort, models.det, img, detOpt);
  }

  // Reuse lines another engine already read with confidence (upright images only,
  // since the known word boxes are in the original orientation).
  const reused = new Map<number, OcrWord[]>();
  if (rotation === 0 && options.knownWords?.length) {
    dets.forEach((d, i) => {
      const words = reusableWords(d.quad, options.knownWords!);
      if (words) reused.set(i, words);
    });
  }
  const toRead = dets.map((_, i) => i).filter((i) => !reused.has(i));
  const read = await recognizeLines(ort, models.rec, img, toRead.map((i) => dets[i].quad), models.dict);
  let recs: (RecResult | undefined)[] = [];
  toRead.forEach((di, k) => (recs[di] = read[k]));

  // --- Upside down? Low confidence that improves when flipped. -------------
  if (dets.length && read.length >= 3 && meanConf(read) < 0.75) {
    const probe = largest(dets, 6);
    const asIs = await recognizeLines(ort, models.rec, img, probe.map((d) => d.quad), models.dict);
    const flipped = await recognizeLines(ort, models.rec, img, probe.map((d) => upsideDown(d.quad)), models.dict);
    if (meanConf(flipped) > meanConf(asIs) + 0.1) {
      rotation = ((rotation + 180) % 360) as 0 | 90 | 180 | 270;
      img = rotate(original, rotation);
      dets = await detectText(ort, models.det, img, detOpt);
      reused.clear();
      recs = await recognizeLines(ort, models.rec, img, dets.map((d) => d.quad), models.dict);
    }
  }

  // --- Build lines (in the upright frame), then order them. ----------------
  const upright: { quad: Quad; rec: RecResult; known?: OcrWord[] }[] = [];
  dets.forEach((d, i) => {
    const known = reused.get(i);
    if (known) {
      const text = known.map((w) => w.text).join(' ');
      const conf = known.reduce((s, w) => s + w.conf, 0) / known.length;
      upright.push({ quad: d.quad, rec: { text, conf, chars: [] }, known });
      return;
    }
    const r = recs[i];
    if (!r || !r.text.trim()) return;
    if (r.conf < 0.45) return; // graphics and texture mis-detected as text
    if (r.text.replace(/\s/g, '').length === 1 && r.conf < 0.8) return;
    upright.push({ quad: d.quad, rec: r });
  });
  const ordered = readingOrder(upright);

  const toOriginal = (p: Pt): Pt => {
    const [x, y] = unrotatePoint(p.x, p.y, rotation, original.width, original.height);
    return { x, y };
  };
  const boundsOf = (pts: Pt[]): Box => {
    const o = pts.map(toOriginal);
    const xs = o.map((p) => p.x), ys = o.map((p) => p.y);
    const x = Math.max(0, Math.min(...xs)), y = Math.max(0, Math.min(...ys));
    return { x, y, w: Math.min(original.width, Math.max(...xs)) - x, h: Math.min(original.height, Math.max(...ys)) - y };
  };

  const lines: OcrLine[] = ordered.map(({ quad, rec, known }) => ({
    text: rec.text,
    conf: rec.conf,
    box: boundsOf(quad),
    textHeight: quadH(quad),
    words: known ?? splitWords(quad, rec, boundsOf),
  }));

  return { engine: 'paddle', width: original.width, height: original.height, lines, rotation, ms: now() - t0 };
}

/** Split a recognised line into words, locating each from CTC positions. */
function splitWords(quad: Quad, rec: RecResult, boundsOf: (pts: Pt[]) => Box): OcrWord[] {
  const words: OcrWord[] = [];
  const n = rec.text.length;
  if (!n) return words;
  const half = 0.5 / Math.max(1, n);
  const at = (t: number, top: boolean): Pt => {
    const a = top ? quad[0] : quad[3];
    const b = top ? quad[1] : quad[2];
    const k = Math.min(1, Math.max(0, t));
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  };
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rec.text))) {
    const first = rec.chars[m.index];
    const last = rec.chars[m.index + m[0].length - 1];
    if (!first || !last) continue;
    const s = first.pos - half, e = last.pos + half;
    const conf = rec.chars.slice(m.index, m.index + m[0].length).reduce((acc, c) => acc + c.p, 0) / m[0].length;
    words.push({ text: m[0], conf, box: boundsOf([at(s, true), at(e, true), at(e, false), at(s, false)]) });
  }
  return words;
}

interface Item {
  quad: Quad;
  rec: RecResult;
}

/**
 * Group lines into blocks (paragraphs / columns) and order them the way a
 * person reads a label: blocks top-to-bottom (left-to-right when side by
 * side), lines within a block top-to-bottom.
 */
export function readingOrder<T extends Item>(items: T[]): T[] {
  // Photos are often slightly tilted. Measure the dominant text angle and
  // work in a frame rotated back by it, so tilted lines don't look like they
  // overlap their neighbours.
  const angles = items
    .filter((it) => quadW(it.quad) > 3 * quadH(it.quad))
    .map((it) => Math.atan2(it.quad[1].y - it.quad[0].y, it.quad[1].x - it.quad[0].x))
    .sort((a, b) => a - b);
  const theta = angles.length ? angles[angles.length >> 1] : 0;
  const cos = Math.cos(-theta), sin = Math.sin(-theta);
  const geo = items.map((it) => {
    const pts = it.quad.map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }));
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), h: quadH(it.quad) };
  });
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = geo[i], b = geo[j];
      const hMin = Math.min(a.h, b.h), hMax = Math.max(a.h, b.h);
      if (hMax / Math.max(1, hMin) > 1.6) continue;
      const gap = Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1);
      if (gap > 0.9 * hMin) continue;
      const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      if (overlapX <= 0) continue;
      // Lines side by side on the same row are separate blocks unless one
      // continues the other (e.g. wrapped paragraph).
      const overlapY = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (overlapY > 0.5 * hMin) continue;
      parent[find(i)] = find(j);
    }
  }
  const blocks = new Map<number, number[]>();
  items.forEach((_, i) => {
    const r = find(i);
    if (!blocks.has(r)) blocks.set(r, []);
    blocks.get(r)!.push(i);
  });
  const list = [...blocks.values()].map((idx) => {
    idx.sort((a, b) => geo[a].y0 - geo[b].y0 || geo[a].x0 - geo[b].x0);
    return {
      idx,
      x0: Math.min(...idx.map((i) => geo[i].x0)),
      y0: Math.min(...idx.map((i) => geo[i].y0)),
      y1: Math.max(...idx.map((i) => geo[i].y1)),
      firstH: geo[idx[0]].h,
    };
  });
  list.sort((a, b) => a.y0 - b.y0);
  // Bucket blocks whose tops are level into rows, then read rows left-to-right.
  const rows: (typeof list)[] = [];
  for (const b of list) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(b.y0 - row[0].y0) < 0.6 * Math.min(b.firstH, row[0].firstH)) row.push(b);
    else rows.push([b]);
  }
  const out: T[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x0 - b.x0);
    for (const b of row) for (const i of b.idx) out.push(items[i]);
  }
  return out;
}
