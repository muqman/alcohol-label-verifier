// Debug helper: print what PaddleOCR reads from sample images.
//   npx tsx tools/eval/paddle-dump.ts public/samples/old-tom-bourbon.jpg ...
import { loadImage, paddleOcr } from './node-ocr';

for (const file of process.argv.slice(2)) {
  const img = await loadImage(file);
  const page = await paddleOcr(img);
  console.log(`\n=== ${file}  (${img.width}x${img.height}, ${Math.round(page.ms)} ms, rotation ${page.rotation})`);
  for (const l of page.lines) {
    console.log(`${l.conf.toFixed(2)} h=${l.textHeight.toFixed(0).padStart(3)} | ${l.text}`);
  }
}
