import { describe, expect, it } from 'vitest';
import { verifyLabel } from '../../src/domain/verify';
import type { ApplicationData, FieldKey, VerificationResult } from '../../src/domain/types';
import { APP, GOOD_LABEL, page, reading, WARNING_LINES, type LineSpec } from './helpers';

const status = (r: VerificationResult, k: FieldKey) => r.fields.find((f) => f.key === k)!.status;
const field = (r: VerificationResult, k: FieldKey) => r.fields.find((f) => f.key === k)!;
const run = (lines: (string | LineSpec)[], app: Partial<ApplicationData> = {}) => verifyLabel({ ...APP, ...app }, reading(page(lines)));

const replaceLine = (from: string, to: LineSpec | null) =>
  GOOD_LABEL.flatMap((l) => (l.text === from ? (to ? [to] : []) : [l]));

describe('a correct label', () => {
  it('passes every check', () => {
    const r = run(GOOD_LABEL);
    expect(r.fields.map((f) => [f.key, f.status])).toEqual([
      ['brandName', 'match'],
      ['classType', 'match'],
      ['alcoholContent', 'match'],
      ['netContents', 'match'],
      ['bottler', 'match'],
      ['countryOfOrigin', 'skipped'],
      ['warning', 'match'],
    ]);
    expect(r.verdict).toBe('pass');
  });

  it('points to where each field was found', () => {
    const r = run(GOOD_LABEL);
    expect(field(r, 'brandName').evidence.length).toBeGreaterThan(0);
    expect(field(r, 'warning').evidence.length).toBeGreaterThan(0);
  });
});

describe('brand name', () => {
  it("treats capitalisation/punctuation differences as a match (Dave's STONE'S THROW example)", () => {
    const r = run([{ text: "STONE'S THROW", h: 90 }, ...WARNING_LINES], { brandName: "Stone's Throw" });
    expect(status(r, 'brandName')).toBe('match');
    expect(field(r, 'brandName').message).toMatch(/capitalization/);
  });

  it('flags a different brand in the main text even if the name appears in small print', () => {
    const lines = replaceLine('DISTILLERY', { text: 'DISTILLING CO.', h: 60 });
    const r = run(lines);
    expect(status(r, 'brandName')).toBe('mismatch');
    expect(field(r, 'brandName').found).toContain('DISTILLING');
  });

  it('asks for review when the brand is only in small print', () => {
    const lines = GOOD_LABEL.filter((l) => l.text !== 'OLD TOM' && l.text !== 'DISTILLERY');
    expect(status(run(lines), 'brandName')).toBe('review');
  });

  it('asks for review when one letter differs', () => {
    const lines = replaceLine('OLD TOM', { text: 'OLD TIM', h: 100 });
    expect(status(run(lines), 'brandName')).toBe('review');
  });
});

describe('class / type', () => {
  it('accepts whisky/whiskey spelling variants', () => {
    const r = run(GOOD_LABEL, { classType: 'Kentucky Straight Bourbon Whisky' });
    expect(status(r, 'classType')).toBe('match');
  });
  it('says what the label shows when the designation differs', () => {
    const lines = replaceLine('Kentucky Straight Bourbon', { text: 'Straight Bourbon', h: 44 });
    const r = run(lines, { classType: 'Straight Rye Whiskey' });
    expect(status(r, 'classType')).toBe('mismatch');
    expect(field(r, 'classType').found).toMatch(/Bourbon/);
  });
  it('reports a different class', () => {
    const r = run(GOOD_LABEL, { classType: 'Tennessee Whiskey' });
    expect(['mismatch', 'missing', 'review']).toContain(status(r, 'classType'));
    expect(r.verdict).not.toBe('pass');
  });
});

