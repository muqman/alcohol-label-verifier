// Browser OCR service: owns the Tesseract workers and PaddleOCR workers,
// loads everything from this site's own files (no CDN), and exposes the
// OcrBackends interface used by checkLabel().
import { createScheduler, createWorker, type Scheduler } from 'tesseract.js';
import { checkLabel, type DeepHandle, type LabelCheck, type OcrBackends, type Stage } from '../../core/checkLabel';
import type { ApplicationData } from '../../domain/types';
import { tesseractToPage } from '../tesseract/convert';
import type { Box, OcrPage, OcrWord, RgbaImage } from '../types';
import { decodeImage, toPng, type LabelImage } from './decode';
import type { PaddleRequest, PaddleResponse } from './paddle.worker';

export type EngineStatus = 'loading' | 'ready' | 'error';

export interface ServiceState {
  /** Fast engine (needed before anything can be checked). */
  fast: EngineStatus;
  /** Second-look engine (loads in the background). */
  deep: EngineStatus;
  error?: string;
}

const base = () => new URL('./', document.baseURI).href;

class PaddleWorker {
  private worker: Worker;
  private ready: Promise<void>;
  private pending = new Map<number, { resolve: (p: OcrPage) => void; reject: (e: Error) => void }>();
  private nextId = 1;
  busy = 0;

  constructor() {
    this.worker = new Worker(new URL('./paddle.worker.ts', import.meta.url), { type: 'module' });
    this.ready = new Promise((resolve, reject) => {
      const onInit = (e: MessageEvent<PaddleResponse>) => {
        if (e.data.type === 'ready') resolve();
        else if (e.data.type === 'error' && e.data.id === undefined) reject(new Error(e.data.message));
        else return;
        this.worker.removeEventListener('message', onInit);
      };
      this.worker.addEventListener('message', onInit);
      this.worker.addEventListener('error', (ev) => reject(new Error(ev.message || 'The text recognition worker failed to start')));
    });
    this.worker.addEventListener('message', (e: MessageEvent<PaddleResponse>) => {
      const m = e.data;
      if (m.type === 'result') this.settle(m.id, m.page);
      else if (m.type === 'error' && m.id !== undefined) this.settle(m.id, undefined, new Error(m.message));
    });
    const init: PaddleRequest = { type: 'init', modelBase: `${base()}models/paddleocr/` };
    this.worker.postMessage(init);
  }

  whenReady() {
    return this.ready;
  }

  private settle(id: number, page?: OcrPage, err?: Error) {
    // (busy is decremented here for finished runs, or in cancel())
    const p = this.pending.get(id);
    if (!p) return;
    this.pending.delete(id);
    this.busy--;
    if (err) p.reject(err);
    else p.resolve(page!);
  }

  /** Start detection now; finish (or cancel) once the first pass is done. */
  start(img: RgbaImage): DeepHandle {
    const id = this.nextId++;
    this.busy++;
    const buffer = img.data.slice().buffer; // copy: the page keeps its pixels
    const sent = this.ready.then(() => {
      const msg: PaddleRequest = { type: 'detect', id, width: img.width, height: img.height, buffer };
      this.worker.postMessage(msg, [buffer]);
    });
    let settled = false;
    return {
      finish: async (knownWords, trustedRegions) => {
        await sent;
        settled = true;
        return new Promise<OcrPage>((resolve, reject) => {
          this.pending.set(id, { resolve, reject });
          const msg: PaddleRequest = { type: 'recognize', id, knownWords, trustedRegions };
          this.worker.postMessage(msg);
        });
      },
      cancel: () => {
        if (settled) return;
        settled = true;
        this.busy--;
        void sent.then(() => this.worker.postMessage({ type: 'discard', id } satisfies PaddleRequest));
      },
    };
  }

  run(img: RgbaImage, knownWords: OcrWord[], trustedRegions: Box[]): Promise<OcrPage> {
    return this.start(img).finish(knownWords, trustedRegions);
  }
}

export class OcrService {
  state: ServiceState = { fast: 'loading', deep: 'loading' };
  private listeners = new Set<(s: ServiceState) => void>();
  private scheduler: Scheduler | null = null;
  private tesseractWorkers = 0;
  private fastReady: Promise<void>;
  private paddle: PaddleWorker[] = [];
  /** In batches the cores are already busy with parallel labels. */
  private batchMode = false;

