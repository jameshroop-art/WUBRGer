import { PRINTINGS, printingById, printingFromScryfall, rememberPrinting } from "@/lib/catalog";
import { scryfall } from "@/lib/scryfall";
import type { Finish, Printing } from "@/lib/types";
import type { BandText } from "@/lib/scan/anatomy";

export type ScanHit = {
  printing: Printing;
  confidence: number;
  foil: Finish;
  via: "strip" | "name+set" | "name" | "fuzzy" | "scryfall";
  raw: string;
};

function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[b.length];
}

export function nameScore(query: string, name: string) {
  const q = norm(query);
  const n = norm(name);
  if (!q || !n) return 0;
  if (q === n) return 1;
  if (n.startsWith(q) || q.startsWith(n)) return q.length / Math.max(n.length, q.length) > 0.7 ? 0.95 : 0.8;
  if (n.includes(q) && q.length >= 6) return 0.9;
  const d = levenshtein(q, n);
  const max = Math.max(q.length, n.length);
  return Math.max(0, 1 - d / max);
}

export async function resolvePrintingId(id: string, foil: Finish, score: number): Promise<ScanHit | null> {
  const local = printingById(id);
  if (local) {
    return { printing: local, confidence: Math.max(score, 0.9), foil, via: "scryfall", raw: local.name };
  }
  const res = await scryfall.getCardById(id);
  if (res.ok && res.json && typeof res.json === "object") {
    const card = res.json as Record<string, unknown>;
    if (card.object === "card" && card.id) {
      const printing = rememberPrinting(printingFromScryfall(card));
      return { printing, confidence: Math.max(score, 0.9), foil, via: "scryfall", raw: printing.name };
    }
  }
  return null;
}

export function resolveTitleLocal(title: string, foil: Finish): ScanHit | null {
  const q = title.trim();
  if (q.length < 3) return null;
  let best: ScanHit | null = null;
  for (const p of PRINTINGS) {
    const ns = nameScore(q, p.name);
    if (ns < 0.86) continue;
    if (!best || ns > best.confidence) {
      best = { printing: p, confidence: ns, foil, via: ns >= 0.95 ? "name" : "fuzzy", raw: q };
    }
  }
  return best;
}

const namedCache = new Map<string, ScanHit | "pending">();

export async function resolveTitle(title: string, foil: Finish): Promise<ScanHit | null> {
  const local = resolveTitleLocal(title, foil);
  if (local && local.confidence >= 0.9) return local;
  const key = title.toLowerCase().trim();
  const cached = namedCache.get(key);
  if (cached && cached !== "pending") return { ...cached, foil, raw: title };

  const path = `/cards/named?fuzzy=${encodeURIComponent(title)}`;
  const res = await scryfall.request(path);
  if (res.ok && res.json && typeof res.json === "object") {
    const card = res.json as Record<string, unknown>;
    if (card.object === "card" && card.name) {
      const printing = rememberPrinting(printingFromScryfall(card));
      const ns = nameScore(title, printing.name);
      const hit: ScanHit = { printing, confidence: Math.max(0.88, ns), foil, via: "scryfall", raw: title };
      namedCache.set(key, hit);
      return hit;
    }
  }
  if (!res.ok && res.reason !== "network" && res.status !== 429) {
    const search = await scryfall.request(`/cards/search?q=${encodeURIComponent(`name:"${title}"`)}&unique=prints`);
    if (search.ok && search.json && typeof search.json === "object") {
      const list = search.json as { data?: Record<string, unknown>[] };
      const card = list.data?.[0];
      if (card?.name) {
        const printing = rememberPrinting(printingFromScryfall(card));
        const hit: ScanHit = {
          printing,
          confidence: 0.86,
          foil,
          via: "scryfall",
          raw: title,
        };
        namedCache.set(key, hit);
        return hit;
      }
    }
  }
  return local;
}

export function resolveBands(bands: BandText, foilGuess: boolean): ScanHit | null {
  const foil: Finish = foilGuess ? "foil" : "nonfoil";
  return resolveTitleLocal(bands.name || bands.all, foil);
}
