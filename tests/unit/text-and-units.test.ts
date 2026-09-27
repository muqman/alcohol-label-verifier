import { describe, expect, it } from 'vitest';
import { alignPrefix, approxSearch } from '../../src/domain/fuzzy';
import { countryVariants, isDomestic, stateVariants } from '../../src/domain/places';
import { fold, key } from '../../src/domain/text';
import { findAbv, findProof, findVolumes, fixDigits, parseExpectedAbv, parseExpectedVolume, sameVolume } from '../../src/domain/units';

describe('text normalisation', () => {
  it('folds accents and typographic quotes', () => {
    expect(fold('Château')).toBe('Chateau');
    expect(fold('Stone’s Throw')).toBe("Stone's Throw");
  });
  it('builds a case/space/punctuation-insensitive key', () => {
    expect(key("STONE'S THROW")).toBe(key("Stone's Throw"));
    expect(key('45% Alc./Vol.')).toBe('45alcvol');
  });
});

describe('approxSearch', () => {
  it('finds an exact substring', () => {
    const hit = approxSearch('oldtom', 'estoldtomdistillery')!;
    expect(hit.similarity).toBe(1);
    expect(hit.start).toBe(3);
    expect(hit.end).toBe(9);
  });
  it('tolerates a missing letter with lower similarity', () => {
    const hit = approxSearch('oldtom', 'xxldtomxx')!;
    expect(hit.similarity).toBeCloseTo(5 / 6, 5);
  });
  it('charges half for OCR-confusable characters (0/o, 1/l)', () => {
    expect(approxSearch('oldtom', '0ldt0m')!.similarity).toBeCloseTo(1 - 1 / 6, 5);
    expect(approxSearch('oldtom', 'xldtxm')!.similarity).toBeCloseTo(1 - 2 / 6, 5);
  });
});

describe('alignPrefix', () => {
  it('reports inserted and deleted characters', () => {
    const { ops } = alignPrefix('abcd', 'abxcdzzz');
    const kinds = ops.map((o) => o.op);
    expect(kinds.filter((k) => k === 'ins')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'del')).toHaveLength(0);
  });
});

describe('alcohol content parsing', () => {
  it('reads common label formats', () => {
    expect(findAbv('45% Alc./Vol. (90 Proof)')[0]).toMatchObject({ abv: 45, hasKeyword: true });
    expect(findAbv('Alc. 13.5% by Vol.')[0]).toMatchObject({ abv: 13.5, hasKeyword: true });
    expect(findAbv('6.8% ALC/VOL')[0]).toMatchObject({ abv: 6.8, hasKeyword: true });
    expect(findAbv('ABV 5.2')[0]).toMatchObject({ abv: 5.2, hasKeyword: true });
    expect(findAbv('Alcohol 12,5% by volume')[0].abv).toBe(12.5);
  });
  it('ignores percentages that are not alcohol content', () => {
    expect(findAbv('100% de Agave')).toHaveLength(0);
    expect(findAbv('Made with 100% malted barley')).toHaveLength(0);
  });
  it('repairs letters misread in numbers', () => {
    expect(fixDigits('4O% alc/vol')).toBe('40% alc/vol');
    expect(findAbv('4O% ALC/VOL')[0].abv).toBe(40);
  });
  it('reads proof', () => {
    expect(findProof('45% Alc./Vol. (90 Proof)')).toEqual([90]);
  });
  it('understands the application value in several forms', () => {
    expect(parseExpectedAbv('45% Alc./Vol. (90 Proof)')).toEqual({ abv: 45, proof: 90 });
    expect(parseExpectedAbv('45')).toEqual({ abv: 45, proof: null });
    expect(parseExpectedAbv('6.8% ABV')).toEqual({ abv: 6.8, proof: null });
    expect(parseExpectedAbv('90 proof')).toEqual({ abv: 45, proof: 90 });
    expect(parseExpectedAbv('n/a')).toEqual({ abv: null, proof: null });
  });
});

describe('net contents parsing', () => {
  it('reads metric and U.S. units', () => {
    expect(findVolumes('750 mL')[0].ml).toBe(750);
    expect(findVolumes('750ML')[0].ml).toBe(750);
    expect(findVolumes('1 L')[0].ml).toBe(1000);
    expect(findVolumes('1.75 Liters')[0].ml).toBe(1750);
    expect(findVolumes('75 cl')[0].ml).toBe(750);
    expect(findVolumes('12 FL OZ')[0]).toMatchObject({ us: true });
    expect(findVolumes('12FLOZ')[0].ml).toBeCloseTo(354.88, 1);
    expect(findVolumes('1 PINT 8 FL OZ')[0].ml).toBeCloseTo(473.176 + 8 * 29.5735, 1);
  });
  it('copes with OCR mix-ups in unit abbreviations', () => {
    expect(findVolumes('12 FL 0Z')[0].ml).toBeCloseTo(354.88, 1);
    expect(findVolumes('750 mI')[0].ml).toBe(750);
  });
  it('does not treat unrelated numbers as volumes', () => {
    expect(findVolumes('Aged 12 Years')).toHaveLength(0);
    expect(findVolumes('EST. 1887')).toHaveLength(0);
  });
  it('treats equivalent amounts in different units as the same', () => {
    expect(sameVolume(parseExpectedVolume('12 fl oz')!.ml, parseExpectedVolume('355 mL')!.ml)).toBe(true);
    expect(sameVolume(parseExpectedVolume('1 Liter')!.ml, 1000)).toBe(true);
    expect(sameVolume(700, 750)).toBe(false);
  });
});

describe('places', () => {
  it('knows state abbreviations', () => {
    expect(stateVariants('Oregon')).toContain('OR');
    expect(stateVariants('KY')).toContain('Kentucky');
    expect(stateVariants('Bardstown')).toBeNull();
  });
  it('knows country aliases and what counts as domestic', () => {
    expect(countryVariants('Holland')).toContain('Netherlands');
    expect(countryVariants('Scotland')).toEqual(['Scotland']);
    expect(isDomestic('')).toBe(true);
    expect(isDomestic('USA')).toBe(true);
    expect(isDomestic('France')).toBe(false);
  });
});
