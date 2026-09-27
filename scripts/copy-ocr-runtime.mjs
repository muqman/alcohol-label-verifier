// Copies the OCR runtimes out of node_modules into public/ocr-runtime so the
// app serves them itself. Nothing is fetched from a CDN at run time, which
// matters on locked-down government networks (see README, "Why local OCR").
import { cp, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nm = (...p) => path.join(root, 'node_modules', ...p);
const out = (...p) => path.join(root, 'public', 'ocr-runtime', ...p);

const files = [
  // ONNX Runtime Web (runs the PaddleOCR models) - single-threaded SIMD build.
  [nm('onnxruntime-web/dist/ort-wasm-simd-threaded.mjs'), out('ort/ort-wasm-simd-threaded.mjs')],
  [nm('onnxruntime-web/dist/ort-wasm-simd-threaded.wasm'), out('ort/ort-wasm-simd-threaded.wasm')],
  // Tesseract.js worker, WASM cores (the browser picks one) and English LSTM model.
  [nm('tesseract.js/dist/worker.min.js'), out('tesseract/worker.min.js')],
  [nm('tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js'), out('tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js')],
  [nm('tesseract.js-core/tesseract-core-simd-lstm.wasm.js'), out('tesseract/core/tesseract-core-simd-lstm.wasm.js')],
  [nm('tesseract.js-core/tesseract-core-lstm.wasm.js'), out('tesseract/core/tesseract-core-lstm.wasm.js')],
  [nm('@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'), out('tesseract/lang/eng.traineddata.gz')],
];

for (const [from, to] of files) {
  await access(from);
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to);
}
console.log(`OCR runtime: copied ${files.length} files to public/ocr-runtime/`);
