// The "read, compare, look again if unsure" flow for one application.
//
//  1. Fast pass: Tesseract reads every image (about 1 s per label). Clean
//     label artwork is usually fully verified here.
//  2. Second look: if any field is not a clear match, PaddleOCR (a deep
//     text detector + recogniser that copes with curved, angled, glary or
//     stylised text) reads the images too. Lines Tesseract already read with
//     high confidence are reused, so only the hard parts are re-read.
//  3. The comparison runs over both readings and keeps the best evidence.
import { verifyLabel } from '../domain/verify';
import type { ApplicationData, ImageReading, VerificationResult } from '../domain/types';
import { annotateWarningStrokes } from '../ocr/strokes';
import type { Box, OcrPage, OcrWord, RgbaImage } from '../ocr/types';

/** A deep-engine run whose text detection has already started. */
export interface DeepHandle {
  finish(knownWords: OcrWord[], trustedRegions: Box[]): Promise<OcrPage>;
  cancel(): void;
}

export interface OcrBackends {
  tesseract(img: RgbaImage): Promise<OcrPage>;
  /** Optional deeper engine for the second look. */
  paddle?(img: RgbaImage, knownWords: OcrWord[], trustedRegions: Box[]): Promise<OcrPage>;
  /** Optionally start the deeper engine's text detection early, in parallel. */
  paddleEarly?(img: RgbaImage): DeepHandle;
}

export interface CheckOptions {
  onStage?: (stage: Stage) => void;
  /** Start the second engine's detection alongside the first pass (multi-core machines). */
  speculate?: boolean;
}

export interface LabelCheck {
  result: VerificationResult;
  readings: ImageReading[];
  /** True if the second, deeper OCR pass was needed. */
  secondLook: boolean;
  ms: number;
}

export type Stage = 'reading' | 'second-look';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export const needsSecondLook = (r: VerificationResult) => r.fields.some((f) => f.status !== 'match' && f.status !== 'skipped');

export async function checkLabel(app: ApplicationData, images: RgbaImage[], ocr: OcrBackends, options: CheckOptions = {}): Promise<LabelCheck> {
  const { onStage } = options;
  const t0 = now();
  onStage?.('reading');
  const early = options.speculate && ocr.paddleEarly ? images.map((img) => ocr.paddleEarly!(img)) : null;
  let fast: OcrPage[];
  try {
    fast = await Promise.all(images.map((img) => ocr.tesseract(img)));
  } catch (e) {
    early?.forEach((h) => h.cancel());
    throw e;
  }
  fast.forEach((page, i) => annotateWarningStrokes(images[i], page));
  let readings: ImageReading[] = fast.map((page) => ({ pages: [page] }));
  let result = verifyLabel(app, readings);
  if (!needsSecondLook(result) || (!ocr.paddle && !early)) {
    early?.forEach((h) => h.cancel());
    return { result, readings, secondLook: false, ms: now() - t0 };
  }

  onStage?.('second-look');
  const deep: OcrPage[] = [];
  try {
    for (let i = 0; i < images.length; i++) {
      const known = fast[i].lines.flatMap((l) => l.words);
      // Text behind fields that already matched needs no second reading.
      const trusted = result.fields.filter((f) => f.status === 'match').flatMap((f) => f.evidence.filter((e) => e.imageIndex === i).map((e) => e.box));
      const page = early ? await early[i].finish(known, trusted) : await ocr.paddle!(images[i], known, trusted);
      annotateWarningStrokes(images[i], page);
      deep.push(page);
    }
  } catch {
    // The second look is an improvement, not a requirement: keep the first result.
    early?.slice(deep.length + 1).forEach((h) => h.cancel());
    return { result, readings, secondLook: false, ms: now() - t0 };
  }
  readings = images.map((_, i) => ({ pages: [fast[i], deep[i]] }));
  result = verifyLabel(app, readings);
  return { result, readings, secondLook: true, ms: now() - t0 };
}

/** Re-run only the comparison (e.g. after the agent edits a field): instant. */
export const recheck = (app: ApplicationData, readings: ImageReading[]) => verifyLabel(app, readings);
