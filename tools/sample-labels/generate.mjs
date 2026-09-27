// Renders the sample/test labels defined in specs.mjs.
//
//   npm run samples                 # the examples shipped with the app
//   npm run samples -- --holdout    # held-out evaluation set (test-data/holdout)
//
// Output (committed to the repo so nobody needs to run this):
//   public/samples/*.jpg            label images
//   public/samples/cases.json       application data + expected results (answer key)
//   public/samples/sample-batch.csv batch manifest for the "Batch" tab
import { chromium } from 'playwright';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { CASES } from './specs.mjs';
import { HOLDOUT } from './holdout.mjs';
import { renderLabelDocument } from './templates.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const holdout = process.argv.includes('--holdout');
const outDir = path.resolve(here, holdout ? '../../test-data/holdout' : '../../public/samples');
const SPECS = holdout ? HOLDOUT : CASES;
const renderDir = path.resolve(here, '.render');

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main() {
  await rm(renderDir, { recursive: true, force: true });
  await mkdir(renderDir, { recursive: true });
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const photoPage = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: 2400, height: 2400 } });
  await photoPage.goto(pathToFileURL(path.join(here, 'photo.html')).href);

  const answerKey = [];
  for (const c of SPECS) {
    const images = c.images ?? [{ suffix: null, template: c.template, label: c.label, size: c.size }];
    const files = [];
    for (const img of images) {
      const name = img.suffix ? `${c.id}-${img.suffix}` : c.id;
      const htmlPath = path.join(renderDir, `${name}.html`);
      await writeFile(htmlPath, renderLabelDocument(img.template ?? c.template, img.label, img.size));
      await page.setViewportSize({ width: img.size[0] + 40, height: img.size[1] + 40 });
      await page.goto(pathToFileURL(htmlPath).href);
      await page.evaluate(() => document.fonts.ready);
      const flat = await page.locator('#label').screenshot({ type: 'png' });
      let src = `data:image/png;base64,${flat.toString('base64')}`;

      const o = c.photo ?? {};
      if (c.photo) {
        await photoPage.evaluate(({ src, o }) => window.makePhoto({ src, o }), { src, o });
        const shot = await photoPage.locator('#scene').screenshot({ type: 'png' });
        src = `data:image/png;base64,${shot.toString('base64')}`;
      }
      const dataUrl = await photoPage.evaluate(({ src, o }) => window.finalize({ src, o }), { src, o });
      const file = `${name}.jpg`;
      await writeFile(path.join(outDir, file), Buffer.from(dataUrl.split(',')[1], 'base64'));
      files.push(file);
      console.log('rendered', file);
    }
    answerKey.push({
      id: c.id,
      title: c.title,
      note: c.note,
      featured: !!c.featured,
      images: files,
      application: c.application,
      expected: c.expected,
      accept: c.accept ?? [],
    });
  }
  await browser.close();

  await writeFile(path.join(outDir, 'cases.json'), JSON.stringify(answerKey, null, 2) + '\n');
  if (holdout) {
    await rm(renderDir, { recursive: true, force: true });
    console.log(`\n${answerKey.length} held-out cases written to ${path.relative(process.cwd(), outDir)}`);
    return;
  }

  const header = ['application_id', 'image_files', 'beverage_type', 'brand_name', 'class_type', 'alcohol_content', 'net_contents', 'bottler_name_address', 'country_of_origin'];
  const rows = answerKey.map((c, i) => [
    `SAMPLE-${String(i + 1).padStart(3, '0')}`,
    c.images.join(';'),
    c.application.beverageType,
    c.application.brandName,
    c.application.classType,
    c.application.alcoholContent,
    c.application.netContents,
    c.application.bottler,
    c.application.countryOfOrigin,
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
  await writeFile(path.join(outDir, 'sample-batch.csv'), csv);
  await rm(renderDir, { recursive: true, force: true });
  console.log(`\n${answerKey.length} cases written to ${path.relative(process.cwd(), outDir)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
