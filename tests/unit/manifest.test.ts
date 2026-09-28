import { describe, expect, it } from 'vitest';
import { beverageTypeFrom, fileKey, parseManifest, resultsToCsv, resultsToTsv, TEMPLATE_CSV } from '../../src/batch/manifest';

describe('batch manifest', () => {
  it('parses the template', () => {
    const m = parseManifest(TEMPLATE_CSV);
    expect(m.problems).toEqual([]);
    expect(m.rows).toHaveLength(2);
    expect(m.rows[0].images).toEqual(['old-tom-front.jpg', 'old-tom-back.jpg']);
    expect(m.rows[0].app.bottler).toBe('Old Tom Distillery, Bardstown, Kentucky');
    expect(m.rows[1].app.beverageType).toBe('wine');
    expect(m.rows[1].app.countryOfOrigin).toBe('France');
  });

  it('accepts friendly column names and a byte-order mark', () => {
    const m = parseManifest('\uFEFFApplication ID,Image,Brand,ABV,Volume\nA1,label.JPG,Foo,40%,750 mL\n');
    expect(m.rows[0]).toMatchObject({ id: 'A1', images: ['label.JPG'], app: { brandName: 'Foo', alcoholContent: '40%', netContents: '750 mL' } });
  });

  it('explains a missing image column', () => {
    const m = parseManifest('brand_name\nFoo\n');
    expect(m.rows).toHaveLength(0);
    expect(m.problems[0]).toMatch(/image_files/);
  });

  it('flags rows without images and unknown beverage types', () => {
    const m = parseManifest('image_files,beverage_type\n,spirits\na.jpg,kombucha\n');
    expect(m.rows).toHaveLength(1);
    expect(m.problems.join(' ')).toMatch(/Line 2/);
    expect(m.problems.join(' ')).toMatch(/kombucha/);
  });

  it('recognises beverage types and file names', () => {
    expect(beverageTypeFrom('Malt beverage')).toBe('beer');
    expect(beverageTypeFrom('Distilled Spirits')).toBe('spirits');
    expect(beverageTypeFrom('WINE')).toBe('wine');
    expect(beverageTypeFrom('Ginger beer')).toBe('beer');
    expect(beverageTypeFrom('Malt liquor')).toBe('beer');
    expect(beverageTypeFrom('London Dry Gin')).toBe('spirits');
    expect(beverageTypeFrom('Hard cider')).toBe('wine');
    expect(fileKey('C:\\labels\\Old-Tom.JPG')).toBe('old-tom.jpg');
  });

  it('exports results as CSV and tab-separated text', () => {
    const outcome = { id: 'A1', images: ['a.jpg'], verdict: 'fail' as const, seconds: 1.23, fields: [
      { key: 'alcoholContent' as const, status: 'mismatch' as const, expected: '45%', found: '40%', message: 'Does not match: the label says 40%, the application says 45%.', evidence: [] },
    ] };
    const csv = resultsToCsv([outcome]);
    expect(csv.split('\n')[0]).toMatch(/^application_id,image_files,result/);
    expect(csv).toContain('Problems found');
    expect(csv).toContain('"Alcohol content: Does not match: the label says 40%, the application says 45%."');
    expect(resultsToTsv([outcome]).split('\n')[1].split('\t')).toHaveLength(12);
  });
});
