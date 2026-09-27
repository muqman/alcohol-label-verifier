// Text normalisation shared by all checks.

/** Unicode fold: strip accents, unify quotes/dashes/spaces. "Château" -> "Chateau". */
export function fold(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’‚‛′´`]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/[  -​　]/g, ' ');
}

/**
 * A comparison key: lower-case letters and digits only. Spacing, punctuation
 * and capitalisation are ignored, which is how a person compares a brand name
 * ("STONE'S THROW" vs "Stone's Throw") - and it also makes the comparison
 * immune to OCR dropping or adding spaces.
 */
export function key(s: string): string {
  return fold(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Characters OCR engines commonly confuse, mapped to one representative. */
const CONFUSABLE: Record<string, string> = {
  '0': 'o',
  '1': 'l',
  i: 'l',
  '5': 's',
  '8': 'b',
  '6': 'b',
  '2': 'z',
};

export const confusable = (a: string, b: string) => a === b || (CONFUSABLE[a] ?? a) === (CONFUSABLE[b] ?? b);

/** Collapse whitespace for display. */
export const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

/** True if the two strings differ only in case, spacing or punctuation. */
export const sameIgnoringFormat = (a: string, b: string) => key(a) === key(b);
