// Field-by-field comparison of label text against the application.
import { approxSearch } from './fuzzy';
import { countryVariants, isDomestic, stateVariants } from './places';
import { candidateLines, candidateLineText, evidenceFor, findAll, findBest, lineEvidence, unionBox, type Candidate } from './search';
import { buildStream, wordRanges, type Stream } from './stream';
import { fold, key, tidy } from './text';
import type { ApplicationData, Evidence, FieldResult, FieldStatus } from './types';
import { findAbv, findProof, findVolumes, formatNumber, parseExpectedAbv, parseExpectedVolume, sameVolume } from './units';

/** OCR text we trust enough to call a difference a real difference. */
const CONFIDENT = 0.85;

const quote = (s: string) => `“${tidy(s)}”`;

/** Grade a fuzzy text match. */
function gradeText(c: Candidate | null, expected?: string): FieldStatus {
  if (!c) return 'missing';
  const sim = c.hit.similarity;
  if (sim >= 0.999 || c.confusableOnly) return 'match';
  if (sim >= 0.9) return 'review';
  if (sim >= 0.7) return c.conf >= CONFIDENT ? 'mismatch' : 'review';
  // A looser match that shares a real word ("Straight Rye Whiskey" vs
  // "Straight Bourbon Whiskey") is the same kind of statement saying something
  // else: report what the label says rather than "not found".
  if (expected && sim >= 0.5 && c.conf >= CONFIDENT && sharesWord(expected, candidateLineText(c))) return 'mismatch';
  return 'missing';
}

const words = (s: string) => new Set(fold(s).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4));
const sharesWord = (a: string, b: string) => {
  const wb = words(b);
  return [...words(a)].some((w) => wb.has(w));
};

function textMessage(status: FieldStatus, expected: string, c: Candidate | null, what: string): string {
  switch (status) {
    case 'match':
      if (c && tidy(fold(c.text)) !== tidy(fold(expected))) {
        if (key(c.text) === key(expected)) return `Matches. The label writes it as ${quote(c.text)} — same wording, different capitalization or punctuation.`;
        if (c.confusableOnly) return `Matches. Read as ${quote(c.text)}; the only differences are characters the text reader often confuses, such as 0 and O.`;
        return `Matches. The label writes it as ${quote(c.text)}, an accepted spelling of the same wording.`;
      }
      return 'Matches the application.';
    case 'review':
      return `Close but not identical: the label appears to say ${quote(candidateLineText(c!))}. Please compare the spelling.`;
    case 'mismatch':
      return `Does not match. The label says ${quote(candidateLineText(c!))}.`;
    default:
      return `Could not find the ${what} on the label.`;
  }
}

// ---------------------------------------------------------------------------
// Brand name: must appear as prominent text, not just in the fine print.
// ---------------------------------------------------------------------------
function prominentStreams(streams: Stream[]): Stream[] {
  return streams.map((s) => {
    const heights = s.page.lines.map((l) => l.textHeight).sort((a, b) => b - a);
    // Prominent = at least 45% of the tallest text, and always the 3 tallest lines.
    const cutoff = Math.min(0.45 * (heights[0] ?? 0), heights[Math.min(2, heights.length - 1)] ?? 0);
    return buildStream(s.page, s.imageIndex, (l) => l.textHeight >= cutoff);
  });
}

