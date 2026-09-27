/// <reference lib="webworker" />
// Web Worker hosting the PaddleOCR models on ONNX Runtime Web (WASM), so
// recognition never blocks the page.
import * as ort from 'onnxruntime-web/wasm';
import { detectPhase, recognizePhase, type Detection, type PaddleModels } from '../paddle/pipeline';
import { parseDictionary } from '../paddle/recognize';
import type { Box, OcrWord } from '../types';

export type PaddleRequest =
  | { type: 'init'; modelBase: string }
  /** Start text detection for an image (can begin before hints are known). */
  | { type: 'detect'; id: number; width: number; height: number; buffer: ArrayBuffer }
  /** Finish a detected image: recognise the lines that still need it. */
  | { type: 'recognize'; id: number; knownWords: OcrWord[]; trustedRegions: Box[] }
  | { type: 'discard'; id: number };

export type PaddleResponse =
  | { type: 'ready' }
  | { type: 'result'; id: number; page: import('../types').OcrPage }
  | { type: 'error'; id?: number; message: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;
let models: PaddleModels | null = null;
const detections = new Map<number, Promise<Detection>>();

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

async function init(modelBase: string) {
  ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
  const opts: ort.InferenceSession.SessionOptions = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
  const [det, rec, dictText] = await Promise.all([
    fetchBytes(`${modelBase}en_PP-OCRv3_det_infer.onnx`),
    fetchBytes(`${modelBase}en_PP-OCRv4_rec.onnx`),
    fetch(`${modelBase}en_dict.txt`).then((r) => r.text()),
  ]);
  models = {
    det: await ort.InferenceSession.create(det, opts),
    rec: await ort.InferenceSession.create(rec, opts),
    dict: parseDictionary(dictText),
  };
}

scope.onmessage = async (e: MessageEvent<PaddleRequest>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    try {
      await init(msg.modelBase);
      scope.postMessage({ type: 'ready' } satisfies PaddleResponse);
    } catch (err) {
      scope.postMessage({ type: 'error', message: String((err as Error)?.message ?? err) } satisfies PaddleResponse);
    }
    return;
  }
  if (msg.type === 'detect') {
    if (!models) {
      scope.postMessage({ type: 'error', id: msg.id, message: 'Text recognition models are not loaded' } satisfies PaddleResponse);
      return;
    }
    const img = { width: msg.width, height: msg.height, data: new Uint8ClampedArray(msg.buffer) };
    const job = detectPhase(ort, models, img);
    job.catch(() => undefined);
    detections.set(msg.id, job);
    return;
  }
  if (msg.type === 'discard') {
    detections.delete(msg.id);
    return;
  }
  if (msg.type === 'recognize') {
    const job = detections.get(msg.id);
    detections.delete(msg.id);
    try {
      if (!job || !models) throw new Error('Nothing to recognise for this image');
      const page = await recognizePhase(ort, models, await job, { knownWords: msg.knownWords, trustedRegions: msg.trustedRegions });
      scope.postMessage({ type: 'result', id: msg.id, page } satisfies PaddleResponse);
    } catch (err) {
      scope.postMessage({ type: 'error', id: msg.id, message: String((err as Error)?.message ?? err) } satisfies PaddleResponse);
    }
  }
};
