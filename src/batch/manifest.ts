// Batch input: a CSV with one row per application, pointing at image files.
import Papa from 'papaparse';
import type { ApplicationData, BeverageType, FieldResult, Verdict } from '../domain/types';
import { FIELD_LABELS, FIELD_ORDER } from '../domain/types';

export interface ManifestRow {
  /** 1-based line number in the CSV (header is line 1). */
  line: number;
  id: string;
  images: string[];
  app: ApplicationData;
}

export interface Manifest {
  rows: ManifestRow[];
  problems: string[];
}

const COLUMNS: Record<keyof Omit<ApplicationData, 'beverageType'> | 'id' | 'images' | 'beverageType', string[]> = {
  id: ['application_id', 'application', 'id', 'ttb_id', 'cola_id'],
  images: ['image_files', 'image_file', 'images', 'image', 'files', 'file', 'filename', 'label_images'],
  beverageType: ['beverage_type', 'type', 'product_type', 'beverage'],
  brandName: ['brand_name', 'brand'],
  classType: ['class_type', 'class', 'class_type_designation', 'designation'],
  alcoholContent: ['alcohol_content', 'abv', 'alcohol'],
  netContents: ['net_contents', 'net_content', 'volume', 'size'],
  bottler: ['bottler_name_address', 'bottler', 'name_and_address', 'producer', 'bottler_producer'],
  countryOfOrigin: ['country_of_origin', 'country', 'origin'],
};

const norm = (h: string) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export function beverageTypeFrom(s: string): BeverageType | null {
  const k = s.trim().toLowerCase();
  if (!k) return 'spirits';
  if (/spirit|liquor|whisk|vodka|gin|rum|tequila|brandy/.test(k)) return 'spirits';
  if (/wine|sake|cider|mead/.test(k)) return 'wine';
  if (/beer|malt|ale|lager/.test(k)) return 'beer';
  return null;
}

export const fileKey = (name: string) => name.split(/[\\/]/).pop()!.trim().toLowerCase();

export function parseManifest(text: string): Manifest {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: 'greedy', transformHeader: norm });
  const problems: string[] = [];
  const headers = parsed.meta.fields ?? [];
  const col = (field: keyof typeof COLUMNS) => COLUMNS[field].find((c) => headers.includes(c));
  if (!col('images')) {
    problems.push('The CSV needs an “image_files” column naming each label image (for example “old-tom.jpg”). Use “;” between several images.');
    return { rows: [], problems };
  }
  const rows: ManifestRow[] = [];
  parsed.data.forEach((r, i) => {
    const line = i + 2;
    const get = (field: keyof typeof COLUMNS) => {
      const c = col(field);
      return c ? (r[c] ?? '').trim() : '';
    };
    const images = get('images').split(/[;|]/).map((s) => s.trim()).filter(Boolean);
    if (!images.length) {
      problems.push(`Line ${line}: no image file listed — row skipped.`);
      return;
    }
    const type = beverageTypeFrom(get('beverageType'));
    if (!type) problems.push(`Line ${line}: beverage type “${get('beverageType')}” not recognised — treated as distilled spirits.`);
    rows.push({
      line,
      id: get('id') || `Row ${line}`,
      images,
      app: {
        beverageType: type ?? 'spirits',
        brandName: get('brandName'),
        classType: get('classType'),
        alcoholContent: get('alcoholContent'),
        netContents: get('netContents'),
        bottler: get('bottler'),
        countryOfOrigin: get('countryOfOrigin'),
      },
    });
  });
  for (const e of parsed.errors.slice(0, 5)) problems.push(`Line ${(e.row ?? 0) + 2}: ${e.message}`);
  return { rows, problems };
}

export const TEMPLATE_CSV =
  'application_id,image_files,beverage_type,brand_name,class_type,alcohol_content,net_contents,bottler_name_address,country_of_origin\n' +
  'APP-0001,old-tom-front.jpg;old-tom-back.jpg,spirits,OLD TOM DISTILLERY,Kentucky Straight Bourbon Whiskey,45% Alc./Vol. (90 Proof),750 mL,"Old Tom Distillery, Bardstown, Kentucky",\n' +
  'APP-0002,belle-rive.jpg,wine,Chateau Belle Rive,Cabernet Sauvignon,13.5%,750 mL,"Belle Rive Imports, New York, NY",France\n';

const cell = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export interface BatchOutcome {
  id: string;
  images: string[];
  verdict: Verdict | 'error';
  fields: FieldResult[];
  error?: string;
  seconds: number;
}

const WORDS: Record<string, string> = { match: 'Match', review: 'Check', mismatch: 'Mismatch', missing: 'Not found', skipped: 'Not checked' };
const VERDICT_WORDS: Record<string, string> = { pass: 'All checks passed', review: 'Needs review', fail: 'Problems found', error: 'Could not check' };

function resultRows(outcomes: BatchOutcome[]): string[][] {
  const header = ['application_id', 'image_files', 'result', ...FIELD_ORDER.map((k) => FIELD_LABELS[k].toLowerCase().replace(/[^a-z]+/g, '_')), 'issues', 'seconds'];
  const rows = outcomes.map((o) => {
    const byKey = new Map(o.fields.map((f) => [f.key, f]));
    const issues = o.error ?? o.fields.filter((f) => f.status !== 'match' && f.status !== 'skipped').map((f) => `${FIELD_LABELS[f.key]}: ${f.message}`).join(' | ');
    return [o.id, o.images.join(';'), VERDICT_WORDS[o.verdict], ...FIELD_ORDER.map((k) => WORDS[byKey.get(k)?.status ?? 'skipped']), issues, o.seconds.toFixed(1)];
  });
  return [header, ...rows];
}

export function resultsToCsv(outcomes: BatchOutcome[]): string {
  return resultRows(outcomes).map((r) => r.map((v) => cell(String(v))).join(',')).join('\n') + '\n';
}

/** Tab-separated, which spreadsheets split into columns on paste. */
export function resultsToTsv(outcomes: BatchOutcome[]): string {
  return resultRows(outcomes).map((r) => r.map((v) => String(v).replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n') + '\n';
}
