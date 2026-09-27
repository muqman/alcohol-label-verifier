import type { Box, OcrEngineName, OcrPage } from '../ocr/types';

export type BeverageType = 'spirits' | 'wine' | 'beer';

/** The data an applicant submitted (what the label is supposed to say). */
export interface ApplicationData {
  beverageType: BeverageType;
  brandName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  /** Name and address of the bottler / producer / importer. */
  bottler: string;
  /** Blank for domestic products. */
  countryOfOrigin: string;
}

export const EMPTY_APPLICATION: ApplicationData = {
  beverageType: 'spirits',
  brandName: '',
  classType: '',
  alcoholContent: '',
  netContents: '',
  bottler: '',
  countryOfOrigin: '',
};

export type FieldKey = 'brandName' | 'classType' | 'alcoholContent' | 'netContents' | 'bottler' | 'countryOfOrigin' | 'warning';

export const FIELD_ORDER: FieldKey[] = ['brandName', 'classType', 'alcoholContent', 'netContents', 'bottler', 'countryOfOrigin', 'warning'];

export const FIELD_LABELS: Record<FieldKey, string> = {
  brandName: 'Brand name',
  classType: 'Class / type',
  alcoholContent: 'Alcohol content',
  netContents: 'Net contents',
  bottler: 'Bottler / producer',
  countryOfOrigin: 'Country of origin',
  warning: 'Government warning',
};

/**
 * match     - label agrees with the application
 * review    - probably fine or probably wrong, but a person should look
 * mismatch  - label clearly says something different
 * missing   - required text not found on the label
 * skipped   - not applicable / nothing to compare against
 */
export type FieldStatus = 'match' | 'review' | 'mismatch' | 'missing' | 'skipped';

export type Verdict = 'pass' | 'review' | 'fail';

/** Where on which image a piece of text was found. */
export interface Evidence {
  imageIndex: number;
  engine: OcrEngineName;
  box: Box;
}

export interface FieldResult {
  key: FieldKey;
  status: FieldStatus;
  /** Value from the application (display form). */
  expected: string;
  /** What the label appears to say, if anything was found. */
  found: string | null;
  /** Plain-language explanation for the agent. */
  message: string;
  evidence: Evidence[];
  warning?: WarningDetails;
}

export type WordState = 'ok' | 'unclear' | 'changed' | 'missing' | 'unread';

export interface WarningWord {
  /** Word as printed in the official statement. */
  text: string;
  state: WordState;
  /** What was read instead (for changed/unclear words). */
  read?: string;
}

export interface WarningDetails {
  headerFound: boolean;
  /** Header exactly as read from the label, e.g. "Government Warning:". */
  headerText: string | null;
  headerAllCaps: boolean | null;
  bold: 'yes' | 'no' | 'unsure' | 'unknown';
  boldRatio: number | null;
  words: WarningWord[];
  /** Extra words found inside the statement that are not in the official text. */
  extraText: string[];
  /** The statement as read from the label (for display). */
  readText: string;
}

export interface VerificationResult {
  verdict: Verdict;
  fields: FieldResult[];
}

/** OCR output for one label image (possibly from more than one engine). */
export interface ImageReading {
  pages: OcrPage[];
}
