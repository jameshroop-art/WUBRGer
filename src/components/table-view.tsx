import { useMemo, useState } from "react";
import { comboById } from "@/lib/combos";
import { defaultPrinting, printingById } from "@/lib/catalog";
import {
  deckIssues,
  deckTotal,
  formatTarget,
  groupDeckCards,
  landQty,
  searchCommanders,
  searchOwnedFirst,
} from "@/lib/deck";
import {
  ownedQtyForOracle,
  priceForPrinting,
  useActiveDeck,
  useBinder,
  useDeckAdvice,
} from "@/lib/binder-store";
import { ageLabel, cn, formatUsd } from "@/lib/utils";
import { CardTile } from "@/components/card-tile";
import { ManaPips } from "@/components/mana";
import type { Deck, TableSegment } from "@/lib/types";

const SEGS: { id: TableSegment; label: string }[] = [
  { id: "list", label: "List" },
  { id: "own", label: "Own" },
  { id: "synergy", label: "Synergy" },
  { id: "combos", label: "Combos" },
  { id: "power", label: "Power" },
  { id: "test", label: "Test" },
];

export function TableView() {
  const decks = useBinder((s) => s.decks);
  const deck = useActiveDeck();
  const setDeck = useBinder((s) => s.setActiveDeck);
  const seg = useBinder((s) => s.tableSegment);
  const setSeg = useBinder((s) => s.setTableSegment);
  const createDeck = useBinder((s) => s.createDeck);
  const [making, setMaking] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 px-4 pt-5 pb-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-faint">Table</p>
        <div className="mt-1 flex items-center gap-2 overflow-x-auto">
          {decks.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDeck(d.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-sm",
                d.id === deck?.id ? "bg-accent text-accent-fg" : "bg-raised text-muted ring-1 ring-border",
              )}
            >
              {d.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMaking(true)}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm text-accent ring-1 ring-border"
          >
            New
          </button>
        </div>
      </header>

      {making ? <NewDeckForm onClose={() => setMaking(false)} onCreate={createDeck} /> : null}

      {!deck ? (
        <p className="px-4 text-muted">Put a commander on the table to start a list.</p>
      ) : (
        <DeckBody deck={deck} seg={seg} setSeg={setSeg} />
      )}
    </div>
  );
}

function NewDeckForm({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, format: Deck["format"], commanderId?: string | null) => string;
}) {
  const [name, setName] = useState("");
  const [format, setFormat] = useState<Deck["format"]>("commander");
  const [q, setQ] = useState("");
  const [commanderId, setCommanderId] = useState<string | null>(null);
  const hits = searchCommanders(q, format, 10);
  const picked = commanderId ? printingById(commanderId) : null;

  return (
    <div className="mx-4 mb-3 space-y-3 rounded-lg bg-raised p-3 ring-1 ring-border">
      <div className="flex items-center justify-between">
        <p className="font-medium">New list</p>
        <button type="button" className="text-sm text-muted" onClick={onClose}>
          Close
        </button>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Deck name"
        className="w-full rounded-md bg-bg px-3 py-2 text-sm ring-1 ring-border outline-none"
      />
      <div className="flex gap-2">
        {(["commander", "modern", "casual"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFormat(f)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs capitalize",
              format === f ? "bg-accent text-accent-fg" : "text-muted ring-1 ring-border",
            )}
          >
            {f}
          </button>
        ))}
      </div>
      {format === "commander" ? (
        <div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a commander"
            className="w-full rounded-md bg-bg px-3 py-2 text-sm ring-1 ring-border outline-none"
          />
          {picked ? (
            <p className="mt-2 text-sm text-muted">
              {picked.name} · {picked.color_identity.join("") || "C"}
            </p>
          ) : null}
          <ul className="mt-2 max-h-40 overflow-y-auto">
            {hits.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setCommanderId(p.id);
                    if (!name) setName(p.name);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm",
                    commanderId === p.id ? "bg-accent/20" : "",
                  )}
                >
                  <span>{p.name}</span>
                  <ManaPips colors={p.color_identity} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <button
        type="button"
        className="w-full rounded-md bg-accent py-2 text-sm text-accent-fg"
        onClick={() => {
          onCreate(name || picked?.name || "Untitled", format, commanderId);
          onClose();
        }}
      >
        Put on the table
      </button>
    </div>
  );
}

