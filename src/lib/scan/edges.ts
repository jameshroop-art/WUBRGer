export type CardRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
  edges: number;
};

const RATIO = 63 / 88;
let prior: CardRect | null = null;

export function defaultCardRect(): CardRect {
  return { x: 0.12, y: 0.08, w: 0.76, h: 0.84, score: 8, edges: 1 };
}

export function resetCardPrior() {
  prior = null;
}

export function findCardRect(video: HTMLVideoElement): CardRect | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const tw = 180;
  const th = Math.max(100, Math.round((vh / vw) * tw));
  const c = document.createElement("canvas");
  c.width = tw;
  c.height = th;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, tw, th);
  const { data } = ctx.getImageData(0, 0, tw, th);
  const mag = gradient(data, tw, th);
  const col = smooth(columnEnergy(mag, tw, th));
  const row = smooth(rowEnergy(mag, tw, th));
  const vPeaks = peaks(col, 0.32);
  const hPeaks = peaks(row, 0.32);

  const guessed = projectFromEdges(vPeaks, hPeaks, tw, th) ?? bruteRect(mag, tw, th);
  if (!guessed) {
    prior = prior ? { ...prior, score: prior.score * 0.85 } : null;
    return prior && prior.score > 6 ? prior : null;
  }
  const blended = prior ? blend(prior, guessed) : guessed;
  prior = blended;
  return {
    x: clamp01(blended.x / tw),
    y: clamp01(blended.y / th),
    w: Math.min(0.98, Math.max(0.12, blended.w / tw)),
    h: Math.min(0.98, Math.max(0.16, blended.h / th)),
    score: blended.score,
    edges: blended.edges,
  };
}

function projectFromEdges(
  vPeaks: { i: number; v: number }[],
  hPeaks: { i: number; v: number }[],
  tw: number,
  th: number,
): CardRect | null {
  const left = vPeaks.filter((p) => p.i < tw * 0.62).sort((a, b) => b.v - a.v)[0];
  const right = vPeaks.filter((p) => p.i >= tw * 0.38).sort((a, b) => b.v - a.v)[0];
  const top = hPeaks.filter((p) => p.i < th * 0.55).sort((a, b) => b.v - a.v)[0];
  const bot = hPeaks.filter((p) => p.i >= th * 0.42).sort((a, b) => b.v - a.v)[0];

  let x = 0;
  let y = 0;
  let w = 0;
  let h = 0;
  let edges = 0;
  let score = 0;

  if (left && right && right.i - left.i > tw * 0.2) {
    x = left.i;
    w = right.i - left.i;
    edges += 2;
    score += left.v + right.v;
  } else if (left) {
    x = left.i;
    w = Math.min(tw - x - 2, Math.round(th * 0.78 * RATIO));
    edges += 1;
    score += left.v;
  } else if (right) {
    w = Math.min(right.i - 2, Math.round(th * 0.78 * RATIO));
    x = Math.max(2, right.i - w);
    edges += 1;
    score += right.v;
  }

  if (top && bot && bot.i - top.i > th * 0.28) {
    y = top.i;
    h = bot.i - top.i;
    edges += 2;
    score += top.v + bot.v;
  } else if (top) {
    y = top.i;
    h = w ? Math.round(w / RATIO) : Math.round(th * 0.78);
    if (y + h > th - 2) h = th - 2 - y;
    edges += 1;
    score += top.v;
  } else if (bot) {
    h = w ? Math.round(w / RATIO) : Math.round(th * 0.78);
    y = Math.max(2, bot.i - h);
    edges += 1;
    score += bot.v;
  }

  if (!edges) return null;
  if (!w && h) w = Math.round(h * RATIO);
  if (!h && w) h = Math.round(w / RATIO);
  if (!w || !h) {
    h = Math.round(th * 0.72);
    w = Math.round(h * RATIO);
  }
  if (!x && w) x = Math.max(2, Math.round((tw - w) / 2));
  if (!y && h) y = Math.max(2, Math.round((th - h) / 2));
  if (x + w > tw - 1) w = tw - 1 - x;
  if (y + h > th - 1) h = th - 1 - y;
  if (w < tw * 0.16 || h < th * 0.2) return null;
  return { x, y, w, h, score: score / Math.max(1, edges), edges };
}

function bruteRect(g: Float32Array, tw: number, th: number): CardRect | null {
  let best: CardRect | null = null;
  for (let h = Math.floor(th * 0.38); h <= Math.floor(th * 0.95); h += 5) {
    const w = Math.round(h * RATIO);
    if (w < tw * 0.22 || w > tw * 0.95) continue;
    for (let y = 2; y <= th - h - 2; y += 5) {
      for (let x = 2; x <= tw - w - 2; x += 5) {
        const score = borderScore(g, tw, x, y, w, h);
        if (!best || score > best.score) best = { x, y, w, h, score, edges: 4 };
      }
    }
  }
  return best && best.score > 10 ? best : null;
}