export function checkBrand(app: ApplicationData, streams: Stream[]): FieldResult {
  const expected = app.brandName.trim();
  const base = { key: 'brandName' as const, expected };
  if (!key(expected)) return { ...base, status: 'skipped', found: null, message: 'No brand name in the application.', evidence: [] };

  const prominent = findBest(key(expected), prominentStreams(streams));
  let status = gradeText(prominent);
  if (status === 'match') {
    return { ...base, status, found: prominent!.text, message: textMessage(status, expected, prominent, 'brand name'), evidence: evidenceFor(prominent!) };
  }
  if (status === 'review') {
    // One or two letters off in the main brand text: most likely a misread.
    return { ...base, status, found: candidateLineText(prominent!), message: textMessage(status, expected, prominent, 'brand name'), evidence: evidenceFor(prominent!) };
  }
  const anywhere = findBest(key(expected), streams);
  if (anywhere && gradeText(anywhere) === 'match') {
    // The exact name is on the label, but only in small print (typically the
    // bottler statement). If the prominent brand text is a confidently read,
    // different name, that is a real mismatch; otherwise ask a person.
    const mainText = prominent && prominent.hit.similarity >= 0.5 ? candidateLineText(prominent) : null;
    const confidentOther = prominent && gradeText(prominent) === 'mismatch';
    return {
      ...base,
      status: confidentOther ? 'mismatch' : 'review',
      found: mainText ?? anywhere.text,
      message: confidentOther
        ? `Does not match. The brand on the label reads ${quote(mainText!)}; ${quote(expected)} appears only in small print (${quote(anywhere.text)}).`
        : `The brand name appears only in small print (${quote(anywhere.text)}), not as the main brand on the label.${mainText ? ` The main brand text reads ${quote(mainText)}.` : ''}`,
      evidence: evidenceFor(confidentOther ? prominent! : anywhere),
    };
  }
  const c = prominent && (!anywhere || prominent.hit.similarity >= anywhere.hit.similarity) ? prominent : anywhere;
  status = gradeText(c);
  return {
    ...base,
    status,
    found: status === 'missing' ? null : status === 'match' ? c!.text : candidateLineText(c!),
    message: textMessage(status, expected, c, 'brand name'),
    evidence: status === 'missing' ? [] : evidenceFor(c!),
  };
}

// ---------------------------------------------------------------------------
// Class / type designation
// ---------------------------------------------------------------------------
export function checkClassType(app: ApplicationData, streams: Stream[]): FieldResult {
  const expected = app.classType.trim();
  const base = { key: 'classType' as const, expected };
  if (!key(expected)) return { ...base, status: 'skipped', found: null, message: 'No class/type in the application.', evidence: [] };
  // "Whisky" and "Whiskey" are both accepted spellings, so try both.
  const k = key(expected);
  const patterns = [...new Set([k, k.replace(/whiskey/g, 'whisky'), k.replace(/whisky/g, 'whiskey')])];
  let c: Candidate | null = null;
  for (const p of patterns) {
    const hit = findBest(p, streams);
    if (hit && (!c || hit.hit.similarity > c.hit.similarity)) c = hit;
  }
  const status = gradeText(c, expected);
  return {
    ...base,
    status,
    found: status === 'missing' ? null : status === 'match' ? c!.text : candidateLineText(c!),
    message: textMessage(status, expected, c, 'class/type designation'),
    evidence: status === 'missing' ? [] : evidenceFor(c!),
  };
}

// ---------------------------------------------------------------------------
// Bottler / producer name and address
// ---------------------------------------------------------------------------
function tokenInLines(token: string, s: Stream, lines: number[]): number | null {
  const re = new RegExp(`(^|[^A-Za-z])${token.replace(/\./g, '\\.?')}(?![A-Za-z])`, 'i');
  for (const li of lines) if (re.test(fold(s.page.lines[li].text))) return li;
  return null;
}

/** A candidate covering one whole OCR line (used for short tokens). */
function wholeLine(s: Stream, li: number): Candidate {
  let start = -1, end = -1;
  for (let i = 0; i < s.key.length; i++) {
    if (s.line[i] === li) {
      if (start < 0) start = i;
      end = i + 1;
    }
  }
  return {
    stream: s,
    hit: { distance: 0, start: Math.max(0, start), end: Math.max(0, end), similarity: 1 },
    text: tidy(s.page.lines[li].text),
    conf: s.page.lines[li].conf,
    confusableOnly: false,
  };
}

