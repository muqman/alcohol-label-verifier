// Small, dependency-free image helpers that work on raw RGBA buffers, so the
// same code runs in the browser (main thread or worker) and in Node tests.
import type { RgbaImage } from './types';

export function createImage(width: number, height: number): RgbaImage {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

/**
 * Resize with area averaging when shrinking (avoids aliasing that destroys
 * small print) and bilinear interpolation when enlarging.
 */
export function resize(src: RgbaImage, width: number, height: number): RgbaImage {
  width = Math.max(1, Math.round(width));
  height = Math.max(1, Math.round(height));
  if (width === src.width && height === src.height) return src;
  const dst = createImage(width, height);
  const sx = src.width / width;
  const sy = src.height / height;
  const s = src.data;
  const d = dst.data;

  if (sx >= 1 && sy >= 1) {
    // Box filter: average every source pixel that falls in the destination cell.
    for (let y = 0; y < height; y++) {
      const y0 = Math.floor(y * sy);
      const y1 = Math.min(src.height, Math.max(y0 + 1, Math.floor((y + 1) * sy)));
      for (let x = 0; x < width; x++) {
        const x0 = Math.floor(x * sx);
        const x1 = Math.min(src.width, Math.max(x0 + 1, Math.floor((x + 1) * sx)));
        let r = 0, g = 0, b = 0, a = 0;
        for (let yy = y0; yy < y1; yy++) {
          let i = (yy * src.width + x0) * 4;
          for (let xx = x0; xx < x1; xx++, i += 4) {
            r += s[i]; g += s[i + 1]; b += s[i + 2]; a += s[i + 3];
          }
        }
        const n = (y1 - y0) * (x1 - x0);
        const o = (y * width + x) * 4;
        d[o] = r / n; d[o + 1] = g / n; d[o + 2] = b / n; d[o + 3] = a / n;
      }
    }
    return dst;
  }

  for (let y = 0; y < height; y++) {
    const fy = Math.min(src.height - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(src.height - 1, y0 + 1);
    const wy = fy - y0;
    for (let x = 0; x < width; x++) {
      const fx = Math.min(src.width - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(src.width - 1, x0 + 1);
      const wx = fx - x0;
      const i00 = (y0 * src.width + x0) * 4, i01 = (y0 * src.width + x1) * 4;
      const i10 = (y1 * src.width + x0) * 4, i11 = (y1 * src.width + x1) * 4;
      const o = (y * width + x) * 4;
      for (let c = 0; c < 4; c++) {
        const top = s[i00 + c] + (s[i01 + c] - s[i00 + c]) * wx;
        const bot = s[i10 + c] + (s[i11 + c] - s[i10 + c]) * wx;
        d[o + c] = top + (bot - top) * wy;
      }
    }
  }
  return dst;
}

/** Rotate clockwise by a multiple of 90 degrees. */
export function rotate(src: RgbaImage, degrees: 0 | 90 | 180 | 270): RgbaImage {
  if (degrees === 0) return src;
  const { width: W, height: H, data: s } = src;
  const dst = degrees === 180 ? createImage(W, H) : createImage(H, W);
  const d = dst.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let nx: number, ny: number;
      if (degrees === 90) { nx = H - 1 - y; ny = x; }
      else if (degrees === 180) { nx = W - 1 - x; ny = H - 1 - y; }
      else { nx = y; ny = W - 1 - x; }
      const i = (y * W + x) * 4;
      const o = (ny * dst.width + nx) * 4;
      d[o] = s[i]; d[o + 1] = s[i + 1]; d[o + 2] = s[i + 2]; d[o + 3] = s[i + 3];
    }
  }
  return dst;
}

/** Luma (0..255) per pixel. */
export function toGray(src: RgbaImage): Uint8Array {
  const n = src.width * src.height;
  const g = new Uint8Array(n);
  const s = src.data;
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    g[i] = (s[j] * 77 + s[j + 1] * 150 + s[j + 2] * 29) >> 8;
  }
  return g;
}

/**
 * Map a point given in the frame of an image rotated clockwise by `degrees`
 * back to the frame of the original (unrotated) image of size W x H.
 */
export function unrotatePoint(x: number, y: number, degrees: 0 | 90 | 180 | 270, W: number, H: number): [number, number] {
  switch (degrees) {
    case 90: return [y, H - x];
    case 180: return [W - x, H - y];
    case 270: return [W - y, x];
    default: return [x, y];
  }
}