  constructor() {
    this.fastReady = this.addTesseractWorker()
      .then(() => this.update({ fast: 'ready' }))
      .catch((e) => {
        this.update({ fast: 'error', error: `The text reader could not start: ${e?.message ?? e}` });
        throw e;
      });
    // Load the second-look engine after the fast one, so first use is quick.
    this.fastReady
      .then(() => {
        const w = new PaddleWorker();
        this.paddle.push(w);
        return w.whenReady();
      })
      .then(() => this.update({ deep: 'ready' }))
      .catch((e) => this.update({ deep: 'error', error: this.state.error ?? `The detailed text reader could not start: ${e?.message ?? e}` }));
  }

  subscribe(fn: (s: ServiceState) => void) {
    this.listeners.add(fn);
    fn(this.state);
    return () => void this.listeners.delete(fn);
  }

  private update(patch: Partial<ServiceState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
  }

  private async addTesseractWorker() {
    this.scheduler ??= createScheduler();
    const b = base();
    const worker = await createWorker('eng', 1, {
      workerPath: `${b}ocr-runtime/tesseract/worker.min.js`,
      corePath: `${b}ocr-runtime/tesseract/core/`,
      langPath: `${b}ocr-runtime/tesseract/lang/`,
      workerBlobURL: false,
      gzip: true,
    });
    await worker.setParameters({ tessedit_pageseg_mode: '3' as never, user_defined_dpi: '300' });
    this.scheduler.addWorker(worker);
    this.tesseractWorkers++;
  }

  endBatch() {
    this.batchMode = false;
  }

  /** Use more cores for batches: extra Tesseract and PaddleOCR workers. */
  async scaleForBatch() {
    this.batchMode = true;
    const cores = navigator.hardwareConcurrency || 2;
    // At least two lanes even on dual-core machines: while one label waits on a
    // worker (image decoding, message passing) the other keeps the CPU busy.
    const wantFast = Math.max(2, Math.min(4, cores));
    await this.fastReady;
    const adds: Promise<void>[] = [];
    for (let i = this.tesseractWorkers; i < wantFast; i++) adds.push(this.addTesseractWorker().catch(() => undefined));
    if (cores >= 4 && this.paddle.length < 2 && this.state.deep === 'ready') this.paddle.push(new PaddleWorker());
    await Promise.all(adds);
    return wantFast;
  }

  private backends: OcrBackends = {
    tesseract: async (img) => {
      await this.fastReady;
      const t0 = performance.now();
      const png = await toPng(img);
      const res = await this.scheduler!.addJob('recognize', png, {}, { blocks: true, text: false });
      return tesseractToPage(res.data as never, img.width, img.height, performance.now() - t0);
    },
    paddle: async (img, knownWords, trustedRegions) => {
      await this.fastReady;
      return this.leastBusy().run(img, knownWords, trustedRegions);
    },
    paddleEarly: (img) => this.leastBusy().start(img),
  };

  private leastBusy(): PaddleWorker {
    if (!this.paddle.length) throw new Error('The detailed text reader is not available');
    return this.paddle.reduce((a, b) => (b.busy < a.busy ? b : a));
  }

  /** Decode files and run the full check. */
  async check(app: ApplicationData, images: LabelImage[], onStage?: (s: Stage) => void): Promise<LabelCheck> {
    await this.fastReady;
    // Without the second engine (failed to load), still give the fast result.
    const ocr: OcrBackends = this.state.deep === 'error' ? { tesseract: this.backends.tesseract } : this.backends;
    // With spare cores, start the second engine's text detection right away so a
    // second look (if needed) costs only the recognition step.
    const speculate = this.state.deep === 'ready' && (navigator.hardwareConcurrency || 2) >= 4 && !this.batchMode;
    return checkLabel(app, images.map((i) => i.pixels), ocr, { onStage, speculate });
  }

  decode(file: File) {
    return decodeImage(file);
  }
}

let service: OcrService | null = null;
export const getOcrService = () => (service ??= new OcrService());
