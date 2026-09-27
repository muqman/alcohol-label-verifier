// Approximate string matching.
import { confusable } from './text';

const SUB_CONFUSABLE = 0.5;

const subCost = (a: string, b: string) => (a === b ? 0 : confusable(a, b) ? SUB_CONFUSABLE : 1);

export interface SearchHit {
  /** Weighted edit distance between the pattern and text[start, end). */
  distance: number;
  start: number;
  end: number;
  /** 1 - distance / pattern length, clamped to 0..1. */
  similarity: number;
}

/**
 * Find the substring of `text` that best matches `pattern` (Sellers'
 * algorithm: edit distance with free start and end in the text).
 * Substituting characters OCR commonly confuses (0/o, 1/l, 5/s...) costs half.
 */
export function approxSearch(pattern: string, text: string): SearchHit | null {
  const m = pattern.length;
  const n = text.length;
  if (m === 0 || n === 0) return null;
  // prev/cur rows of the DP; start[] tracks where each alignment began.
  let prev = new Float64Array(n + 1);
  let cur = new Float64Array(n + 1);
  let prevStart = new Int32Array(n + 1);
  let curStart = new Int32Array(n + 1);
  for (let j = 0; j <= n; j++) {
    prev[j] = 0;
    prevStart[j] = j;
  }
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    curStart[0] = 0;
    const pc = pattern[i - 1];
    for (let j = 1; j <= n; j++) {
      const diag = prev[j - 1] + subCost(pc, text[j - 1]);
      const up = prev[j] + 1; // pattern char missing from text
      const left = cur[j - 1] + 1; // extra char in text
      if (diag <= up && diag <= left) {
        cur[j] = diag;
        curStart[j] = prevStart[j - 1];
      } else if (up <= left) {
        cur[j] = up;
        curStart[j] = prevStart[j];
      } else {
        cur[j] = left;
        curStart[j] = curStart[j - 1];
      }
    }
    [prev, cur] = [cur, prev];
    [prevStart, curStart] = [curStart, prevStart];
  }
  let best = 1;
  for (let j = 2; j <= n; j++) {
    // Prefer the shortest span among equally good matches.
    if (prev[j] < prev[best] || (prev[j] === prev[best] && j - prevStart[j] < best - prevStart[best])) best = j;
  }
  const distance = prev[best];
  return { distance, start: prevStart[best], end: best, similarity: Math.max(0, 1 - distance / m) };
}

export type AlignOp =
  | { op: 'match'; p: number; t: number }
  | { op: 'sub'; p: number; t: number }
  | { op: 'del'; p: number } // pattern char not present in text
  | { op: 'ins'; t: number }; // text char not present in pattern

/**
 * Global alignment of the whole pattern against a prefix of `text` (the text
 * may continue after the pattern ends). Returns the edit script.
 */
export function alignPrefix(pattern: string, text: string): { ops: AlignOp[]; textEnd: number } {
  const m = pattern.length;
  const n = text.length;
  const W = n + 1;
  const D = new Float64Array((m + 1) * W);
  for (let j = 0; j <= n; j++) D[j] = j;
  for (let i = 1; i <= m; i++) {
    D[i * W] = i;
    for (let j = 1; j <= n; j++) {
      const diag = D[(i - 1) * W + j - 1] + subCost(pattern[i - 1], text[j - 1]);
      const up = D[(i - 1) * W + j] + 1;
      const left = D[i * W + j - 1] + 1;
      D[i * W + j] = Math.min(diag, up, left);
    }
  }
  // Free end in the text: pick the best column in the last row.
  let j = 0;
  for (let k = 1; k <= n; k++) if (D[m * W + k] < D[m * W + j]) j = k;
  const textEnd = j;
  const ops: AlignOp[] = [];
  let i = m;
  while (i > 0 || j > 0) {
    const here = D[i * W + j];
    if (i > 0 && j > 0 && here === D[(i - 1) * W + j - 1] + subCost(pattern[i - 1], text[j - 1])) {
      ops.push(pattern[i - 1] === text[j - 1] ? { op: 'match', p: i - 1, t: j - 1 } : { op: 'sub', p: i - 1, t: j - 1 });
      i--;
      j--;
    } else if (i > 0 && here === D[(i - 1) * W + j] + 1) {
      ops.push({ op: 'del', p: i - 1 });
      i--;
    } else {
      ops.push({ op: 'ins', t: j - 1 });
      j--;
    }
  }
  ops.reverse();
  return { ops, textEnd };
}
