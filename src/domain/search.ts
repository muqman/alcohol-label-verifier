// Searching for an expected value across every OCR reading of every image.
import type { Box, OcrLine, OcrWord } from '../ocr/types';
import { approxSearch, type SearchHit } from './fuzzy';
import { spanBoxes, spanConfidence, spanLines, spanText, wordRanges, type Stream } from './stream';
import type { Evidence } from './types';
import { confusable } from './text';

export interface Candidate {
  stream: Stream;
  hit: SearchHit;
  /** Raw text on the label that matched. */
  text: string;
  /** OCR confidence of that text, 0..1. */
  conf: number;
  /** Differs from the pattern only by characters OCR commonly confuses. */
  confusableOnly: boolean;
}

/** Best approximate occurrence of `patternKey` (already key()-normalised). */
export function findBest(patternKey: string, streams: Stream[]): Candidate | null {
  let best: Candidate | null = null;
  for (const s of streams) {
    const hit = approxSearch(patternKey, s.key);
    if (!hit) continue;
    const better =
      !best ||
      hit.similarity > best.hit.similarity + 1e-9 ||
      (Math.abs(hit.similarity - best.hit.similarity) < 1e-9 && spanConfidence(s, hit.start, hit.end) > best.conf);
    if (better) {
      const found = s.key.slice(hit.start, hit.end);
      best = {
        stream: s,
        hit,
        text: spanText(s, hit.start, hit.end),
        conf: spanConfidence(s, hit.start, hit.end),
        confusableOnly: found.length === patternKey.length && [...found].every((c, i) => confusable(c, patternKey[i])),
      };
    }
  }
  return best;
}

/** Up to `max` non-overlapping occurrences of `patternKey` with similarity >= minSim. */
export function findAll(patternKey: string, streams: Stream[], minSim: number, max = 6): Candidate[] {
  const out: Candidate[] = [];
  for (const s of streams) {
    let masked = s.key;
    for (let k = 0; k < max; k++) {
      const hit = approxSearch(patternKey, masked);
      if (!hit || hit.similarity < minSim || hit.end <= hit.start) break;
      const found = s.key.slice(hit.start, hit.end);
      out.push({
        stream: s,
        hit,
        text: spanText(s, hit.start, hit.end),
        conf: spanConfidence(s, hit.start, hit.end),
        confusableOnly: found.length === patternKey.length && [...found].every((c, i) => confusable(c, patternKey[i])),
      });
      masked = masked.slice(0, hit.start) + '#'.repeat(hit.end - hit.start) + masked.slice(hit.end);
    }
  }
  return out;
}

/** Full text of the lines a candidate touches (for showing the agent context). */
export function candidateLineText(c: Candidate): string {
  return spanLines(c.stream, c.hit.start, c.hit.end)
    .map((li) => c.stream.page.lines[li].text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function evidenceFor(c: Candidate): Evidence[] {
  return spanBoxes(c.stream, c.hit.start, c.hit.end).map((box) => ({ imageIndex: c.stream.imageIndex, engine: c.stream.page.engine, box }));
}

export function lineEvidence(s: Stream, lineIndex: number): Evidence {
  return { imageIndex: s.imageIndex, engine: s.page.engine, box: s.page.lines[lineIndex].box };
}

export function candidateLines(c: Candidate): number[] {
  return spanLines(c.stream, c.hit.start, c.hit.end);
}

/** Words (with their lines) touched by key[start, end). */
export function spanWords(s: Stream, start: number, end: number): { word: OcrWord; line: OcrLine }[] {
  const out: { word: OcrWord; line: OcrLine }[] = [];
  for (const li of spanLines(s, start, end)) {
    const line = s.page.lines[li];
    let lo = Infinity, hi = -Infinity;
    for (let i = start; i < end; i++) {
      if (s.line[i] !== li) continue;
      lo = Math.min(lo, s.raw[i]);
      hi = Math.max(hi, s.raw[i]);
    }
    const ranges = wordRanges(line.text);
    if (ranges.length !== line.words.length) continue;
    line.words.forEach((word, wi) => {
      if (ranges[wi][0] <= hi && ranges[wi][1] > lo) out.push({ word, line });
    });
  }
  return out;
}

export const unionBox = (boxes: Box[]): Box => {
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  return { x: x0, y: y0, w: Math.max(...boxes.map((b) => b.x + b.w)) - x0, h: Math.max(...boxes.map((b) => b.y + b.h)) - y0 };
};
