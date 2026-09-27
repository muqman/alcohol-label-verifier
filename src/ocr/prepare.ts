// Working resolution for OCR. Phone photos are shrunk (faster, and OCR gains
// nothing past ~2200 px); tiny images are enlarged so small print such as the
// health warning has enough pixels per letter.
export const MAX_SIDE = 2200;
export const SMALL_SIDE = 1000;
export const SMALL_TARGET = 1400;

export function workingSize(width: number, height: number): { width: number; height: number; scale: number } {
  const long = Math.max(width, height);
  let scale = 1;
  if (long > MAX_SIDE) scale = MAX_SIDE / long;
  else if (long < SMALL_SIDE) scale = SMALL_TARGET / long;
  return { width: Math.round(width * scale), height: Math.round(height * scale), scale };
}