export function checkBottler(app: ApplicationData, streams: Stream[]): FieldResult {
  const expected = tidy(app.bottler);
  const base = { key: 'bottler' as const, expected };
  const parts = expected.split(/[,;\n]/).map(tidy).filter(Boolean);
  if (!parts.length) return { ...base, status: 'skipped', found: null, message: 'No bottler / producer in the application.', evidence: [] };

  const [name, ...address] = parts;
  // The name may occur more than once (it is often also the brand); judge
  // each occurrence by whether the address follows it and keep the best.
  const occurrences = findAll(key(name), streams, 0.7);
  if (!occurrences.length) {
    return { ...base, status: 'missing', found: null, message: `Could not find ${quote(name)} on the label.`, evidence: [] };
  }
  const rank: Record<FieldStatus, number> = { match: 0, review: 1, mismatch: 2, missing: 3, skipped: 4 };
  let best: { c: Candidate; status: FieldStatus; missingParts: string[]; lines: number[] } | null = null;
  for (const c of occurrences) {
    const r = { c, status: gradeText(c), ...addressNear(c, address) };
    if (
      !best ||
      rank[r.status] < rank[best.status] ||
      (rank[r.status] === rank[best.status] && r.missingParts.length < best.missingParts.length) ||
      (rank[r.status] === rank[best.status] && r.missingParts.length === best.missingParts.length && c.hit.similarity > best.c.hit.similarity)
    ) {
      best = r;
    }
  }
  const { c, missingParts, lines } = best!;
  let status = best!.status;
  const s = c.stream;
  const foundText = tidy(lines.map((li) => s.page.lines[li].text).join(' '));
  const evidence: Evidence[] = lines.map((li) => lineEvidence(s, li));
  let message: string;
  if (status === 'match' && missingParts.length) {
    status = 'review';
    message = `Name matches, but ${missingParts.map(quote).join(' and ')} was not found next to it. Label reads ${quote(foundText)}.`;
  } else if (status === 'match') {
    message = 'Matches the application.';
  } else if (status === 'missing') {
    return { ...base, status, found: null, message: `Could not find ${quote(name)} on the label.`, evidence: [] };
  } else {
    message = status === 'review' ? `Close but not identical: the label reads ${quote(foundText)}. Please compare.` : `Does not match. The label reads ${quote(foundText)}.`;
  }
  return { ...base, status, found: foundText, message, evidence };
}

/** Look for the address parts on the name's line and the two lines after it. */
function addressNear(c: Candidate, address: string[]): { missingParts: string[]; lines: number[] } {
  const s = c.stream;
  const nameLines = candidateLines(c);
  const lastLine = nameLines[nameLines.length - 1];
  const window = [...new Set([...nameLines, lastLine + 1, lastLine + 2])].filter((i) => i < s.page.lines.length);
  const windowStream = buildStream(s.page, s.imageIndex, (_, i) => window.includes(i));
  const missingParts: string[] = [];
  const used = new Set(nameLines);
  for (const part of address) {
    const variants = stateVariants(part) ?? [part];
    let found = false;
    for (const v of variants) {
      if (key(v).length <= 3) {
        const li = tokenInLines(v, s, window);
        if (li !== null) { found = true; used.add(li); break; }
      } else {
        const hit = approxSearch(key(v), windowStream.key);
        if (hit && hit.similarity >= 0.85) {
          found = true;
          used.add(windowStream.line[hit.start]);
          break;
        }
      }
    }
    if (!found) missingParts.push(part);
  }
  return { missingParts, lines: [...used].sort((a, b) => a - b) };
}

// ---------------------------------------------------------------------------
// Country of origin (imports only)
// ---------------------------------------------------------------------------
export function checkCountry(app: ApplicationData, streams: Stream[]): FieldResult {
  const expected = app.countryOfOrigin.trim();
  const base = { key: 'countryOfOrigin' as const, expected };
  if (isDomestic(expected)) {
    return { ...base, status: 'skipped', found: null, message: 'Domestic product — no country of origin statement needed.', evidence: [] };
  }
  let best: Candidate | null = null;
  for (const v of countryVariants(expected)) {
    if (key(v).length <= 3) {
      // Short forms ("UK", "USA") must appear as a separate word.
      for (const s of streams) {
        const li = tokenInLines(v, s, s.page.lines.map((_, i) => i));
        if (li !== null) best = wholeLine(s, li);
      }
      continue;
    }
    const c = findBest(key(v), streams);
    if (c && (!best || c.hit.similarity > best.hit.similarity)) best = c;
  }
  const status = best ? (best.hit.similarity >= 0.999 || best.confusableOnly ? 'match' : best.hit.similarity >= 0.85 ? 'review' : 'missing') : 'missing';
  if (status === 'missing') {
    return { ...base, status, found: null, message: `No country of origin statement found (expected ${quote(expected)}). Imported products must show it.`, evidence: [] };
  }
  const lineText = tidy(candidateLines(best!).map((li) => best!.stream.page.lines[li].text).join(' '));
  return {
    ...base,
    status,
    found: lineText,
    message: status === 'match' ? 'Matches the application.' : `Possibly ${quote(expected)}: the label appears to say ${quote(best!.text)}.`,
    evidence: evidenceFor(best!),
  };
}

