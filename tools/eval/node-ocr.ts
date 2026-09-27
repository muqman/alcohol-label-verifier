// Runs the same OCR code the browser uses, but under Node, so accuracy can be
// measured from the command line (npm run eval). ONNX Runtime *Web* is used
// on purpose: it is the exact WASM runtime the app ships.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as ort from 'onnxruntime-web';
import sharp from 'sharp';
import { createWorker, type Worker } from 'tesseract.js';
import type { OcrBackends } from '../../src/core/checkLabel';
import { resize } from '../../src/ocr/image';
import { runPaddleOcr, type PaddleModels } from '../../src/ocr/paddle/pipeline';
import { parseDictionary } from '../../src/ocr/paddle/recognize';
import { workingSize } from '../../src/ocr/prepare';
import { tesseractToPage } from '../../src/ocr/tesseract/convert';
import type { OcrWord, RgbaImage } from '../../src/ocr/types';

const root = path.resolve(import.meta.dirname, '../..');

/** Decode (respecting EXIF orientation) and scale to the working size. */
export async function loadImage(file: string): Promise<RgbaImage> {
  const { data, info } = await sharp(file).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const img = { width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
  const size = workingSize(img.width, img.height);
  return size.scale === 1 ? img : resize(img, size.width, size.height);
}

let models: PaddleModels | null = null;
export async function paddleModels(): Promise<PaddleModels> {
  if (models) return models;
  ort.env.wasm.numThreads = 1;
  const opts: ort.InferenceSession.SessionOptions = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
  const det = await ort.InferenceSession.create(await readFile(path.join(root, 'public/models/paddleocr/en_PP-OCRv3_det_infer.onnx')), opts);
  const rec = await ort.InferenceSession.create(await readFile(path.join(root, 'public/models/paddleocr/en_PP-OCRv4_rec.onnx')), opts);
  const dict = parseDictionary(await readFile(path.join(root, 'public/models/paddleocr/en_dict.txt'), 'utf8'));
  models = { det, rec, dict };
  return models;
}

export async function paddleOcr(img: RgbaImage, knownWords: OcrWord[] = []) {
  return runPaddleOcr(ort, await paddleModels(), img, { knownWords });
}

let worker: Promise<Worker> | null = null;
function tesseractWorker() {
  worker ??= createWorker('eng', 1, {
    langPath: path.join(root, 'node_modules/@tesseract.js-data/eng/4.0.0_best_int'),
    cacheMethod: 'none',
    gzip: true,
  }).then(async (w) => {
    await w.setParameters({ tessedit_pageseg_mode: '3' as never, user_defined_dpi: '300' });
    return w;
  });
  return worker;
}

export async function tesseractOcr(img: RgbaImage) {
  const t0 = performance.now();
  const png = await sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length), {
    raw: { width: img.width, height: img.height, channels: 4 },
  })
    .png({ compressionLevel: 1 })
    .toBuffer();
  const w = await tesseractWorker();
  const { data } = await w.recognize(png, {}, { blocks: true, text: false });
  return tesseractToPage(data as never, img.width, img.height, performance.now() - t0);
}

export const nodeBackends: OcrBackends = { tesseract: tesseractOcr, paddle: paddleOcr };

export async function shutdown() {
  if (worker) await (await worker).terminate();
}
