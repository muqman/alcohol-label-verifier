// Government health warning check (27 CFR 16.21 / 16.22):
//   1. the statement is present,
//   2. its wording is exactly the official text (word for word),
//   3. "GOVERNMENT WARNING" is in capital letters,
//   4. "GOVERNMENT WARNING" is bold (measured from stroke thickness).
// The check distinguishes "the label says something different" (confidently
// read text that differs) from "we could not read it well" (needs a person).
import { alignPrefix, approxSearch, type SearchHit } from './fuzzy';
import { evidenceFor, spanWords, type Candidate } from './search';
import { spanConfidence, spanText, type Stream } from './stream';
import { confusable, key, tidy } from './text';
import type { Evidence, FieldResult, FieldStatus, WarningDetails, WarningWord } from './types';
import { WARNING_BODY, WARNING_HEADER } from './warningText';

const HEADER_KEY = key(WARNING_HEADER);

const BODY_WORDS = WARNING_BODY.split(/\s+/).map((text) => ({ text, key: key(text) }));
const BODY_KEY = BODY_WORDS.map((w) => w.key).join('');
const WORD_START: number[] = [];
{
  let p = 0;
  for (const w of BODY_WORDS) {
    WORD_START.push(p);
    p += w.key.length;
  }
}

/** Letters whose capital and small forms look alike, so OCR case is unreliable. */
const AMBIGUOUS_CASE = new Set('cklosuvwxz');

const BOLD_YES = 1.2;
const BOLD_NO = 1.08;
const CONFIDENT = 0.75;

interface Assessment {
  stream: Stream;
  header: SearchHit | null;
  headerText: string | null;
  headerLower: number;
  bodyStart: number;
  bodyEnd: number;
  words: WarningWord[];
  extraText: string[];
  conf: number;
  score: number;
}

const worst = (a: FieldStatus, b: FieldStatus): FieldStatus => {
  const rank: Record<FieldStatus, number> = { skipped: 0, match: 1, review: 2, mismatch: 3, missing: 4 };
  return rank[b] > rank[a] ? b : a;
};

