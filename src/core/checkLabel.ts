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
import type { OcrPage, OcrWord, RgbaImage } from '../ocr/types';

export interface OcrBackends {
  tesseract(img: RgbaImage): Promise<OcrPage>;
  paddle(img: RgbaImage, knownWords: OcrWord[]): Promise<OcrPage>;
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

export async function checkLabel(
  app: ApplicationData,
  images: RgbaImage[],
  ocr: OcrBackends,
  onStage?: (stage: Stage) => void,
): Promise<LabelCheck> {
  const t0 = now();
  onStage?.('reading');
  const fast = await Promise.all(images.map((img) => ocr.tesseract(img)));
  fast.forEach((page, i) => annotateWarningStrokes(images[i], page));
  let readings: ImageReading[] = fast.map((page) => ({ pages: [page] }));
  let result = verifyLabel(app, readings);
  if (!needsSecondLook(result)) return { result, readings, secondLook: false, ms: now() - t0 };

  onStage?.('second-look');
  const deep: OcrPage[] = [];
  for (let i = 0; i < images.length; i++) {
    const known = fast[i].lines.flatMap((l) => l.words);
    const page = await ocr.paddle(images[i], known);
    annotateWarningStrokes(images[i], page);
    deep.push(page);
  }
  readings = images.map((_, i) => ({ pages: [fast[i], deep[i]] }));
  result = verifyLabel(app, readings);
  return { result, readings, secondLook: true, ms: now() - t0 };
}

/** Re-run only the comparison (e.g. after the agent edits a field): instant. */
export const recheck = (app: ApplicationData, readings: ImageReading[]) => verifyLabel(app, readings);
