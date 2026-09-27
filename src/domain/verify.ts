// Entry point of the verification logic: application data + OCR readings in,
// per-field results and an overall verdict out. Pure and synchronous, so it
// is fast to unit-test and cheap to re-run when the agent edits a field.
import { checkAlcohol, checkBottler, checkBrand, checkClassType, checkCountry, checkNetContents } from './checks';
import { buildStream } from './stream';
import type { ApplicationData, FieldResult, ImageReading, Verdict, VerificationResult } from './types';
import { checkWarning } from './warning';

export function verifyLabel(app: ApplicationData, images: ImageReading[]): VerificationResult {
  const streams = images.flatMap((img, imageIndex) => img.pages.map((page) => buildStream(page, imageIndex)));
  const fields: FieldResult[] = [
    checkBrand(app, streams),
    checkClassType(app, streams),
    checkAlcohol(app, streams),
    checkNetContents(app, streams),
    checkBottler(app, streams),
    checkCountry(app, streams),
    checkWarning(streams),
  ];
  return { verdict: verdictOf(fields), fields };
}

export function verdictOf(fields: FieldResult[]): Verdict {
  if (fields.some((f) => f.status === 'mismatch' || f.status === 'missing')) return 'fail';
  if (fields.some((f) => f.status === 'review')) return 'review';
  return 'pass';
}
