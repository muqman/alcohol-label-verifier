// A "stream" is the text of an OCR page flattened into one comparison key
// (see text.ts#key), remembering where every key character came from so that
// a match can be traced back to the exact words and boxes on the image.
import type { Box, OcrLine, OcrPage } from '../ocr/types';
import { fold } from './text';

export interface Stream {
  page: OcrPage;
  imageIndex: number;
  key: string;
  /** For each key char: source line index and char index in line.text. */
  line: Int32Array;
  raw: Int32Array;
}

export function buildStream(page: OcrPage, imageIndex: number, include: (l: OcrLine, i: number) => boolean = () => true): Stream {
  let key = '';
  const line: number[] = [];
  const raw: number[] = [];
  page.lines.forEach((l, li) => {
    if (!include(l, li)) return;
    for (let ri = 0; ri < l.text.length; ri++) {
      const k = fold(l.text[ri]).toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const ch of k) {
        key += ch;
        line.push(li);
        raw.push(ri);
      }
    }
  });
  return { page, imageIndex, key, line: Int32Array.from(line), raw: Int32Array.from(raw) };
}

/** Raw label text covering key[start, end), joined across lines. */
export function spanText(s: Stream, start: number, end: number): string {
  if (end <= start) return '';
  const parts: string[] = [];
  let i = start;
  while (i < end) {
    const li = s.line[i];
    let j = i;
    while (j + 1 < end && s.line[j + 1] === li) j++;
    const text = s.page.lines[li].text;
    let a = s.raw[i];
    let b = s.raw[j] + 1;
    // Include punctuation glued to the matched words, e.g. "STONE'S", "Co.".
    while (a > 0 && /[^\s]/.test(text[a - 1]) && !/[a-z0-9]/i.test(fold(text[a - 1]))) a--;
    while (b < text.length && /[.'%)]/.test(text[b])) b++;
    parts.push(text.slice(a, b));
    i = j + 1;
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/** Line indices touched by key[start, end). */
export function spanLines(s: Stream, start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i < end; i++) if (out[out.length - 1] !== s.line[i]) out.push(s.line[i]);
  return out;
}

const union = (boxes: Box[]): Box => {
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w));
  const y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

/** Word index ranges inside line.text (words are whitespace-separated). */
export function wordRanges(text: string): [number, number][] {
  const out: [number, number][] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push([m.index, m.index + m[0].length]);
  return out;
}

/** One box per line: the words that key[start, end) touches. */
export function spanBoxes(s: Stream, start: number, end: number): Box[] {
  const boxes: Box[] = [];
  for (const li of spanLines(s, start, end)) {
    const line = s.page.lines[li];
    let lo = Infinity, hi = -Infinity;
    for (let i = start; i < end; i++) {
      if (s.line[i] !== li) continue;
      lo = Math.min(lo, s.raw[i]);
      hi = Math.max(hi, s.raw[i]);
    }
    const ranges = wordRanges(line.text);
    const hit = line.words.filter((_, wi) => ranges[wi] && ranges[wi][0] <= hi && ranges[wi][1] > lo).map((w) => w.box);
    boxes.push(hit.length && line.words.length === ranges.length ? union(hit) : line.box);
  }
  return boxes;
}

/** Mean OCR confidence of the words touched by key[start, end). */
export function spanConfidence(s: Stream, start: number, end: number): number {
  let sum = 0, n = 0;
  for (const li of spanLines(s, start, end)) {
    const line = s.page.lines[li];
    const ranges = wordRanges(line.text);
    let lo = Infinity, hi = -Infinity;
    for (let i = start; i < end; i++) {
      if (s.line[i] !== li) continue;
      lo = Math.min(lo, s.raw[i]);
      hi = Math.max(hi, s.raw[i]);
    }
    line.words.forEach((w, wi) => {
      const r = ranges[wi];
      if (r && r[0] <= hi && r[1] > lo) {
        sum += w.conf;
        n++;
      }
    });
    if (!line.words.length) {
      sum += line.conf;
      n++;
    }
  }
  return n ? sum / n : 0;
}
