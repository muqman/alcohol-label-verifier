// Build synthetic OCR pages for tests: each line gets simple geometry.
import type { OcrLine, OcrPage, OcrWord } from '../../src/ocr/types';
import type { ApplicationData, ImageReading } from '../../src/domain/types';

export interface LineSpec {
  text: string;
  /** Text height in px (prominence). Default 20. */
  h?: number;
  conf?: number;
  /** Stroke width to attach to every word (for bold tests). */
  stroke?: number;
  /** Per-word stroke widths, keyed by word text. */
  strokes?: Record<string, number>;
}

export function page(lines: (string | LineSpec)[], engine: OcrPage['engine'] = 'tesseract'): OcrPage {
  let y = 10;
  const out: OcrLine[] = lines.map((l) => {
    const spec = typeof l === 'string' ? { text: l } : l;
    const h = spec.h ?? 20;
    const conf = spec.conf ?? 0.95;
    let x = 10;
    const words: OcrWord[] = spec.text.split(/\s+/).filter(Boolean).map((t) => {
      const w = t.length * h * 0.6;
      const word: OcrWord = { text: t, conf, box: { x, y, w, h } };
      const sw = spec.strokes?.[t] ?? spec.stroke;
      if (sw !== undefined) word.stroke = { width: sw, inkHeight: h };
      x += w + h * 0.3;
      return word;
    });
    const line: OcrLine = { text: words.map((w) => w.text).join(' '), conf, box: { x: 10, y, w: x - 10, h }, textHeight: h, words };
    y += h * 1.5;
    return line;
  });
  return { engine, width: 1000, height: y + 10, lines: out, rotation: 0, ms: 1 };
}

export const reading = (...pages: OcrPage[]): ImageReading[] => [{ pages }];

export const APP: ApplicationData = {
  beverageType: 'spirits',
  brandName: 'OLD TOM DISTILLERY',
  classType: 'Kentucky Straight Bourbon Whiskey',
  alcoholContent: '45% Alc./Vol. (90 Proof)',
  netContents: '750 mL',
  bottler: 'Old Tom Distillery, Bardstown, Kentucky',
  countryOfOrigin: '',
};

export const WARNING_LINES: LineSpec[] = [
  { text: 'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink', h: 12, strokes: { 'GOVERNMENT': 2.0, 'WARNING:': 2.0 }, stroke: 1.25 },
  { text: 'alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of', h: 12, stroke: 1.25 },
  { text: 'alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause', h: 12, stroke: 1.25 },
  { text: 'health problems.', h: 12, stroke: 1.25 },
];

/** A complete, correct Old Tom label. */
export const GOOD_LABEL: LineSpec[] = [
  { text: 'EST. 1887', h: 16 },
  { text: 'OLD TOM', h: 100 },
  { text: 'DISTILLERY', h: 60 },
  { text: 'Kentucky Straight Bourbon', h: 44 },
  { text: 'Whiskey', h: 44 },
  { text: '45% Alc./Vol. (90 Proof) 750 mL', h: 30 },
  { text: 'Distilled and Bottled by Old Tom Distillery, Bardstown,', h: 18 },
  { text: 'Kentucky', h: 18 },
  ...WARNING_LINES,
];