describe('alcohol content', () => {
  it('detects a different percentage', () => {
    const lines = replaceLine('45% Alc./Vol. (90 Proof) 750 mL', { text: '40% Alc./Vol. (80 Proof) 750 mL', h: 30 });
    const r = run(lines);
    expect(status(r, 'alcoholContent')).toBe('mismatch');
    expect(field(r, 'alcoholContent').message).toMatch(/40%/);
    expect(r.verdict).toBe('fail');
  });
  it('accepts the bare number from the application', () => {
    expect(status(run(GOOD_LABEL, { alcoholContent: '45' }), 'alcoholContent')).toBe('match');
  });
  it('flags a proof that does not equal twice the ABV', () => {
    const lines = replaceLine('45% Alc./Vol. (90 Proof) 750 mL', { text: '45% Alc./Vol. (80 Proof) 750 mL', h: 30 });
    expect(status(run(lines, { alcoholContent: '45%' }), 'alcoholContent')).toBe('review');
  });
  it('reports a missing statement', () => {
    const lines = replaceLine('45% Alc./Vol. (90 Proof) 750 mL', { text: '750 mL', h: 30 });
    expect(status(run(lines), 'alcoholContent')).toBe('missing');
  });
  it('skips when a beer application gives no alcohol content', () => {
    expect(status(run(GOOD_LABEL, { beverageType: 'beer', alcoholContent: '' }), 'alcoholContent')).toBe('skipped');
  });
});

describe('net contents', () => {
  it('detects a different volume', () => {
    const lines = replaceLine('45% Alc./Vol. (90 Proof) 750 mL', { text: '45% Alc./Vol. (90 Proof) 700 mL', h: 30 });
    const r = run(lines);
    expect(status(r, 'netContents')).toBe('mismatch');
    expect(field(r, 'netContents').found).toBe('700 mL');
  });
  it('matches across unit systems', () => {
    const r = run([{ text: 'HOPPY TRAILS', h: 90 }, 'India Pale Ale', '6.8% ALC/VOL 12 FL OZ', ...WARNING_LINES], {
      beverageType: 'beer',
      brandName: 'Hoppy Trails',
      classType: 'India Pale Ale',
      alcoholContent: '6.8%',
      netContents: '355 mL',
      bottler: '',
    });
    expect(status(r, 'netContents')).toBe('match');
  });
  it('requires U.S. units on beer', () => {
    const r = run([{ text: 'HOPPY TRAILS', h: 90 }, '6.8% ALC/VOL 355 mL', ...WARNING_LINES], {
      beverageType: 'beer',
      brandName: 'Hoppy Trails',
      alcoholContent: '6.8%',
      netContents: '355 mL',
    });
    expect(status(r, 'netContents')).toBe('review');
  });
});

describe('bottler name and address', () => {
  it('finds the address after the name even when the name is also the brand', () => {
    expect(status(run(GOOD_LABEL), 'bottler')).toBe('match');
  });
  it('accepts a state abbreviation for the state name', () => {
    const lines = replaceLine('Kentucky', null).map((l) =>
      l.text.startsWith('Distilled') ? { ...l, text: 'Distilled and Bottled by Old Tom Distillery, Bardstown, KY' } : l,
    );
    expect(status(run(lines), 'bottler')).toBe('match');
  });
  it('asks for review if the city is not next to the name', () => {
    expect(status(run(GOOD_LABEL, { bottler: 'Old Tom Distillery, Louisville, Kentucky' }), 'bottler')).toBe('review');
  });
});

describe('country of origin', () => {
  it('is skipped for domestic products', () => {
    expect(status(run(GOOD_LABEL), 'countryOfOrigin')).toBe('skipped');
  });
  it('is required for imports', () => {
    expect(status(run(GOOD_LABEL, { countryOfOrigin: 'Mexico' }), 'countryOfOrigin')).toBe('missing');
    expect(status(run([...GOOD_LABEL, 'PRODUCT OF MEXICO'], { countryOfOrigin: 'Mexico' }), 'countryOfOrigin')).toBe('match');
  });
});