function columnEnergy(g: Float32Array, tw: number, th: number) {
  const col = new Float32Array(tw);
  for (let x = 1; x < tw - 1; x++) {
    let s = 0;
    for (let y = 1; y < th - 1; y++) s += g[y * tw + x];
    col[x] = s / th;
  }
  return col;
}

function rowEnergy(g: Float32Array, tw: number, th: number) {
  const row = new Float32Array(th);
  for (let y = 1; y < th - 1; y++) {
    let s = 0;
    for (let x = 1; x < tw - 1; x++) s += g[y * tw + x];
    row[y] = s / tw;
  }
  return row;
}

function smooth(a: Float32Array) {
  const o = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    const l = a[Math.max(0, i - 1)];
    const r = a[Math.min(a.length - 1, i + 1)];
    o[i] = (l + a[i] * 2 + r) / 4;
  }
  return o;
}

function peaks(a: Float32Array, frac: number) {
  let mean = 0;
  for (let i = 0; i < a.length; i++) mean += a[i];
  mean /= a.length;
  const floor = mean * (1 + frac);
  const out: { i: number; v: number }[] = [];
  for (let i = 2; i < a.length - 2; i++) {
    if (a[i] > floor && a[i] >= a[i - 1] && a[i] >= a[i + 1]) out.push({ i, v: a[i] });
  }
  return out.sort((a, b) => b.v - a.v).slice(0, 8);
}

function gradient(data: Uint8ClampedArray, w: number, h: number) {
  const g = new Float32Array(w * h);
  const lum = (i: number) => data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      g[i] = Math.abs(lum(i + 1) - lum(i - 1)) + Math.abs(lum(i + w) - lum(i - w));
    }
  }
  return g;
}

function borderScore(g: Float32Array, tw: number, x: number, y: number, w: number, h: number) {
  let edge = 0;
  let n = 0;
  const sample = (sx: number, sy: number) => {
    edge += g[sy * tw + sx];
    n += 1;
  };
  for (let i = 0; i < w; i += 2) {
    sample(x + i, y);
    sample(x + i, y + h - 1);
  }
  for (let i = 0; i < h; i += 2) {
    sample(x, y + i);
    sample(x + w - 1, y + i);
  }
  return n ? edge / n : 0;
}

function blend(a: CardRect, b: CardRect): CardRect {
  const t = 0.72;
  return {
    x: a.x * (1 - t) + b.x * t,
    y: a.y * (1 - t) + b.y * t,
    w: a.w * (1 - t) + b.w * t,
    h: a.h * (1 - t) + b.h * t,
    score: Math.max(a.score, b.score),
    edges: Math.max(a.edges, b.edges),
  };
}

function clamp01(n: number) {
  return Math.min(0.98, Math.max(0.01, n));
}

export function cropCardCanvas(video: HTMLVideoElement, rect: CardRect): HTMLCanvasElement | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const pad = 0.03;
  const sx = Math.max(0, (rect.x - pad) * vw);
  const sy = Math.max(0, (rect.y - pad) * vh);
  const sw = Math.min(vw - sx, (rect.w + pad * 2) * vw);
  const sh = Math.min(vh - sy, (rect.h + pad * 2) * vh);
  const out = document.createElement("canvas");
  out.width = 720;
  out.height = Math.max(1, Math.round(720 / (sw / sh)));
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return out;
}

export function cropCard(video: HTMLVideoElement, rect: CardRect): string | null {
  const canvas = cropCardCanvas(video, rect);
  if (!canvas) return null;
  try {
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return null;
  }
}

export function titleBandFromRect(video: HTMLVideoElement, rect: CardRect, shift = 0): HTMLCanvasElement | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const sx = (rect.x + rect.w * 0.02) * vw;
  const sy = (rect.y + rect.h * (0.012 + shift)) * vh;
  const sw = rect.w * 0.88 * vw;
  const sh = rect.h * 0.22 * vh;
  if (sw < 8 || sh < 6) return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(16, Math.round(sw * 3));
  canvas.height = Math.max(16, Math.round(sh * 3));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  contrast(ctx, canvas.width, canvas.height);
  return canvas;
}

export function titleBandFromStill(still: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const sx = still.width * 0.03;
  const sy = still.height * 0.02;
  const sw = still.width * 0.86;
  const sh = still.height * 0.2;
  canvas.width = Math.max(16, Math.round(sw * 2.4));
  canvas.height = Math.max(16, Math.round(sh * 2.4));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return still;
  ctx.drawImage(still, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  contrast(ctx, canvas.width, canvas.height);
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
