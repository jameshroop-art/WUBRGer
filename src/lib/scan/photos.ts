import { persistCardImage } from "@/lib/device-storage";

const KEY = "wubrger.scan.photos.v1";

type PhotoMap = Record<string, string>;

function load(): PhotoMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as PhotoMap;
  } catch {
    return {};
  }
}

export function saveScanPhoto(title: string, scryfallId: string, dataUrl: string) {
  persistCardImage(title || scryfallId, dataUrl);
  const all = load();
  all[scryfallId] = dataUrl;
  all[`title:${title.toLowerCase()}`] = dataUrl;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - 12))) {
      if (k.startsWith("title:")) delete all[k];
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
      /* ignore */
    }
  }
}

export function scanPhotoFor(scryfallId: string, title?: string) {
  const all = load();
  return all[scryfallId] ?? (title ? all[`title:${title.toLowerCase()}`] : undefined) ?? null;
}