function assess(s: Stream): Assessment | null {
  let header: SearchHit | null = approxSearch(HEADER_KEY, s.key);
  if (header && header.similarity < 0.7) header = null;
  let start: number;
  if (header) start = header.end;
  else {
    const body = approxSearch(BODY_KEY, s.key);
    if (!body || body.similarity < 0.5) return null;
    start = body.start;
  }
  const region = s.key.slice(start, Math.min(s.key.length, start + Math.ceil(BODY_KEY.length * 1.25) + 10));
  const { ops, textEnd } = alignPrefix(BODY_KEY, region);

  // Per official character: aligned text position (or -1 if missing) and cost.
  const textPos = new Int32Array(BODY_KEY.length).fill(-1);
  const cost = new Float64Array(BODY_KEY.length);
  const insertedBefore: number[][] = Array.from({ length: BODY_KEY.length + 1 }, () => []);
  let nextP = 0;
  for (const op of ops) {
    if (op.op === 'match') { textPos[op.p] = op.t; nextP = op.p + 1; }
    else if (op.op === 'sub') { textPos[op.p] = op.t; cost[op.p] = confusable(BODY_KEY[op.p], region[op.t]) ? 0.5 : 1; nextP = op.p + 1; }
    else if (op.op === 'del') { cost[op.p] = 1; nextP = op.p + 1; }
    else insertedBefore[nextP].push(op.t);
  }

  const lineAt = (t: number) => s.line[start + t];
  const words: WarningWord[] = [];
  const extraText: string[] = [];
  BODY_WORDS.forEach((w, wi) => {
    const ws = WORD_START[wi];
    const we = ws + w.key.length;
    // Text inserted between the previous word and this one = added words.
    const between = insertedBefore[ws];
    if (wi > 0 && between.length >= 2) {
      extraText.push(spanText(s, start + Math.min(...between), start + Math.max(...between) + 1));
    }
    let errors = 0;
    const positions: number[] = [];
    for (let p = ws; p < we; p++) {
      errors += cost[p];
      if (textPos[p] >= 0) positions.push(textPos[p]);
      if (p > ws) {
        errors += insertedBefore[p].length;
        positions.push(...insertedBefore[p]);
      }
    }
    const read = positions.length ? spanText(s, start + Math.min(...positions), start + Math.max(...positions) + 1) : undefined;
    if (errors === 0) {
      words.push({ text: w.text, state: 'ok' });
    } else if (!positions.length) {
      // Whole word absent. Omitted mid-line => the label really lacks it;
      // absent across a line break or at the end => maybe a line we could not read.
      let before = -1, after = -1;
      for (let p = ws - 1; p >= 0 && before < 0; p--) if (textPos[p] >= 0) before = textPos[p];
      for (let p = we; p < BODY_KEY.length && after < 0; p++) if (textPos[p] >= 0) after = textPos[p];
      // With nothing read before the gap, the heading is the left neighbour.
      const beforeLine = before >= 0 ? lineAt(before) : header && start > 0 ? s.line[start - 1] : -1;
      const sameLine = beforeLine >= 0 && after >= 0 && beforeLine === lineAt(after);
      words.push({ text: w.text, state: sameLine ? 'missing' : 'unread' });
    } else if (errors <= Math.max(1.5, w.key.length / 2)) {
      // Up to half the letters off is what misreading looks like
      // ("alcohoic", "abxdity"); a person should glance at it.
      words.push({ text: w.text, state: 'unclear', read });
    } else {
      words.push({ text: w.text, state: 'changed', read });
    }
  });
  // Words appended after the last official word are not part of the statement
  // (e.g. "CONTAINS SULFITES" often follows it), so trailing insertions are ignored.

  const headerText = header ? spanText(s, header.start, header.end) : null;
  const headerLower = headerText ? [...headerText].filter((ch) => /[a-z]/.test(ch) && !AMBIGUOUS_CASE.has(ch)).length : 0;
  const bad = words.filter((w) => w.state === 'changed' || w.state === 'missing').length + extraText.length;
  const unread = words.filter((w) => w.state === 'unread').length;
  const unclear = words.filter((w) => w.state === 'unclear').length;
  return {
    stream: s,
    header,
    headerText,
    headerLower,
    bodyStart: start,
    bodyEnd: start + textEnd,
    words,
    extraText,
    conf: spanConfidence(s, header ? header.start : start, start + Math.max(1, textEnd)),
    score: (header ? 1000 : 0) - bad * 10 - unread * 5 - unclear * 2,
  };
}

function boldness(a: Assessment): { bold: WarningDetails['bold']; ratio: number | null } {
  if (!a.header) return { bold: 'unknown', ratio: null };
  const s = a.stream;
  const metric = (x: { word: { stroke?: { width: number } }; line: { textHeight: number } }) =>
    x.word.stroke ? x.word.stroke.width / Math.max(1, x.line.textHeight) : null;
  const head = spanWords(s, a.header.start, a.header.end);
  const headSet = new Set(head.map((h) => h.word));
  const body = spanWords(s, a.header.end, Math.min(a.bodyEnd, a.header.end + 80)).filter(
    (b) => !headSet.has(b.word) && key(b.word.text).length >= 3,
  );
  // Prefer body words on the same line as the heading (same font size).
  const headLine = head[head.length - 1]?.line;
  const sameLine = body.filter((b) => b.line === headLine);
  const bodyWords = (sameLine.length >= 2 ? sameLine : body).slice(0, 8);
  const hv = head.map(metric).filter((v): v is number => v !== null);
  const bv = bodyWords.map(metric).filter((v): v is number => v !== null);
  if (!hv.length || !bv.length) return { bold: 'unknown', ratio: null };
  const med = (v: number[]) => [...v].sort((x, y) => x - y)[v.length >> 1];
  const ratio = med(hv) / Math.max(1e-6, med(bv));
  return { bold: ratio >= BOLD_YES ? 'yes' : ratio <= BOLD_NO ? 'no' : 'unsure', ratio };
}

