import { useEffect, useMemo, useState } from "react";
import { PRINTINGS, SETS, printingFromScryfall, rememberPrinting, searchPrintings } from "@/lib/catalog";
import { COMBOS } from "@/lib/combos";
import { useBinder } from "@/lib/binder-store";
import { scryfall } from "@/lib/scryfall";
import { CardTile } from "@/components/card-tile";
import type { NetworkPolicy, Printing } from "@/lib/types";

function networkBlocksScryfall(policy: NetworkPolicy): string | null {
  // Manual still allows this user-initiated pull (same idea as Refresh owned prices).
  // Wi-Fi only mirrors runWorkersIfDue: skip on cellular / data-saver.
  if (typeof navigator !== "undefined" && "connection" in navigator) {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; type?: string } }).connection;
    if (policy === "wifi_only" && (conn?.saveData || conn?.type === "cellular")) {
      return "Wi-Fi only — connect to Wi-Fi (or allow mobile in Settings) to search Scryfall.";
    }
  }
  return null;
}

export function AtlasView() {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"cards" | "combos" | "cr">("cards");
  const [remoteHits, setRemoteHits] = useState<Printing[] | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const openSheet = useBinder((s) => s.openSheet);
  const rules = useBinder((s) => s.settings.rulesVersion);
  const catalogAt = useBinder((s) => s.settings.catalogFetchedAt);
  const policy = useBinder((s) => s.settings.networkPolicy);
  const cooldownUntil = useBinder((s) => s.settings.scryfallCooldownUntil);

  const localHits = useMemo(
    () => (q.trim() ? searchPrintings(q, 40) : PRINTINGS.slice(0, 36)),
    [q],
  );

  const hits = remoteHits ?? localHits;

  useEffect(() => {
    if (mode !== "cards") return;
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setRemoteHits(null);
      setSearchBusy(false);
      setSearchError(null);
      return;
    }

    // Instant local cache while the network request loads.
    setRemoteHits(null);
    setSearchError(null);

    const blocked = networkBlocksScryfall(policy);
    if (blocked) {
      setSearchBusy(false);
      setSearchError(blocked);
      return;
    }

    let cancelled = false;
    setSearchBusy(true);
    const handle = window.setTimeout(async () => {
      scryfall.restoreCooldown(cooldownUntil);
      const result = await scryfall.searchCards(trimmed, { unique: "cards" });
      if (cancelled) return;
      setSearchBusy(false);
      if (!result.ok) {
        // Scryfall returns 404 when the query matches nothing.
        if (result.status === 404) {
          setRemoteHits([]);
          setSearchError(null);
          return;
        }
        setRemoteHits(null);
        setSearchError(result.reason);
        return;
      }
      const payload = result.json as { data?: Record<string, unknown>[] };
      const mapped = (payload.data ?? []).map((card) =>
        rememberPrinting(printingFromScryfall(card)),
      );
      setRemoteHits(mapped);
      setSearchError(null);
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [q, mode, policy, cooldownUntil]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="px-4 pt-5 pb-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-faint">Atlas</p>
        <h1 className="font-display text-[28px] leading-none tracking-tight">Read-only map</h1>
        <p className="mt-2 text-sm text-muted">
          {PRINTINGS.length} printings · {SETS.length} sets · never stores qty · {rules}
        </p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Scryfall…"
          className="mt-3 h-11 w-full rounded-md bg-raised px-3 text-sm outline-none ring-1 ring-border placeholder:text-faint"
        />
        {mode === "cards" && (searchBusy || searchError) ? (
          <p className={`mt-2 text-xs ${searchError ? "text-warn" : "text-faint"}`}>
            {searchBusy ? "Searching Scryfall…" : searchError}
          </p>
        ) : null}
        <div className="mt-3 flex gap-1">
          {(["cards", "combos", "cr"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={
                mode === m
                  ? "rounded-full bg-accent px-3 py-1.5 text-sm text-accent-fg"
                  : "rounded-full px-3 py-1.5 text-sm text-muted"
              }
            >
              {m === "cr" ? "CR" : m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {mode === "cards" ? (
          hits.length ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {hits.map((p) => (
                <CardTile
                  key={p.id}
                  scryfallId={p.id}
                  subtitle={p.set.toUpperCase()}
                  onClick={() => openSheet({ kind: "printing", id: p.id })}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">
              {q.trim().length >= 2 && !searchBusy
                ? "No cards matched that query."
                : "Type at least two characters to search Scryfall."}
            </p>
          )
        ) : null}
        {mode === "combos" ? (
          <ul className="space-y-2">
            {COMBOS.map((c) => (
              <li key={c.id} className="rounded-md bg-raised p-3 ring-1 ring-border">
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-muted">{c.results}</p>
                <p className="mt-1 text-xs text-faint">
                  bracket {c.bracket} · popularity {c.popularity}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
        {mode === "cr" ? (
          <article className="space-y-3 text-sm leading-relaxed text-fg/90">
            <p className="text-xs text-faint">Packaged file · catalog {catalogAt?.slice(0, 10) ?? "local"}</p>
            <p>
              903.1. In the Commander variant, each deck is led by a legendary creature designated as its
              commander. Color identity is the colors in mana costs and rules text of that card.
            </p>
            <p>
              903.4. A card cannot be included if any of its color identity symbols sit outside the
              commander's identity.
            </p>
            <p>This excerpt is for play reference. It is not a substitute for the published CR/MTR.</p>
          </article>
        ) : null}
      </div>
    </div>
  );
}