function DeckBody({
  deck,
  seg,
  setSeg,
}: {
  deck: Deck;
  seg: TableSegment;
  setSeg: (s: TableSegment) => void;
}) {
  const advice = useDeckAdvice();
  const inventory = useBinder((s) => s.inventory);
  const prices = useBinder((s) => s.prices);
  const openSheet = useBinder((s) => s.openSheet);
  const addToDeck = useBinder((s) => s.addToDeck);
  const removeFromDeck = useBinder((s) => s.removeFromDeck);
  const setDeckQty = useBinder((s) => s.setDeckQty);
  const pinBuy = useBinder((s) => s.pinBuy);
  const pins = useBinder((s) => s.buyPins);
  const collectionOnly = useBinder((s) => s.settings.collectionOnlyAdvice);
  const setCollectionOnly = useBinder((s) => s.setCollectionOnly);
  const refreshPrice = useBinder((s) => s.refreshPrice);
  const renameDeck = useBinder((s) => s.renameDeck);
  const duplicateDeck = useBinder((s) => s.duplicateDeck);
  const deleteDeck = useBinder((s) => s.deleteDeck);
  const setCommander = useBinder((s) => s.setCommander);
  const importDeckText = useBinder((s) => s.importDeckText);
  const exportDeckText = useBinder((s) => s.exportDeckText);
  const addBasics = useBinder((s) => s.addBasics);

  const commander = deck.commanders[0] ? printingById(deck.commanders[0]) : null;
  const total = deckTotal(deck);
  const target = formatTarget(deck.format);
  const lands = landQty(deck);
  const [menu, setMenu] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [q, setQ] = useState("");
  const [cmdQ, setCmdQ] = useState("");
  const [pickingCmd, setPickingCmd] = useState(false);

  const curve = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const c of deck.cards) {
    if (c.board === "maybe") continue;
    const p = defaultPrinting(c.oracle_id);
    const b = Math.min(7, Math.floor(p?.cmc ?? 0));
    curve[b] += c.qty;
  }
  const maxCurve = Math.max(1, ...curve);
  const groups = useMemo(() => groupDeckCards(deck), [deck]);
  const addHits = q.trim().length >= 2 ? searchOwnedFirst(q, inventory, 12) : [];
  const cmdHits = pickingCmd ? searchCommanders(cmdQ, deck.format, 10) : [];

  const ownedLegal = inventory
    .map((r) => ({ r, p: printingById(r.scryfall_id) }))
    .filter((x) => x.p)
    .filter(({ p }) => {
      if (!p) return false;
      const inDeck = deck.cards.some((c) => c.oracle_id === p.oracle_id);
      if (inDeck && deck.format === "commander" && !p.type_line.includes("Basic")) return false;
      return p.color_identity.every((c) => deck.colors.includes(c)) || deck.colors.length === 0;
    });

  async function copyList() {
    const text = exportDeckText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
    setMenu(false);
    useBinder.setState({ toast: "List copied" });
  }

  return (
    <>
      <div className="px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="font-display text-[26px] leading-none tracking-tight">{deck.name}</h1>
            <p className="mt-2 text-sm text-muted">
              {commander?.name ?? "No commander"} · {total}/{target} · {lands} lands · rev {deck.revision}
            </p>
            <div className="mt-1">
              <ManaPips colors={deck.colors} />
            </div>
          </div>
          <button
            type="button"
            className="rounded-full px-3 py-1.5 text-sm text-muted ring-1 ring-border"
            onClick={() => setMenu((v) => !v)}
          >
            Edit
          </button>
        </div>
        {menu ? (
          <div className="mt-2 space-y-2 rounded-lg bg-raised p-3 text-sm ring-1 ring-border">
            <input
              defaultValue={deck.name}
              onBlur={(e) => renameDeck(deck.id, e.target.value)}
              className="w-full rounded-md bg-bg px-3 py-2 ring-1 ring-border outline-none"
            />
            {deck.format === "commander" ? (
              <button type="button" className="text-accent" onClick={() => setPickingCmd((v) => !v)}>
                {commander ? "Change commander" : "Set commander"}
              </button>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => addBasics(deck.format === "commander" ? 36 : 24)}>
                Fill basics
              </button>
              <button type="button" onClick={() => setImportOpen(true)}>
                Import
              </button>
              <button type="button" onClick={() => void copyList()}>
                Export
              </button>
              <button type="button" onClick={() => duplicateDeck(deck.id)}>
                Duplicate
              </button>
              <button
                type="button"
                className="text-danger"
                onClick={() => {
                  deleteDeck(deck.id);
                  setMenu(false);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ) : null}
        {pickingCmd ? (
          <div className="mt-2 rounded-lg bg-raised p-3 ring-1 ring-border">
            <input
              value={cmdQ}
              onChange={(e) => setCmdQ(e.target.value)}
              placeholder="Commander name"
              className="w-full rounded-md bg-bg px-3 py-2 text-sm ring-1 ring-border outline-none"
            />
            {cmdHits.map((p) => (
              <button
                key={p.id}
                type="button"
                className="mt-1 flex w-full items-center justify-between py-1.5 text-left text-sm"
                onClick={() => {
                  setCommander(p.id);
                  setPickingCmd(false);
                }}
              >
                <span>{p.name}</span>
                <ManaPips colors={p.color_identity} />
              </button>
            ))}
          </div>
        ) : null}
        {importOpen ? (
          <div className="mt-2 space-y-2 rounded-lg bg-raised p-3 ring-1 ring-border">
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={8}
              placeholder={"Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n1 Sol Ring (CMM) 410"}
              className="w-full rounded-md bg-bg px-3 py-2 font-mono text-xs ring-1 ring-border outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-fg"
                onClick={() => {
                  importDeckText(importText);
                  setImportOpen(false);
                  setImportText("");
                  setMenu(false);
                }}
              >
                Import into this list
              </button>
              <button type="button" className="text-sm text-muted" onClick={() => setImportOpen(false)}>
                Cancel
              </button>
            </div>
            <p className="text-[11px] text-faint">Does not change binder qty. Unknown names are skipped.</p>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex gap-1 overflow-x-auto px-4">
        {SEGS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSeg(s.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm",
              seg === s.id ? "bg-accent text-accent-fg" : "text-muted",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {seg === "list" ? (
          <div className="space-y-4">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Add a card — owned names first"
              className="w-full rounded-md bg-raised px-3 py-2.5 text-sm ring-1 ring-border outline-none"
            />
            {addHits.length ? (
              <ul className="space-y-1 rounded-md bg-raised p-2 ring-1 ring-border">
                {addHits.map((p) => {
                  const owned = ownedQtyForOracle(p.oracle_id, inventory);
                  return (
                    <li key={p.oracle_id} className="flex items-center gap-2">
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-sm"
                        onClick={() => openSheet({ kind: "printing", id: p.id })}
                      >
                        {p.name}
                        <span className="ml-2 text-xs text-faint">
                          {owned ? `${owned} owned` : "not owned"}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="text-sm text-accent"
                        onClick={() => {
                          addToDeck(p.oracle_id, p.id);
                          setQ("");
                        }}
                      >
                        Add
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {advice ? (
              <p className="rounded-md bg-raised px-3 py-2 text-sm text-muted ring-1 ring-border">
                {advice.rail.ownedHigh} owned high-lift · {advice.rail.combosReady} combos ready ·{" "}
                {advice.rail.oneAway} one-away
              </p>
            ) : (
              <p className="text-sm text-faint">Advice computing…</p>
            )}
            <div className="flex h-16 items-end gap-1">
              {curve.map((n, i) => (
                <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                  <div className="w-full rounded-xs bg-accent/80" style={{ height: `${(n / maxCurve) * 48}px` }} />
                  <span className="text-[10px] text-faint tabular-nums">{i === 7 ? "7+" : i}</span>
                </div>
              ))}
            </div>

            {commander ? (
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wide text-faint">Commander</p>
                <CardTile
                  scryfallId={commander.id}
                  subtitle="Commander"
                  onClick={() => openSheet({ kind: "printing", id: commander.id })}
                />
              </div>
            ) : null}

            {groups.map((g) => (
              <div key={g.type}>
                <p className="mb-2 text-[11px] uppercase tracking-wide text-faint">
                  {g.type} · {g.cards.reduce((n, c) => n + c.qty, 0)}
                </p>
                <div className="space-y-2">
                  {g.cards.map((c) => {
                    const p = defaultPrinting(c.oracle_id);
                    const owned = ownedQtyForOracle(c.oracle_id, inventory);
                    return (
                      <div
                        key={c.oracle_id}
                        className="flex items-center gap-3 rounded-md bg-raised p-2 ring-1 ring-border"
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => openSheet({ kind: "oracle", id: c.oracle_id })}
                        >
                          <p className={cn("truncate text-sm", owned === 0 && "text-muted")}>
                            {p?.name ?? c.oracle_id}
                          </p>
                          <p className="text-[11px] text-faint">
                            {owned ? `${owned} owned` : "ghost"} · {p?.mana_cost || "—"}
                          </p>
                        </button>
                        <button type="button" className="px-2 text-muted" onClick={() => removeFromDeck(c.oracle_id)}>
                          −
                        </button>
                        <span className="w-4 text-center tabular-nums text-sm">{c.qty}</span>
                        <button
                          type="button"
                          className="px-2 text-accent"
                          onClick={() => addToDeck(c.oracle_id, c.preferred_printing_id)}
                        >
                          +
                        </button>
                        <button type="button" className="text-xs text-danger" onClick={() => setDeckQty(c.oracle_id, 0)}>
                          Cut
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {seg === "own" ? (
          <div className="grid grid-cols-3 gap-3">
            {ownedLegal.map(({ r, p }) =>
              p ? (
                <div key={r.id} className="space-y-1.5">
                  <CardTile
                    scryfallId={p.id}
                    qty={r.qty}
                    onClick={() => openSheet({ kind: "printing", id: p.id })}
                  />
                  <button
                    type="button"
                    className="w-full rounded-md bg-accent py-1.5 text-xs text-accent-fg"
                    onClick={() => addToDeck(p.oracle_id, p.id)}
                  >
                    Add owned
                  </button>
                </div>
              ) : null,
            )}
          </div>
        ) : null}

        {seg === "synergy" ? (
          <div className="space-y-2">
            <label className="flex items-center justify-between text-sm text-muted">
              Collection only
              <input
                type="checkbox"
                checked={collectionOnly}
                onChange={(e) => setCollectionOnly(e.target.checked)}
              />
            </label>
            {(advice?.suggest ?? []).map((row) => {
              const p = defaultPrinting(row.oracle_id);
              if (!p) return null;
              const pr = priceForPrinting(p, prices);
              return (
                <div key={row.oracle_id} className="flex items-center gap-3 rounded-md bg-raised p-2 ring-1 ring-border">
                  <img src={p.image_small ?? ""} alt="" className="h-14 w-10 rounded-xs object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-xs text-muted">{row.reasons.join(" · ")}</p>
                  </div>
                  {row.owned ? (
                    <button type="button" className="text-sm text-accent" onClick={() => addToDeck(p.oracle_id, p.id)}>
                      Add
                    </button>
                  ) : (
                    <div className="text-right">
                      <p className="text-xs tabular-nums">{formatUsd(pr?.market)}</p>
                      <p className="text-[10px] text-faint">{ageLabel(pr?.fetched_at)}</p>
                      <button type="button" className="text-xs text-muted" onClick={() => pinBuy(p.oracle_id, "suggest")}>
                        Pin
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {seg === "combos" ? (
          <div className="space-y-3">
            {(advice?.combos ?? []).length === 0 ? (
              <p className="text-sm text-muted">No local recipes touch this list yet.</p>
            ) : null}
            {(advice?.combos ?? []).map((m) => {
              const recipe = comboById(m.combo_id);
              if (!recipe) return null;
              return (
                <article key={m.combo_id} className="rounded-lg bg-raised p-3 ring-1 ring-border">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium">{recipe.name}</h3>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] uppercase",
                        m.state === "ready" && "bg-good/20 text-good",
                        m.state === "almost" && "bg-warn/20 text-warn",
                        m.state === "buy" && "text-muted ring-1 ring-border",
                      )}
                    >
                      {m.state === "ready" ? "Ready" : m.state === "almost" ? "You can finish" : "Buy to finish"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{recipe.results}</p>
                  <ul className="mt-2 space-y-1">
                    {recipe.pieces.map((oid) => {
                      const p = defaultPrinting(oid);
                      const have = !m.missing.includes(oid);
                      const owned = ownedQtyForOracle(oid, inventory) > 0;
                      const pr = p ? priceForPrinting(p, prices) : null;
                      return (
                        <li key={oid} className="flex items-center justify-between text-sm">
                          <span className={have ? "text-fg" : "text-muted"}>{p?.name ?? oid}</span>
                          {have ? (
                            <span className="text-xs text-faint">in deck</span>
                          ) : owned ? (
                            <button type="button" className="text-accent" onClick={() => addToDeck(oid)}>
                              Add
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="text-xs text-muted"
                              onClick={() => {
                                pinBuy(oid, "combo");
                                if (p) refreshPrice({ tcgplayerId: p.tcgplayer_id, scryfallId: p.id });
                              }}
                            >
                              {formatUsd(pr?.market)} · pin
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </article>
              );
            })}
            {pins.filter((p) => p.deck_id === deck.id).length ? (
              <p className="text-xs text-faint">
                Pins do not change binder qty · {pins.filter((p) => p.deck_id === deck.id).length} on the buy list
              </p>
            ) : null}
          </div>
        ) : null}

        {seg === "power" ? (
          <div className="space-y-3">
            <p className="text-xs text-faint">Dated tags on this deck — not a card field.</p>
            <div className="rounded-lg bg-raised p-4 ring-1 ring-border">
              <p className="font-display text-2xl">{deck.tier_label ?? "Unlabeled"}</p>
              <p className="mt-1 text-sm text-muted">as of {deck.tier_as_of ?? "—"}</p>
              {deck.salt_note ? <p className="mt-3 text-sm">{deck.salt_note}</p> : null}
            </div>
          </div>
        ) : null}

        {seg === "test" ? <TestPanel deck={deck} /> : null}
      </div>
    </>
  );
}

function TestPanel({ deck }: { deck: Deck }) {
  const remove = useBinder((s) => s.removeFromDeck);
  const issues = deckIssues(deck);
  if (!issues.length) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted">
          Format {deck.format}. Identity {deck.colors.join("") || "—"}. {deckTotal(deck)}/{formatTarget(deck.format)}.
        </p>
        <p className="text-good">List holds: identity, legality, singleton, count.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Format {deck.format}. Identity {deck.colors.join("") || "—"}.
      </p>
      <ul className="space-y-1">
        {issues.map((i, idx) => (
          <li key={`${i.kind}-${i.oracle_id}-${idx}`} className="flex justify-between text-sm">
            <span>
              {i.kind === "count" ? `Count ${i.name}` : `${i.name} · ${i.kind}`}
            </span>
            {i.oracle_id ? (
              <button type="button" className="text-danger" onClick={() => remove(i.oracle_id)}>
                Cut
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
