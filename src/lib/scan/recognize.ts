import { foilHint } from "@/lib/scan/anatomy";
import type { CardRect } from "@/lib/scan/edges";
import {
  bitmapFromDataUrl,
  bitmapFromVideo,
  bitmapToJpeg,
  scanBitmap,
  type CvResult,
} from "@/lib/scan/collector-vision";
import { resolvePrintingId, type ScanHit } from "@/lib/scan/resolve";

export type FrameRead = {
  title: string;
  hit: ScanHit | null;
  rect: CardRect | null;
  locked: boolean;
  photo: string | null;
};

export function resetScanIterate() {}

function rectFromCorners(corners: [number, number][] | null, score: number): CardRect | null {
  if (!corners || corners.length < 4) return null;
  const xs = corners.map((p) => p[0]);
  const ys = corners.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    w: Math.max(0.02, Math.max(...xs) - x),
    h: Math.max(0.02, Math.max(...ys) - y),
    score,
    edges: 4,
  };
}

let streakId: string | null = null;
let streak = 0;

async function fromCv(cv: CvResult, foilGuess: boolean): Promise<FrameRead> {
  const rect = rectFromCorners(cv.corners, cv.confidence);
  const photo = cv.crop ? bitmapToJpeg(cv.crop) : null;
  if (cv.crop) cv.crop.close();
  if (!cv.cardId || (cv.score ?? 0) < 0.5 || !cv.cornersValid) {
    streak = 0;
    streakId = null;
    return {
      title: cv.cardName ?? "",
      hit: null,
      rect,
      locked: false,
      photo,
    };
  }
  if (cv.cardId === streakId) streak += 1;
  else {
    streakId = cv.cardId;
    streak = 1;
  }
  const hit = await resolvePrintingId(cv.cardId, foilGuess ? "foil" : "nonfoil", cv.score ?? 0.5);
  return {
    title: hit?.printing.name ?? cv.cardName ?? "",
    hit,
    rect,
    locked: Boolean(hit && (cv.score ?? 0) >= 0.55 && streak >= 2),
    photo,
  };
}

export async function recognizeVideoFrame(video: HTMLVideoElement): Promise<FrameRead> {
  if (!video.videoWidth || video.readyState < 2) {
    return { title: "", hit: null, rect: null, locked: false, photo: null };
  }
  const bitmap = await bitmapFromVideo(video);
  const cv = await scanBitmap(bitmap);
  return fromCv(cv, foilHint(video));
}

export async function recognizeStillDataUrl(dataUrl: string): Promise<FrameRead> {
  const bitmap = await bitmapFromDataUrl(dataUrl);
  const cv = await scanBitmap(bitmap);
  const read = await fromCv(cv, false);
  return { ...read, photo: read.photo ?? dataUrl };
}
