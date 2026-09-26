import { defaultPrinting, printingById, printingsByOracle } from "@/lib/catalog";
import { combosForOracle, comboNamePieces } from "@/lib/combos";
import { priceForPrinting, useBinder, ownedQtyForOracle } from "@/lib/binder-store";
import { ageLabel, cn, formatUsd } from "@/lib/utils";
import { CardArt } from "@/components/card-tile";
import { ManaPips } from "@/components/mana";
import type { CardSheetTab } from "@/lib/types";

const TABS: { id: CardSheetTab; label: string }[] = [
  { id: "copy", label: "Copy" },
  { id: "print", label: "Print" },
  { id: "market", label: "Market" },
  { id: "play", label: "Play" },
  { id: "rules", label: "Rules" },
  { id: "combo", label: "Combo" },
];

const RULINGS: Record<string, string[]> = {
  default: [
    "Layers and timestamps follow the Comprehensive Rules on disk.",
    "Commander tax is paid in addition to the mana cost.",
  ],
};

export function CardSheet() {
  const sheet = useBinder((s) => s.sheet);
  const tab = useBinder((s) => s.sheetTab);
  const close = useBinder((s) => s.closeSheet);
  const setTab = useBinder((s) => s.setSheetTab);
  const inventory = useBinder((s) => s.inventory);
  const prices = useBinder((s) => s.prices);
  const bump = useBinder((s) => s.bumpQty);
  const addToDeck = useBinder((s) => s.addToDeck);
  const refreshPrice = useBinder((s) => s.refreshPrice);
  const policy = useBinder((s) => s.settings.networkPolicy);

  if (!sheet) return null;
  const p =
    sheet.kind === "printing" ? printingById(sheet.id) : defaultPrinting(sheet.id);
  if (!p) return null;
  const prints = printingsByOracle(p.oracle_id);
  const owned = ownedQtyForOracle(p.oracle_id, inventory);
  const price = priceForPrinting(p, prices);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-bg/70" onClick={close} aria-label="Close sheet" />
      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl bg-surface ring-1 ring-border sm:rounded-xl">
        <div className="flex items-start gap-3 p-4">
          <div className="w-20 shrink-0">
            <CardArt src={p.image_normal ?? p.image_small} name={p.name} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl leading-tight tracking-tight">{p.name}</p>
            <p className="mt-1 text-sm text-muted">{p.mana_cost || "—"} · {p.type_line}</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted">
              <ManaPips colors={p.color_identity} />
              <span>
                {p.set.toUpperCase()} {p.collector_number} · {p.rarity}
              </span>
            </div>
            <p className="mt-2 text-xs text-faint">Owned {owned} · keyed by printing</p>
          </div>
          <button type="button" onClick={close} className="text-sm text-muted">
            Close
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm",
                tab === t.id ? "bg-accent text-accent-fg" : "text-muted",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
          {tab === "copy" ? (
            <div className="space-y-3">
              <p className="whitespace-pre-wrap text-fg/90 leading-relaxed">{p.oracle_text || "No oracle text."}</p>
              <p className="text-xs text-faint">Artist {p.artist} · released {p.released_at}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-md bg-accent px-3 py-2 text-accent-fg"
                  onClick={() => bump(p.id, "nonfoil", 1)}
                >
                  Add copy
                </button>
                <button
                  type="button"
                  className="rounded-md bg-raised px-3 py-2 ring-1 ring-border"
                  onClick={() => addToDeck(p.oracle_id, p.id)}
                >
                  Put in deck
                </button>
              </div>
            </div>
          ) : null}

          {tab === "print" ? (
            <ul className="space-y-2">
              {prints.map((pr) => {
                const row = inventory.find((i) => i.scryfall_id === pr.id);
                return (
                  <li key={pr.id} className="flex items-center gap-3 rounded-md bg-raised p-2 ring-1 ring-border">
                    <img src={pr.image_small ?? ""} alt="" className="h-14 w-10 rounded-xs object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {pr.set.toUpperCase()} {pr.collector_number}
                      </p>
                      <p className="text-xs text-muted">{pr.set_name} · {pr.finishes.join("/")}</p>
                    </div>
                    <span className="tabular-nums text-muted">{row?.qty ?? 0}</span>
                    <button type="button" className="text-accent" onClick={() => bump(pr.id, "nonfoil", 1)}>
                      +
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {tab === "market" ? (
            <div className="space-y-3">
              <p className="text-xs text-muted">
                TCGPlayer-shaped market. Shown as a buy signal on gaps — owned copies stay in Value.
              </p>
              <div className="rounded-md bg-raised p-3 ring-1 ring-border">
                <p className="text-xs text-faint">
                  {price?.source ?? "scryfall"} · {ageLabel(price?.fetched_at)}
                </p>
                <p className="mt-1 font-display text-2xl tabular-nums">{formatUsd(price?.market)}</p>
                <p className="text-xs text-muted">
                  mid {formatUsd(price?.mid)} · low {formatUsd(price?.low)}
                </p>
              </div>
              <button
                type="button"
                className="rounded-md bg-accent px-3 py-2 text-accent-fg"
                onClick={() => refreshPrice({ tcgplayerId: p.tcgplayer_id, scryfallId: p.id })}
              >
                Pull this id {policy === "wifi_only" ? "(one-card, mobile ok)" : ""}
              </button>
            </div>
          ) : null}

          {tab === "play" ? (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(p.legalities).map(([k, v]) => (
                <div key={k} className="rounded-md bg-raised px-3 py-2 ring-1 ring-border">
                  <dt className="text-xs uppercase tracking-wide text-faint">{k}</dt>
                  <dd className={v === "legal" ? "text-good" : "text-muted"}>{v.replace("_", " ")}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {tab === "rules" ? (
            <div className="space-y-2">
              <p className="text-xs text-faint">Local CR 2026-03-07 · rulings by oracle_id</p>
              <ul className="space-y-2">
                {(RULINGS[p.oracle_id] ?? RULINGS.default).map((r) => (
                  <li key={r} className="rounded-md bg-raised p-3 text-sm leading-relaxed ring-1 ring-border">
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {tab === "combo" ? (
            <div className="space-y-3">
              {(() => {
                const recipes = combosForOracle(p.oracle_id);
                if (!recipes.length) {
                  return (
                    <p className="text-sm text-muted">
                      No known combos for this card in the local recipes.
                    </p>
                  );
                }
                return (
                  <ul className="space-y-3">
                    {recipes.map((c) => (
                      <li key={c.id} className="rounded-md bg-raised p-3 ring-1 ring-border">
                        <p className="font-medium">{c.name}</p>
                        <p className="mt-1 text-sm text-muted">{c.results}</p>
                        <p className="mt-1 text-xs text-faint">
                          pieces · {comboNamePieces(c).join(" · ")}
                        </p>
                        <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm leading-relaxed text-fg/90">
                          {c.steps.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ol>
                        <p className="mt-2 text-xs text-faint">
                          bracket {c.bracket} · popularity {c.popularity}
                        </p>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
