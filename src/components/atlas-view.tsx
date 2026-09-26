import { useMemo, useState } from "react";
import { PRINTINGS, SETS, searchPrintings } from "@/lib/catalog";
import { COMBOS } from "@/lib/combos";
import { useBinder } from "@/lib/binder-store";
import { CardTile } from "@/components/card-tile";

export function AtlasView() {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"cards" | "combos" | "cr">("cards");
  const openSheet = useBinder((s) => s.openSheet);
  const rules = useBinder((s) => s.settings.rulesVersion);
  const catalogAt = useBinder((s) => s.settings.catalogFetchedAt);
  const hits = useMemo(() => (q ? searchPrintings(q, 40) : PRINTINGS.slice(0, 36)), [q]);

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
          placeholder="Look up a card"
          className="mt-3 h-11 w-full rounded-md bg-raised px-3 text-sm outline-none ring-1 ring-border placeholder:text-faint"
        />
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
