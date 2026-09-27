// Accuracy check against the answer key in public/samples/cases.json.
//
//   npm run eval                 # all cases
//   npm run eval -- old-tom      # cases whose id contains "old-tom"
//   npm run eval -- --verbose    # also print what was read
//
// A case FAILS if the overall verdict is not the expected one (or one of the
// accepted alternatives), or if an asserted field has the wrong status.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { checkLabel } from '../../src/core/checkLabel';
import type { ApplicationData, FieldKey, FieldStatus, Verdict } from '../../src/domain/types';
import { loadImage, nodeBackends, shutdown } from './node-ocr';

interface Case {
  id: string;
  title: string;
  images: string[];
  application: ApplicationData;
  expected: { overall: Verdict; fields: Partial<Record<FieldKey, FieldStatus>> };
  accept: Verdict[];
}

const root = path.resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const filter = args.filter((a) => !a.startsWith('--'));

const cases: Case[] = JSON.parse(await readFile(path.join(root, 'public/samples/cases.json'), 'utf8'));
const selected = cases.filter((c) => !filter.length || filter.some((f) => c.id.includes(f)));

const icon: Record<string, string> = { match: '✓', review: '?', mismatch: '✗', missing: '∅', skipped: '-' };
let failures = 0;
const times: number[] = [];

for (const c of selected) {
  const images = await Promise.all(c.images.map((f) => loadImage(path.join(root, 'public/samples', f))));
  const { result, secondLook, ms, readings } = await checkLabel(c.application, images, nodeBackends);
  times.push(ms);
  const okVerdict = result.verdict === c.expected.overall || c.accept.includes(result.verdict);
  const fieldProblems = Object.entries(c.expected.fields)
    .filter(([k, want]) => {
      const got = result.fields.find((f) => f.key === k)!.status;
      // A field expected to match may come back "review" on degraded photos
      // when the case accepts a review verdict.
      return got !== want && !(want === 'match' && got === 'review' && c.accept.includes('review'));
    })
    .map(([k, want]) => `${k}: want ${want}, got ${result.fields.find((f) => f.key === k)!.status}`);
  const pass = okVerdict && fieldProblems.length === 0;
  if (!pass) failures++;
  const statuses = result.fields.map((f) => icon[f.status]).join(' ');
  console.log(
    `${pass ? 'PASS' : 'FAIL'}  ${c.id.padEnd(32)} verdict=${result.verdict.padEnd(6)} (want ${c.expected.overall}${c.accept.length ? '/' + c.accept.join('/') : ''})  [${statuses}]  ${(ms / 1000).toFixed(1)}s${secondLook ? ' +2nd look' : ''}`,
  );
  if (!pass || verbose) {
    for (const f of result.fields) {
      if (f.status !== 'match' && f.status !== 'skipped') console.log(`        ${f.key}: ${f.status} — ${f.message}`);
    }
    if (fieldProblems.length) console.log(`        >> ${fieldProblems.join('; ')}`);
  }
  if (verbose) {
    for (const r of readings) for (const p of r.pages) {
      console.log(`        --- ${p.engine} (${Math.round(p.ms)} ms)`);
      for (const l of p.lines) console.log(`        ${l.conf.toFixed(2)} ${l.text}`);
    }
  }
}
await shutdown();
const avg = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length);
console.log(`\n${selected.length - failures}/${selected.length} cases correct. Average ${(avg / 1000).toFixed(1)} s per application (Node, single thread).`);
process.exit(failures ? 1 : 0);