// ---------------------------------------------------------------------------
// Alcohol content
// ---------------------------------------------------------------------------
interface Found<T> {
  value: T;
  stream: Stream;
  line: number;
  conf: number;
}

/** Evidence box around just the words of a statement within a line. */
function statementEvidence(s: Stream, li: number, index: number, length: number): Evidence {
  const line = s.page.lines[li];
  const ranges = wordRanges(line.text);
  const boxes = ranges.length === line.words.length ? line.words.filter((_, wi) => ranges[wi][0] < index + length && ranges[wi][1] > index).map((w) => w.box) : [];
  return { imageIndex: s.imageIndex, engine: s.page.engine, box: boxes.length ? unionBox(boxes) : line.box };
}

/** The alcohol statement without other statements that share its line (e.g. "750 mL"). */
function abvText(line: string): string {
  let out = line;
  for (const v of findVolumes(line)) out = out.replace(v.text, ' ');
  return tidy(out.replace(/[~|]+/g, ' '));
}

export function checkAlcohol(app: ApplicationData, streams: Stream[]): FieldResult {
  const expectedText = app.alcoholContent.trim();
  const base = { key: 'alcoholContent' as const, expected: expectedText };
  if (!expectedText) {
    // Spirits must state alcohol content, so a blank value is worth a look, unless
    // no application details were entered at all (a warning-only check).
    const anyDetails = [app.brandName, app.classType, app.netContents, app.bottler, app.countryOfOrigin].some((v) => v.trim());
    const flag = app.beverageType === 'spirits' && anyDetails;
    const note = app.beverageType === 'spirits' ? 'Distilled spirits must state alcohol content.' : 'Optional for this beverage type.';
    return { ...base, status: flag ? 'review' : 'skipped', found: null, message: `No alcohol content in the application. ${note}`, evidence: [] };
  }
  const expected = parseExpectedAbv(expectedText);
  if (expected.abv === null) {
    return { ...base, status: 'review', found: null, message: `Could not understand the application value ${quote(expectedText)}.`, evidence: [] };
  }

  const statements: Found<ReturnType<typeof findAbv>[number]>[] = [];
  const proofs: Found<number>[] = [];
  for (const s of streams) {
    s.page.lines.forEach((l, li) => {
      const context = [s.page.lines[li - 1]?.text ?? '', l.text, s.page.lines[li + 1]?.text ?? ''].join(' ');
      for (const st of findAbv(l.text)) {
        statements.push({ value: { ...st, hasKeyword: st.hasKeyword || /\balc|alcohol|\bvol\b|vol\.|\babv\b/i.test(context) }, stream: s, line: li, conf: l.conf });
      }
      for (const p of findProof(l.text)) proofs.push({ value: p, stream: s, line: li, conf: l.conf });
    });
  }
  const strong = statements.filter((f) => f.value.hasKeyword);
  const pool = strong.length ? strong : statements;
  const want = expected.abv;
  const hit = pool.find((f) => Math.abs(f.value.abv - want) < 0.001);
  const labelLine = (f: Found<unknown>) => tidy(f.stream.page.lines[f.line].text);

  if (hit) {
    const found = hit.value.text || abvText(labelLine(hit));
    const evidence = [statementEvidence(hit.stream, hit.line, hit.value.index, hit.value.length)];
    const notes: string[] = [];
    let status: FieldStatus = 'match';
    const labelProofs = [...new Set(proofs.map((p) => p.value))];
    if (labelProofs.length && !labelProofs.some((p) => Math.abs(p - 2 * want) < 0.51)) {
      status = 'review';
      notes.push(`the proof on the label (${labelProofs.join(', ')}) should be ${formatNumber(2 * want)} for ${formatNumber(want)}% alcohol`);
    }
    if (expected.proof !== null && labelProofs.length && !labelProofs.some((p) => Math.abs(p - expected.proof!) < 0.51)) {
      status = 'review';
      notes.push(`the application says ${formatNumber(expected.proof)} proof`);
    }
    if (!hit.value.hasKeyword) {
      status = 'review';
      notes.push('the percentage is not described as alcohol by volume (e.g. “Alc./Vol.”)');
    }
    return {
      ...base,
      status,
      found,
      message: status === 'match' ? 'Matches the application.' : `The number matches (${formatNumber(want)}%), but ${notes.join('; ')}.`,
      evidence,
    };
  }
  if (pool.length) {
    const f = pool.reduce((a, b) => (b.conf > a.conf ? b : a));
    const status: FieldStatus = f.conf >= 0.7 ? 'mismatch' : 'review';
    return {
      ...base,
      status,
      found: f.value.text || abvText(labelLine(f)),
      message: `${status === 'mismatch' ? 'Does not match' : 'Possibly different'}: the label says ${formatNumber(f.value.abv)}%, the application says ${formatNumber(want)}%.`,
      evidence: [statementEvidence(f.stream, f.line, f.value.index, f.value.length)],
    };
  }
  return { ...base, status: 'missing', found: null, message: 'No alcohol content statement found on the label.', evidence: [] };
}

