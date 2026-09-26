export type BandText = {
  name: string;
  type: string;
  strip: string;
  pt: string;
  all: string;
};

/** Title bar as it appears when a card is held in the preview, not flush to the bezel. */
export function grabTitleBand(video: HTMLVideoElement, variant: 0 | 1 = 0): HTMLCanvasElement | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const bands =
    variant === 0
      ? { x: 0.08, y: 0.12, w: 0.62, h: 0.18 }
      : { x: 0.10, y: 0.20, w: 0.60, h: 0.16 };
  const sx = vw * bands.x;
  const sy = vh * bands.y;
  const sw = vw * bands.w;
  const sh = vh * bands.h;
  const scale = 3;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(16, Math.round(sw * scale));
  canvas.height = Math.max(16, Math.round(sh * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  contrast(ctx, canvas.width, canvas.height);
  return canvas;
}

export function invertCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return src;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255 - d[i];
    d[i + 1] = 255 - d[i + 1];
    d[i + 2] = 255 - d[i + 2];
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function contrast(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const y = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    if (y < min) min = y;
    if (y > max) max = y;
  }
  const span = Math.max(1, max - min);
  for (let i = 0; i < d.length; i += 4) {
    const y = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    const v = Math.round(((y - min) / span) * 255);
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

export function foilHint(video: HTMLVideoElement): boolean {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return false;
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext("2d");
  if (!ctx) return false;
  ctx.drawImage(video, vw * 0.18, vh * 0.28, vw * 0.64, vh * 0.28, 0, 0, 32, 32);
  const d = ctx.getImageData(0, 0, 32, 32).data;
  let sat = 0;
  for (let i = 0; i < d.length; i += 4) {
    const max = Math.max(d[i], d[i + 1], d[i + 2]);
    const min = Math.min(d[i], d[i + 1], d[i + 2]);
    sat += max === 0 ? 0 : (max - min) / max;
  }
  return sat / (d.length / 4) > 0.42;
}
