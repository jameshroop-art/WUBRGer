export type CvProgress = {
  stage: string;
  ratio?: number;
  loaded?: number;
  total?: number;
};

export type CvResult = {
  cardPresent: boolean;
  cornersValid: boolean;
  corners: [number, number][] | null;
  confidence: number;
  cardId: string | null;
  cardName: string | null;
  score: number | null;
  crop: ImageBitmap | null;
};

type Listener = (r: CvResult) => void;

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
let inFlight = false;
const waiters: Listener[] = [];

function cvRoot() {
  return `${window.location.origin}/cv`;
}

function spawnWorker(): Worker {
  return new Worker(`${cvRoot()}/scanner.worker.mjs`, { type: "module" });
}

async function spawnWorkerFallback(): Promise<Worker> {
  const src = await fetch(`${cvRoot()}/scanner.worker.mjs`).then((r) => r.text());
  const rewritten = src.replace(
    /from\s+"\.\/vendor\/onnxruntime-web\/ort\.webgpu\.min\.mjs"/,
    `from "${cvRoot()}/vendor/onnxruntime-web/ort.webgpu.min.mjs"`,
  );
  const blob = new Blob([rewritten], { type: "text/javascript" });
  return new Worker(URL.createObjectURL(blob), { type: "module" });
}

export function ensureCollectorVision(onProgress?: (p: CvProgress) => void): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    const manifest = await fetch(`${cvRoot()}/assets/manifest.json`).then((r) => {
      if (!r.ok) throw new Error("CollectorVision manifest missing");
      return r.json();
    });
    try {
      worker = spawnWorker();
    } catch {
      worker = await spawnWorkerFallback();
    }
    worker.onerror = () => {
      /* retry via blob if first construct silently failed later */
    };
    const boot = new Promise<void>((resolve, reject) => {
      const w = worker!;
      w.onmessage = (ev: MessageEvent) => {
        const data = ev.data;
        if (data?.type === "progress") {
          onProgress?.({
            stage: data.stage,
            ratio: data.ratio,
            loaded: data.loaded,
            total: data.total,
          });
        } else if (data?.type === "ready") {
          resolve();
        } else if (data?.type === "error") {
          reject(new Error(data.message || "CollectorVision"));
        } else if (data?.type === "result") {
          const next = waiters.shift();
          next?.(normalize(data));
        }
      };
      w.onerror = (e) => reject(e.error ?? new Error("CollectorVision worker"));
      w.postMessage({
        type: "init",
        manifest,
        assetBasePath: `${cvRoot()}/assets`,
        wasmPaths: `${cvRoot()}/vendor/onnxruntime-web/`,
        enableWebGpu: false,
        catalogMode: "v1",
        rotationInvariant: true,
        minCornerConfidence: 0.02,
      });
    });
    try {
      await boot;
    } catch {
      worker?.terminate();
      worker = await spawnWorkerFallback();
      await new Promise<void>((resolve, reject) => {
        const w = worker!;
        w.onmessage = (ev: MessageEvent) => {
          const data = ev.data;
          if (data?.type === "progress") {
            onProgress?.({
              stage: data.stage,
              ratio: data.ratio,
              loaded: data.loaded,
              total: data.total,
            });
          } else if (data?.type === "ready") resolve();
          else if (data?.type === "error") reject(new Error(data.message || "CollectorVision"));
          else if (data?.type === "result") {
            const next = waiters.shift();
            next?.(normalize(data));
          }
        };
        w.onerror = (e) => reject(e.error ?? new Error("CollectorVision worker"));
        w.postMessage({
          type: "init",
          manifest,
          assetBasePath: `${cvRoot()}/assets`,
          wasmPaths: `${cvRoot()}/vendor/onnxruntime-web/`,
          enableWebGpu: false,
          catalogMode: "v1",
          rotationInvariant: true,
          minCornerConfidence: 0.02,
        });
      });
    }
  })().catch((e) => {
    ready = null;
    worker = null;
    throw e;
  });
  return ready;
}

function normalize(data: Record<string, unknown>): CvResult {
  return {
    cardPresent: Boolean(data.cardPresent),
    cornersValid: Boolean(data.cornersValid),
    corners: Array.isArray(data.corners) ? (data.corners as [number, number][]) : null,
    confidence: Number(data.confidence ?? 0),
    cardId: typeof data.cardId === "string" ? data.cardId : null,
    cardName: typeof data.cardName === "string" ? data.cardName : null,
    score: data.score == null ? null : Number(data.score),
    crop: data.cropBitmap instanceof ImageBitmap ? data.cropBitmap : null,
  };
}

export async function scanBitmap(bitmap: ImageBitmap): Promise<CvResult> {
  await ensureCollectorVision();
  if (!worker) throw new Error("CollectorVision not ready");
  const start = Date.now();
  while (inFlight) {
    if (Date.now() - start > 8000) {
      bitmap.close();
      throw new Error("scanner busy");
    }
    await new Promise((r) => window.setTimeout(r, 40));
  }
  inFlight = true;
  try {
    return await new Promise<CvResult>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        const i = waiters.indexOf(resolve as Listener);
        if (i >= 0) waiters.splice(i, 1);
        reject(new Error("scan timed out"));
      }, 12000);
      waiters.push((r) => {
        window.clearTimeout(timer);
        resolve(r);
      });
      worker!.postMessage({ type: "frame", bitmap, includeDebugBitmaps: true }, [bitmap]);
    });
  } finally {
    inFlight = false;
  }
}

export async function bitmapFromVideo(video: HTMLVideoElement): Promise<ImageBitmap> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  const scale = Math.min(1, 960 / Math.max(w, h));
  return createImageBitmap(video, {
    resizeWidth: Math.max(64, Math.round(w * scale)),
    resizeHeight: Math.max(64, Math.round(h * scale)),
  });
}

export async function bitmapFromDataUrl(dataUrl: string): Promise<ImageBitmap> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

export function bitmapToJpeg(bitmap: ImageBitmap, quality = 0.82): string | null {
  const c = document.createElement("canvas");
  c.width = bitmap.width;
  c.height = bitmap.height;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0);
  try {
    return c.toDataURL("image/jpeg", quality);
  } catch {
    return null;
  }
}
