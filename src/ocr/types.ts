// Shared OCR data model. Both engines (Tesseract.js and PaddleOCR) produce an
// OcrPage in this shape, so the verification logic never needs to know which
// engine read the text.

/** Axis-aligned rectangle in pixels of the image that was analysed. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Stroke-thickness measurement for a word, used to judge bold type. */
export interface StrokeStats {
  /** Typical stroke width in pixels (median ink run length). */
  width: number;
  /** Height of the inked area in pixels, used to normalise the width. */
  inkHeight: number;
}

export interface OcrWord {
  text: string;
  /** 0..1 */
  conf: number;
  box: Box;
  stroke?: StrokeStats;
}

export interface OcrLine {
  text: string;
  /** 0..1 */
  conf: number;
  box: Box;
  /** Height of the text itself (font size proxy); orientation independent. */
  textHeight: number;
  words: OcrWord[];
}

export type OcrEngineName = 'tesseract' | 'paddle';

export interface OcrPage {
  engine: OcrEngineName;
  /** Size of the image the boxes refer to. */
  width: number;
  height: number;
  /** Lines in reading order. */
  lines: OcrLine[];
  /** Clockwise rotation (degrees) the engine applied to read upright text. */
  rotation: 0 | 90 | 180 | 270;
  /** Wall-clock time spent by the engine, in milliseconds. */
  ms: number;
}

/** Plain RGBA pixel buffer (same layout as the DOM ImageData). */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}
