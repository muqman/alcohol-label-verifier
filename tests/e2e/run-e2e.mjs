// End-to-end check of the built app in a real browser (Chromium via Playwright).
//
//   npm run build && npm run test:e2e
//   npm run test:e2e -- --screenshots   # also save screenshots to test-results/
//
// For every built-in example it picks the example in the UI, presses
// "Check label", and compares the verdict and field statuses with the answer
// key. Then it runs the sample batch. Exits non-zero on any wrong result.
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dist = path.join(root, 'dist');
const shots = process.argv.includes('--screenshots');
const outDir = path.join(root, 'test-results');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.csv': 'text/csv', '.txt': 'text/plain' };

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const body = await readFile(path.join(dist, p));
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/`;
if (shots) await mkdir(outDir, { recursive: true });

const cases = JSON.parse(await readFile(path.join(dist, 'samples/cases.json'), 'utf8'));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
// Optionally pretend to have more cores (exercises the parallel code paths).
const cores = Number(process.argv.find((a) => a.startsWith('--cores='))?.split('=')[1] ?? 0);
if (cores) await page.addInitScript((n) => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => n }), cores);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
// Tesseract prints informational notes such as "Detected 6 diacritics" to stderr.
page.on('console', (m) => m.type() === 'error' && !/diacritics/.test(m.text()) && errors.push(m.text()));
page.on('requestfailed', (r) => errors.push(`request failed: ${r.url().slice(0, 80)} (${r.failure()?.errorText})`));

const t0 = Date.now();
await page.goto(base);
await page.getByText('Ready · runs on this computer').waitFor({ timeout: 60000 });
console.log(`App ready in ${Date.now() - t0} ms`);

const STATUS = { Matches: 'match', 'Please check': 'review', 'Doesn’t match': 'mismatch', 'Not found': 'missing', 'Not checked': 'skipped' };
const KEYS = ['brandName', 'classType', 'alcoholContent', 'netContents', 'bottler', 'countryOfOrigin', 'warning'];
let failures = 0;
const times = [];

for (const c of cases) {
  await page.selectOption('#example-picker', c.id);
  await page.locator('.thumb img').first().waitFor();
  await page.waitForFunction((n) => document.querySelectorAll('.thumb img').length === n && [...document.querySelectorAll('.thumb img')].every((i) => i.complete), c.images.length);
  const start = Date.now();
  await page.getByRole('button', { name: 'Check label' }).click();
  await page.locator('#verdict-heading').waitFor({ timeout: 120000 });
  const ms = Date.now() - start;
  times.push(ms);
  const verdictText = await page.locator('#verdict-heading').innerText();
  const verdict = { 'All checks passed': 'pass', 'Needs review': 'review', 'Problems found': 'fail' }[verdictText.trim()];
  const chips = await page.locator('.field-row .chip').allInnerTexts();
  const fields = Object.fromEntries(KEYS.map((k, i) => [k, STATUS[chips[i]?.trim()] ?? chips[i]]));
  const okVerdict = verdict === c.expected.overall || c.accept.includes(verdict);
  const bad = Object.entries(c.expected.fields).filter(([k, want]) => fields[k] !== want && !(want === 'match' && fields[k] === 'review' && c.accept.includes('review')));
  const pass = okVerdict && bad.length === 0;
  if (!pass) failures++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${c.id.padEnd(32)} ${verdict.padEnd(6)} ${(ms / 1000).toFixed(1)}s${bad.length ? '  ' + bad.map(([k, w]) => `${k}: want ${w} got ${fields[k]}`).join('; ') : ''}`);
  if (shots && ['old-tom-bourbon', 'stones-throw-titlecase-warning', 'hoppy-trails-altered-warning', 'old-tom-bottle-photo', 'belle-rive-wine'].includes(c.id)) {
    await page.screenshot({ path: path.join(outDir, `single-${c.id}.png`), fullPage: true });
  }
  await page.getByRole('button', { name: 'Change details' }).click();
}

// Batch -------------------------------------------------------------------------
await page.getByRole('tab', { name: 'Check a batch' }).click();
await page.getByRole('button', { name: /Load the sample batch/ }).click();
await page.getByRole('button', { name: /^Check 20 applications$/ }).waitFor({ timeout: 30000 });
const b0 = Date.now();
await page.getByRole('button', { name: /^Check 20 applications$/ }).click();
await page.getByRole('heading', { name: /^Checked 20 applications$/ }).waitFor({ timeout: 600000 });
const batchSeconds = (Date.now() - b0) / 1000;
const counts = await page.locator('.summary-chips .filter').allInnerTexts();
console.log(`Batch of 20 finished in ${batchSeconds.toFixed(1)} s — ${counts.map((t) => t.replace(/\s+/g, ' ')).join(' | ')}`);
if (shots) {
  await page.screenshot({ path: path.join(outDir, 'batch-results.png'), fullPage: true });
  await page.locator('table.results tbody tr').nth(6).click();
  await page.locator('#verdict-heading').waitFor();
  await page.screenshot({ path: path.join(outDir, 'batch-detail.png'), fullPage: true });
  // Phone-sized and dark-mode views of the first screen.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark' });
  await phone.goto(base);
  await phone.locator('.thumb img').first().waitFor();
  await phone.screenshot({ path: path.join(outDir, 'phone-dark.png'), fullPage: true });
}

await browser.close();
server.close();
const avg = times.reduce((a, b) => a + b, 0) / times.length;
const sorted = [...times].sort((a, b) => a - b);
console.log(`\n${cases.length - failures}/${cases.length} examples correct in the browser. Per label: median ${(sorted[sorted.length >> 1] / 1000).toFixed(1)} s, mean ${(avg / 1000).toFixed(1)} s, max ${(sorted[sorted.length - 1] / 1000).toFixed(1)} s.`);
if (errors.length) console.log(`Browser errors:\n  ${errors.slice(0, 10).join('\n  ')}`);
process.exit(failures || errors.length ? 1 : 0);
