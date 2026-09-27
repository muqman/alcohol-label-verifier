// Turn an uploaded file into pixels at the OCR working resolution.
import { workingSize } from '../prepare';
import type { RgbaImage } from '../types';

export interface LabelImage {
  name: string;
  /** Object URL of the original file, for display. */
  url: string;
  /** Pixels at working resolution (EXIF orientation applied). */
  pixels: RgbaImage;
}

export class ImageError extends Error {}

function canvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

export async function decodeImage(file: Blob, name = (file as File).name ?? 'label'): Promise<LabelImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageError(`“${name}” could not be opened as an image. Please use a JPEG, PNG or WebP file.`);
  }
  try {
    const size = workingSize(bitmap.width, bitmap.height);
    const c = canvas(size.width, size.height);
    const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) throw new ImageError('This browser cannot process images (no canvas support).');
    ctx.imageSmoothingQuality = 'high';
    // Transparent PNG artwork: put it on white, or transparent areas read as black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    const data = ctx.getImageData(0, 0, size.width, size.height);
    return { name, url: URL.createObjectURL(file), pixels: { width: data.width, height: data.height, data: data.data } };
  } finally {
    bitmap.close();
  }
}

/** Encode pixels as PNG (lossless) for engines that want an image file. */
export async function toPng(img: RgbaImage): Promise<Blob> {
  const c = canvas(img.width, img.height);
  const ctx = c.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  if ('convertToBlob' in c) return c.convertToBlob({ type: 'image/png' });
  return new Promise((resolve, reject) => (c as HTMLCanvasElement).toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'));
}