export function checkWarning(streams: Stream[]): FieldResult {
  const base = { key: 'warning' as const, expected: `${WARNING_HEADER} ${WARNING_BODY}` };
  const all = streams.map(assess).filter((a): a is Assessment => a !== null);
  if (!all.length) {
    return { ...base, status: 'missing', found: null, message: 'No government health warning statement found on the label.', evidence: [] };
  }
  const best = all.reduce((a, b) => (b.score > a.score || (b.score === a.score && b.conf > a.conf) ? b : a));
  const s = best.stream;
  const issues: string[] = [];
  let status: FieldStatus = 'match';

  // Heading present and in capitals. A confident reading in lower case from
  // any engine counts, since OCR does not invent lower-case letters.
  const lowerReading = all.find((a) => a.header && a.header.similarity >= 0.85 && a.headerLower >= 2);
  if (!best.header) {
    status = worst(status, 'review');
    issues.push('Could not find the heading “GOVERNMENT WARNING:” before the statement.');
  } else if (lowerReading) {
    status = worst(status, 'mismatch');
    issues.push(`The heading must be in capital letters (“GOVERNMENT WARNING:”); the label reads “${tidy(lowerReading.headerText!)}”.`);
  } else if (best.headerLower === 1) {
    status = worst(status, 'review');
    issues.push(`The heading may not be all capitals: read as “${tidy(best.headerText!)}”.`);
  }

  // Wording.
  const changed = best.words.filter((w) => w.state === 'changed').length;
  const missing = best.words.filter((w) => w.state === 'missing').length;
  const unread = best.words.filter((w) => w.state === 'unread').length;
  const unclear = best.words.filter((w) => w.state === 'unclear').length;
  // Lots of garbled words or low confidence means the image, not the label,
  // is the problem: never call that a wording mismatch.
  const poorRead = unclear >= 4 || best.conf < CONFIDENT;
  if ((changed || missing || best.extraText.length) && !poorRead) {
    const parts = [
      changed && `${changed} word${changed > 1 ? 's' : ''} changed`,
      missing && `${missing} word${missing > 1 ? 's' : ''} left out`,
      best.extraText.length && `extra wording added (${best.extraText.map((t) => `“${t}”`).join(', ')})`,
    ].filter(Boolean);
    status = worst(status, 'mismatch');
    issues.push(`The wording differs from the required statement: ${parts.join(', ')}.`);
  } else if (poorRead && (changed || missing || unclear || best.extraText.length)) {
    status = worst(status, 'review');
    issues.push('The statement could not be read reliably (small or unclear print). Please compare it with the label — differences are highlighted.');
  }
  if (unread) {
    status = worst(status, 'review');
    issues.push(`Part of the statement (${unread} word${unread > 1 ? 's' : ''}) could not be read — check the image.`);
  }
  if (unclear && !poorRead) {
    status = worst(status, 'review');
    issues.push(`${unclear} word${unclear > 1 ? 's were' : ' was'} not read clearly — please compare with the label.`);
  }

  // Bold heading.
  const { bold, ratio } = boldness(best);
  if (best.header && bold !== 'yes') {
    status = worst(status, 'review');
    issues.push(
      bold === 'no'
        ? '“GOVERNMENT WARNING:” does not appear to be in bold type (automatic check — please confirm).'
        : 'Could not confirm that “GOVERNMENT WARNING:” is in bold type — please check.',
    );
  }

  const headerStart = best.header ? best.header.start : best.bodyStart;
  const candidate: Candidate = {
    stream: s,
    hit: { distance: 0, start: headerStart, end: Math.max(best.bodyEnd, headerStart + 1), similarity: 1 },
    text: spanText(s, headerStart, best.bodyEnd),
    conf: best.conf,
    confusableOnly: false,
  };
  const evidence: Evidence[] = evidenceFor(candidate);
  const details: WarningDetails = {
    headerFound: !!best.header,
    headerText: best.headerText ? tidy(best.headerText) : null,
    headerAllCaps: best.header ? !lowerReading && best.headerLower === 0 : null,
    bold,
    boldRatio: ratio,
    words: best.words,
    extraText: best.extraText,
    readText: tidy(candidate.text),
  };
  const message =
    status === 'match'
      ? 'Present and word-for-word correct. “GOVERNMENT WARNING:” is in capital letters and appears bold.'
      : issues.join(' ');
  return { ...base, status, found: details.readText, message, evidence, warning: details };
}