// ---------------------------------------------------------------------------
// Net contents
// ---------------------------------------------------------------------------
export function checkNetContents(app: ApplicationData, streams: Stream[]): FieldResult {
  const expectedText = app.netContents.trim();
  const base = { key: 'netContents' as const, expected: expectedText };
  if (!expectedText) return { ...base, status: 'skipped', found: null, message: 'No net contents in the application.', evidence: [] };
  const expected = parseExpectedVolume(expectedText);
  if (!expected) return { ...base, status: 'review', found: null, message: `Could not understand the application value ${quote(expectedText)}.`, evidence: [] };

  const found: Found<ReturnType<typeof findVolumes>[number]>[] = [];
  for (const s of streams) {
    s.page.lines.forEach((l, li) => {
      for (const v of findVolumes(l.text)) found.push({ value: v, stream: s, line: li, conf: l.conf });
    });
  }
  const hits = found.filter((f) => sameVolume(f.value.ml, expected.ml));
  if (hits.length) {
    const hit = hits.reduce((a, b) => (b.conf > a.conf ? b : a));
    const text = hit.value.text;
    const anyUs = found.some((f) => f.value.us);
    const anyMetric = found.some((f) => !f.value.us);
    if (app.beverageType === 'beer' && !anyUs) {
      return { ...base, status: 'review', found: text, message: `Amount matches (${quote(text)}), but malt beverages must state net contents in U.S. units (e.g. “12 FL OZ”).`, evidence: [statementEvidence(hit.stream, hit.line, hit.value.index, hit.value.length)] };
    }
    if (app.beverageType !== 'beer' && !anyMetric) {
      return { ...base, status: 'review', found: text, message: `Amount matches (${quote(text)}), but wine and spirits must state net contents in metric units (mL or L).`, evidence: [statementEvidence(hit.stream, hit.line, hit.value.index, hit.value.length)] };
    }
    return { ...base, status: 'match', found: text, message: 'Matches the application.', evidence: [statementEvidence(hit.stream, hit.line, hit.value.index, hit.value.length)] };
  }
  if (found.length) {
    const f = found.reduce((a, b) => (b.conf > a.conf ? b : a));
    const status: FieldStatus = f.conf >= 0.7 ? 'mismatch' : 'review';
    return {
      ...base,
      status,
      found: f.value.text,
      message: `${status === 'mismatch' ? 'Does not match' : 'Possibly different'}: the label says ${quote(f.value.text)}, the application says ${quote(expectedText)}.`,
      evidence: [statementEvidence(f.stream, f.line, f.value.index, f.value.length)],
    };
  }
  return { ...base, status: 'missing', found: null, message: 'No net contents statement found on the label.', evidence: [] };
}
