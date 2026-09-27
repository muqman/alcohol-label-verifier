// Parsing of alcohol content and net contents statements.
import { fold } from './text';

/** Repair digits that OCR commonly reads as letters when they sit next to numbers. */
export function fixDigits(s: string): string {
  return fold(s)
    .replace(/(?<=\d)[Oo](?=[\d%.,]|\s*%)/g, '0')
    .replace(/(?<=[\d.,])[Oo](?=\d)/g, '0')
    .replace(/(?<=\d[.,]?)[Il|](?=\d)/g, '1')
    .replace(/(?<![A-Za-z])[Il|](?=\d{1,2}(?:[.,]\d)?\s*%)/g, '1')
    // Unit abbreviations with a digit/letter mix-up: "FL 0Z", "750 mI".
    .replace(/(fl\.?\s*)0(z)/gi, '$1o$2')
    .replace(/(?<=\d\s?)m[I|1](?![A-Za-z])/g, 'ml');
}

const num = (s: string) => parseFloat(s.replace(',', '.'));

// ---------------------------------------------------------------------------
// Alcohol content
// ---------------------------------------------------------------------------

export interface AbvStatement {
  abv: number;
  /** Text as printed, e.g. "45% Alc./Vol." */
  text: string;
  /** Mentions alcohol/volume ("alc", "vol", "ABV")? */
  hasKeyword: boolean;
}

const NOT_ABV = /^\s*(de\s+)?(agave|malt|barley|corn|rye|wheat|grape|juice|natural|organic|recycl|pure|cotton|real|cane|blue|rice|pot\s+still)/i;
const ABV_KEYWORD = /\balc\b|alc\.|alcohol|\bvol\b|vol\.|volume|\babv\b/i;

export function findAbv(line: string): AbvStatement[] {
  const s = fixDigits(line);
  const out: AbvStatement[] = [];
  const re = /(?<![\d.,])(\d{1,2}(?:[.,]\d{1,2})?)\s*%/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const after = s.slice(m.index + m[0].length, m.index + m[0].length + 20);
    if (NOT_ABV.test(after)) continue;
    const around = s.slice(Math.max(0, m.index - 16), m.index + m[0].length + 20);
    out.push({ abv: num(m[1]), text: s.slice(m.index, Math.min(s.length, m.index + m[0].length + 12)).trim(), hasKeyword: ABV_KEYWORD.test(around) });
  }
  // "ABV 6.8" / "6.8 ABV" without a percent sign.
  const re2 = /(?:\babv[:\s]*(\d{1,2}(?:[.,]\d{1,2})?)(?!\s*%))|(?:(\d{1,2}(?:[.,]\d{1,2})?)\s*abv\b)/gi;
  while ((m = re2.exec(s))) out.push({ abv: num(m[1] ?? m[2]), text: m[0], hasKeyword: true });
  return out;
}

export function findProof(line: string): number[] {
  const s = fixDigits(line);
  const out: number[] = [];
  const re = /(\d{2,3}(?:[.,]\d)?)\s*°?\s*proof\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.push(num(m[1]));
  return out;
}

/** Understand the application's alcohol content, e.g. "45% Alc./Vol. (90 Proof)", "45", "6.8% ABV". */
export function parseExpectedAbv(s: string): { abv: number | null; proof: number | null } {
  const f = fixDigits(s);
  const proof = findProof(f)[0] ?? null;
  const pct = /(\d{1,3}(?:[.,]\d{1,2})?)\s*%/.exec(f);
  if (pct) return { abv: num(pct[1]), proof };
  const bare = /(\d{1,2}(?:[.,]\d{1,2})?)(?!\s*°?\s*proof)/i.exec(f.replace(/(\d{2,3}(?:[.,]\d)?)\s*°?\s*proof/gi, ''));
  if (bare) return { abv: num(bare[1]), proof };
  if (proof !== null) return { abv: proof / 2, proof };
  return { abv: null, proof: null };
}

// ---------------------------------------------------------------------------
// Net contents
// ---------------------------------------------------------------------------

export interface VolumeStatement {
  ml: number;
  text: string;
  /** U.S. customary unit (fl oz, pint, quart, gallon)? */
  us: boolean;
}

const UNITS: [RegExp, number, boolean][] = [
  [/^(ml|mls|milliliters?|millilitres?)$/, 1, false],
  [/^(cl|centiliters?|centilitres?)$/, 10, false],
  [/^(l|lt|ltr|liters?|litres?)$/, 1000, false],
  [/^(fl\.?oz\.?|fluidounces?|fl\.?ounces?|ounces?|oz\.?)$/, 29.5735, true],
  [/^(pints?|pt\.?)$/, 473.176, true],
  [/^(quarts?|qt\.?)$/, 946.353, true],
  [/^(gallons?|gal\.?)$/, 3785.41, true],
];

const VOLUME_RE =
  /(?<![\d.,])(\d+(?:[.,]\d+)?(?:\s+\d\/\d)?|\d\/\d)\s*(milliliters?|millilitres?|mls?|centiliters?|centilitres?|cl|liters?|litres?|ltr|lt|l|fluid\s*ounces?|fl\.?\s*oz\.?|fl\.?\s*ounces?|ounces?|oz\.?|pints?|pt\.?|quarts?|qt\.?|gallons?|gal\.?)(?![a-z])/gi;

function parseAmount(a: string): number {
  const frac = /^(?:(\d+)\s+)?(\d)\/(\d)$/.exec(a.trim());
  if (frac) return (frac[1] ? parseInt(frac[1], 10) : 0) + parseInt(frac[2], 10) / parseInt(frac[3], 10);
  return num(a);
}

export function findVolumes(line: string): VolumeStatement[] {
  const s = fixDigits(line);
  const out: VolumeStatement[] = [];
  let m: RegExpExecArray | null;
  VOLUME_RE.lastIndex = 0;
  while ((m = VOLUME_RE.exec(s))) {
    const unit = m[2].toLowerCase().replace(/\s+/g, '');
    const def = UNITS.find(([re]) => re.test(unit));
    if (!def) continue;
    const amount = parseAmount(m[1]);
    if (!isFinite(amount) || amount <= 0) continue;
    out.push({ ml: amount * def[1], text: m[0].trim(), us: def[2] });
  }
  // "1 PINT 8 FL OZ" -> one statement.
  for (let i = 0; i + 1 < out.length; i++) {
    if (/pint|pt/i.test(out[i].text) && /oz|ounce/i.test(out[i + 1].text)) {
      out.splice(i, 2, { ml: out[i].ml + out[i + 1].ml, text: `${out[i].text} ${out[i + 1].text}`, us: true });
    }
  }
  return out;
}

export function parseExpectedVolume(s: string): VolumeStatement | null {
  return findVolumes(s)[0] ?? null;
}

/** Same volume, allowing for rounding between unit systems (12 fl oz = 355 mL). */
export const sameVolume = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, 0.01 * Math.max(a, b));

export const formatNumber = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