describe('government warning', () => {
  const withWarning = (w: LineSpec[]) => [...GOOD_LABEL.slice(0, 8), ...w];

  it('rejects a title-case heading (Jenny’s example)', () => {
    const w = WARNING_LINES.map((l, i) => (i === 0 ? { ...l, text: l.text.replace('GOVERNMENT WARNING:', 'Government Warning:'), strokes: { 'Government': 2, 'Warning:': 2 } } : l));
    const r = run(withWarning(w));
    expect(status(r, 'warning')).toBe('mismatch');
    expect(field(r, 'warning').warning!.headerAllCaps).toBe(false);
  });

  it('rejects changed wording and highlights the words', () => {
    const w = WARNING_LINES.map((l, i) => (i === 2 ? { ...l, text: l.text.replace('impairs', 'may impair') } : l));
    const r = run(withWarning(w));
    expect(status(r, 'warning')).toBe('mismatch');
    expect(field(r, 'warning').warning!.extraText.join(' ')).toMatch(/may/);
  });

  it('rejects a statement with words left out mid-line', () => {
    const w = WARNING_LINES.map((l, i) =>
      i === 0 ? { ...l, text: 'GOVERNMENT WARNING: Women should not drink' } : l,
    );
    const r = run(withWarning(w));
    expect(status(r, 'warning')).toBe('mismatch');
    expect(field(r, 'warning').warning!.words.filter((x) => x.state === 'missing').map((x) => x.text)).toContain('Surgeon');
  });

  it('reports a missing statement', () => {
    const r = run(GOOD_LABEL.slice(0, 8));
    expect(status(r, 'warning')).toBe('missing');
    expect(r.verdict).toBe('fail');
  });

  it('asks for review when the heading is not bold', () => {
    const w = WARNING_LINES.map((l, i) => (i === 0 ? { ...l, strokes: { 'GOVERNMENT': 1.25, 'WARNING:': 1.25 } } : l));
    const r = run(withWarning(w));
    expect(status(r, 'warning')).toBe('review');
    expect(field(r, 'warning').warning!.bold).toBe('no');
  });

  it('accepts a statement printed entirely in capitals', () => {
    const w = WARNING_LINES.map((l) => ({ ...l, text: l.text.toUpperCase(), strokes: { 'GOVERNMENT': 2, 'WARNING:': 2 } }));
    expect(status(run(withWarning(w)), 'warning')).toBe('match');
  });

  it('does not call a garbled, low-confidence read a wording mismatch', () => {
    const w = WARNING_LINES.map((l, i) =>
      i === 1 ? { ...l, text: 'alcohoic bevrages durng pregnancv becausc of thc rsk of brth defecls. (2) Consumptlon of', conf: 0.6 } : l,
    );
    expect(status(run(withWarning(w)), 'warning')).toBe('review');
  });

  it('treats a single OCR slip as needing a glance, not a failure', () => {
    const w = WARNING_LINES.map((l, i) => (i === 1 ? { ...l, text: l.text.replace('defects', 'defecls') } : l));
    const r = run(withWarning(w));
    expect(status(r, 'warning')).toBe('review');
    expect(field(r, 'warning').warning!.words.find((x) => x.state === 'unclear')?.text).toBe('defects.');
  });

  it('ignores text that follows the statement', () => {
    expect(status(run([...GOOD_LABEL, 'CONTAINS SULFITES']), 'warning')).toBe('match');
  });
});

describe('several images and engines', () => {
  it('combines front and back labels', () => {
    const front = page(GOOD_LABEL.slice(0, 8));
    const back = page(WARNING_LINES);
    const r = verifyLabel(APP, [{ pages: [front] }, { pages: [back] }]);
    expect(r.verdict).toBe('pass');
    expect(field(r, 'warning').evidence[0].imageIndex).toBe(1);
  });

  it('uses whichever engine read a field correctly', () => {
    const tess = page(replaceLine('45% Alc./Vol. (90 Proof) 750 mL', { text: '45% Alc./Vol. (90 Proof) TL', h: 30 }));
    const paddle = page([{ text: '750 mL', h: 30 }], 'paddle');
    const r = verifyLabel(APP, [{ pages: [tess, paddle] }]);
    expect(status(r, 'netContents')).toBe('match');
  });
});
