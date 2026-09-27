// Convert Tesseract.js output into the shared OcrPage model.
import type { Box, OcrLine, OcrPage, OcrWord } from '../types';

interface TBox { x0: number; y0: number; x1: number; y1: number }
interface TWord { text: string; confidence: number; bbox: TBox }
interface TLine { words: TWord[]; confidence: number; bbox: TBox }
interface TPage { blocks: { paragraphs: { lines: TLine[] }[] }[] | null }

const toBox = (b: TBox, scale: number): Box => ({ x: b.x0 * scale, y: b.y0 * scale, w: (b.x1 - b.x0) * scale, h: (b.y1 - b.y0) * scale });

const median = (v: number[]) => [...v].sort((a, b) => a - b)[v.length >> 1] ?? 0;

/**
 * @param scale factor from the image Tesseract saw back to the image the app
 *              reports coordinates in (e.g. 0.5 if we enlarged it 2x).
 */
export function tesseractToPage(data: TPage, width: number, height: number, ms: number, scale = 1): OcrPage {
  const lines: OcrLine[] = [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs) {
      for (const line of para.lines) {
        const words: OcrWord[] = line.words
          .map((w) => ({ text: w.text.trim(), conf: Math.max(0, Math.min(1, w.confidence / 100)), box: toBox(w.bbox, scale) }))
          .filter((w) => w.text.length > 0);
        if (!words.length) continue;
        const text = words.map((w) => w.text).join(' ');
        const alnum = text.replace(/[^A-Za-z0-9]/g, '').length;
        const conf = Math.max(0, Math.min(1, line.confidence / 100));
        // Tesseract turns borders, barcodes and textures into junk like "|| ~=".
        if (alnum === 0 || (conf < 0.4 && alnum < 4) || (alnum / text.length < 0.4 && conf < 0.6)) continue;
        // Text height is the short side of word boxes, which also works for
        // lines Tesseract found running vertically.
        const long = words.filter((w) => w.text.length >= 3);
        const textHeight = median((long.length ? long : words).map((w) => Math.min(w.box.w, w.box.h)));
        lines.push({ text, conf, box: toBox(line.bbox, scale), textHeight, words });
      }
    }
  }
  return { engine: 'tesseract', width, height, lines, rotation: 0, ms };
}
