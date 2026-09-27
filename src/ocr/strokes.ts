// Stroke-width measurement, used to judge whether "GOVERNMENT WARNING:" is
// printed in bold. OCR engines do not report font weight, so we measure it
// from the pixels: bold type has visibly thicker strokes than the regular
// text beside it.
//
// Method: for a stroke of width w and length L, ink area A ~ w*L and outline
// length P ~ 2L, so w ~ 2A / P. Both are measured on the grey levels (not a
// thresholded image), so anti-aliasing gives sub-pixel precision even when
// the warning is only ~10 px tall.
import { approxSearch } from '../domain/fuzzy';
import { key } from '../domain/text';
import { toGray } from './image';
import type { Box, OcrPage, RgbaImage, StrokeStats } from './types';

/** Background and ink grey levels of a line of text. */
export interface InkLevels {
  bg: number;
  ink: number;
}

/**
 * Estimate background / ink levels from a whole line (so every word on the
 * line is measured on the same scale). The background is whatever dominates
 * the border of the box; ink is the extreme on the other side.
 */
export function lineLevels(gray: Uint8Array, W: number, H: number, box: Box): InkLevels | null {
  const x0 = Math.max(0, Math.floor(box.x) - 2), y0 = Math.max(0, Math.floor(box.y) - 2);
  const x1 = Math.min(W, Math.ceil(box.x + box.w) + 2), y1 = Math.min(H, Math.ceil(box.y + box.h) + 2);
  if (x1 - x0 < 4 || y1 - y0 < 4) return null;
  const hist = new Uint32Array(256);
  let n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { hist[gray[y * W + x]]++; n++; }
  let border = 0, nb = 0;
  for (let x = x0; x < x1; x++) { border += gray[y0 * W + x] + gray[(y1 - 1) * W + x]; nb += 2; }
  for (let y = y0; y < y1; y++) { border += gray[y * W + x0] + gray[y * W + x1 - 1]; nb += 2; }
  const pct = (q: number) => {
    let c = 0;
    for (let v = 0; v < 256; v++) { c += hist[v]; if (c >= q * n) return v; }
    return 255;
  };
  const p02 = pct(0.02), p50 = pct(0.5), p98 = pct(0.98);
  const darkInk = border / nb >= (p02 + p98) / 2;
  const levels = darkInk ? { bg: Math.max(p50, pct(0.7)), ink: p02 } : { bg: Math.min(p50, pct(0.3)), ink: p98 };
  return Math.abs(levels.bg - levels.ink) < 25 ? null : levels;
}

/**
 * Stroke width inside `box`, estimated as 2 * ink area / outline length.
 * Ink area uses grey levels (sub-pixel accurate); outline length counts
 * crossings of the half-ink level along rows and columns, which is
 * unaffected by blur.
 */
export function measureStroke(gray: Uint8Array, W: number, H: number, box: Box, levels: InkLevels): StrokeStats | null {
  const x0 = Math.max(0, Math.floor(box.x) - 2), y0 = Math.max(0, Math.floor(box.y) - 2);
  const x1 = Math.min(W, Math.ceil(box.x + box.w) + 2), y1 = Math.min(H, Math.ceil(box.y + box.h) + 2);
  const w = x1 - x0, h = y1 - y0;
  if (w < 4 || h < 4) return null;
  const span = levels.bg - levels.ink;
  const inkAt = (i: number) => Math.min(1, Math.max(0, (levels.bg - gray[i]) / span));
  let area = 0, crossings = 0, top = -1, bottom = -1;
  for (let y = y0; y < y1; y++) {
    let prev = false, rowInk = false;
    for (let x = x0; x < x1; x++) {
      const v = inkAt(y * W + x);
      area += v;
      const on = v >= 0.5;
      if (on !== prev && x > x0) crossings++;
      if (on) rowInk = true;
      prev = on;
    }
    if (rowInk) { if (top < 0) top = y; bottom = y; }
  }
  for (let x = x0; x < x1; x++) {
    let prev = false;
    for (let y = y0; y < y1; y++) {
      const on = inkAt(y * W + x) >= 0.5;
      if (on !== prev && y > y0) crossings++;
      prev = on;
    }
  }
  if (crossings < 4 || top < 0) return null;
  return { width: (2 * area) / crossings, inkHeight: bottom - top + 1 };
}

const HEADER_WORDS = ['government', 'warning'];

/**
 * Measure strokes for the words of any line that looks like the warning
 * heading, plus the line after it (the statement usually continues there).
 */
export function annotateWarningStrokes(img: RgbaImage, page: OcrPage): void {
  let gray: Uint8Array | null = null;
  const targets = new Set<number>();
  page.lines.forEach((line, i) => {
    const k = key(line.text);
    if (HEADER_WORDS.some((w) => (approxSearch(w, k)?.similarity ?? 0) >= 0.75)) {
      targets.add(i);
      if (i + 1 < page.lines.length) targets.add(i + 1);
    }
  });
  for (const i of targets) {
    const line = page.lines[i];
    gray ??= toGray(img);
    const levels = lineLevels(gray, img.width, img.height, line.box);
    if (!levels) continue;
    for (const word of line.words) {
      if (word.stroke) continue;
      word.stroke = measureStroke(gray, img.width, img.height, word.box, levels) ?? undefined;
    }
  }
}
