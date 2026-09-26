/** Official Scryfall API caps — https://scryfall.com/docs/api/rate-limits */

export const SCRYFALL_UA = "WUBRGer/1.0";
export const SCRYFALL_ORIGIN = "https://api.scryfall.com";

export type ScryfallBucket =
  | "search"
  | "named"
  | "random"
  | "collection"
  | "manifest"
  | "other";

export const SCRYFALL_LIMITS = {
  search: { rps: 2, gapMs: 500 },
  named: { rps: 2, gapMs: 500 },
  random: { rps: 2, gapMs: 500 },
  collection: { rps: 2, gapMs: 500, maxIds: 75 },
  manifest: { rps: 10, gapMs: 6_000 },
  other: { rps: 10, gapMs: 100 },
  retryAfter429Ms: 30_000,
  priceFreshMs: 24 * 3600_000,
  catalogFreshMs: 36 * 3600_000,
  gameplayFreshMs: 7 * 24 * 3600_000,
} as const;

export function bucketForPath(path: string): ScryfallBucket {
  const p = path.split("?")[0];
  if (p.startsWith("/cards/search")) return "search";
  if (p.startsWith("/cards/named")) return "named";
  if (p.startsWith("/cards/random")) return "random";
  if (p.startsWith("/cards/collection")) return "collection";
  if (p.startsWith("/cards/manifest")) return "manifest";
  return "other";
}

export type GateDecision =
  | { ok: true; waitMs: number; bucket: ScryfallBucket }
  | { ok: false; reason: string; retryAt: number; bucket: ScryfallBucket };

export type GateState = {
  nextAt: Record<ScryfallBucket, number>;
  cooldownUntil: number;
  lastPath: string | null;
  lastStatus: string | null;
  lastAt: string | null;
};

const EMPTY_NEXT: Record<ScryfallBucket, number> = {
  search: 0,
  named: 0,
  random: 0,
  collection: 0,
  manifest: 0,
  other: 0,
};

export function createGateState(): GateState {
  return {
    nextAt: { ...EMPTY_NEXT },
    cooldownUntil: 0,
    lastPath: null,
    lastStatus: null,
    lastAt: null,
  };
}

export function decideGate(state: GateState, path: string, now = Date.now()): GateDecision {
  const bucket = bucketForPath(path);
  if (now < state.cooldownUntil) {
    return {
      ok: false,
      reason: `429 cooldown · ${Math.ceil((state.cooldownUntil - now) / 1000)}s`,
      retryAt: state.cooldownUntil,
      bucket,
    };
  }
  const next = state.nextAt[bucket] ?? 0;
  return { ok: true, waitMs: Math.max(0, next - now), bucket };
}

export function markSent(state: GateState, bucket: ScryfallBucket, now = Date.now()): GateState {
  const gap = SCRYFALL_LIMITS[bucket].gapMs;
  return {
    ...state,
    nextAt: { ...state.nextAt, [bucket]: now + gap },
    lastAt: new Date(now).toISOString(),
  };
}

export function markResult(
  state: GateState,
  path: string,
  status: number,
  now = Date.now(),
): GateState {
  const cooldownUntil = status === 429 ? now + SCRYFALL_LIMITS.retryAfter429Ms : state.cooldownUntil;
  return {
    ...state,
    cooldownUntil,
    lastPath: path,
    lastStatus: String(status),
    lastAt: new Date(now).toISOString(),
  };
}

export function pricesAreFresh(fetchedAt: string | null, now = Date.now()) {
  if (!fetchedAt) return false;
  return now - new Date(fetchedAt).getTime() < SCRYFALL_LIMITS.priceFreshMs;
}

export function catalogIsFresh(fetchedAt: string | null, now = Date.now()) {
  if (!fetchedAt) return false;
  return now - new Date(fetchedAt).getTime() < SCRYFALL_LIMITS.catalogFreshMs;
}

export function chunkIds<T>(items: T[], size = SCRYFALL_LIMITS.collection.maxIds): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function isImageOrigin(url: string) {
  try {
    return new URL(url).hostname.endsWith("scryfall.io");
  } catch {
    return false;
  }
}

type Listener = (s: GateState) => void;

class ScryfallClient {
  private state: GateState = createGateState();
  private tail: Promise<void> = Promise.resolve();
  private listeners = new Set<Listener>();

  snapshot() {
    return this.state;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.state);
    return () => {
      this.listeners.delete(fn);
    };
  }

  restoreCooldown(iso: string | null) {
    if (!iso) return;
    const t = new Date(iso).getTime();
    if (t > Date.now()) this.state = { ...this.state, cooldownUntil: t };
  }

  private emit() {
    for (const fn of this.listeners) fn(this.state);
  }

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.tail.then(job, job);
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async request(path: string, init?: RequestInit): Promise<{ ok: true; json: unknown } | { ok: false; reason: string; status?: number }> {
    return this.enqueue(async () => {
      const decided = decideGate(this.state, path);
      if (!decided.ok) {
        this.state = { ...this.state, lastStatus: decided.reason, lastPath: path };
        this.emit();
        return { ok: false as const, reason: decided.reason };
      }
      if (decided.waitMs > 0) {
        await new Promise((r) => setTimeout(r, decided.waitMs));
      }
      this.state = markSent(this.state, decided.bucket);
      this.emit();

      const headers = new Headers(init?.headers);
      if (!headers.has("Accept")) headers.set("Accept", "application/json");
      // Browser forbids setting User-Agent; Scryfall accepts the page UA there.
      // Node / server fetches should identify the app.
      if (typeof window === "undefined") headers.set("User-Agent", SCRYFALL_UA);

      try {
        const res = await fetch(`${SCRYFALL_ORIGIN}${path}`, {
          ...init,
          headers,
        });
        this.state = markResult(this.state, path, res.status);
        this.emit();
        if (res.status === 429) {
          return {
            ok: false as const,
            reason: "HTTP 429 — paused 30s per Scryfall policy",
            status: 429,
          };
        }
        if (!res.ok) {
          return { ok: false as const, reason: `HTTP ${res.status}`, status: res.status };
        }
        return { ok: true as const, json: await res.json() };
      } catch {
        this.state = { ...this.state, lastStatus: "network", lastPath: path };
        this.emit();
        return { ok: false as const, reason: "network" };
      }
    });
  }

  getCardById(id: string) {
    return this.request(`/cards/${id}`);
  }

  getCardByTcgplayer(id: number) {
    return this.request(`/cards/tcgplayer/${id}`);
  }

  getBulkIndex() {
    return this.request("/bulk-data");
  }

  postCollection(identifiers: Array<Record<string, string>>) {
    return this.request("/cards/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifiers }),
    });
  }

  searchCards(query: string, opts?: { unique?: string; order?: string }) {
    const unique = opts?.unique ?? "cards";
    let path = `/cards/search?q=${encodeURIComponent(query)}&unique=${encodeURIComponent(unique)}`;
    if (opts?.order) path += `&order=${encodeURIComponent(opts.order)}`;
    return this.request(path);
  }
}

export const scryfall = new ScryfallClient();

export type ScryfallCardPrice = {
  id: string;
  tcgplayer_id?: number | null;
  prices?: { usd?: string | null; usd_foil?: string | null };
};
