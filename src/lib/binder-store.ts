import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { binderStorage } from "@/lib/device-storage";
import { PRINTINGS, defaultPrinting, printingById, printingForName } from "@/lib/catalog";
import { computeAdvice } from "@/lib/suggest";
import {
  ADD_BLOCK_COPY,
  basicsForIdentity,
  formatDeckText,
  isBasic,
  isLegendaryCommander,
  ownedPrintingForOracle,
  parseDeckText,
  resolveParsedLine,
  whyNotAdd,
} from "@/lib/deck";
import {
  catalogIsFresh,
  chunkIds,
  pricesAreFresh,
  scryfall,
  type ScryfallCardPrice,
} from "@/lib/scryfall";
import { uid } from "@/lib/utils";
import type {
  BinderDump,
  BinderSegment,
  BuyPin,
  CardSheetTab,
  Deck,
  DeckAdvice,
  Finish,
  InventoryRow,
  NetworkPolicy,
  PriceRow,
  RootTab,
  ScanChip,
  ScanSession,
  Settings,
  TableSegment,
} from "@/lib/types";

const SEED_VERSION = 2;

function now() {
  return new Date().toISOString();
}

function priceFromPrinting(p: (typeof PRINTINGS)[number]): PriceRow | null {
  const id = p.tcgplayer_id;
  if (!id) return null;
  const market = p.prices_usd ? Number(p.prices_usd) : null;
  return {
    tcgplayer_id: id,
    market,
    mid: market != null ? Number((market * 1.06).toFixed(2)) : null,
    low: market != null ? Number((market * 0.82).toFixed(2)) : null,
    source: "scryfall",
    fetched_at: now(),
  };
}

function seedInventory(): InventoryRow[] {
  const names = [
    ["Atraxa, Praetors' Voice", 1, "binder-a"],
    ["Sol Ring", 2, "binder-a"],
    ["Arcane Signet", 1, "binder-a"],
    ["Command Tower", 1, "binder-a"],
    ["Cultivate", 1, "binder-a"],
    ["Farseek", 1, "binder-a"],
    ["Swords to Plowshares", 1, "binder-a"],
    ["Counterspell", 1, "binder-a"],
    ["Beast Within", 1, "binder-a"],
    ["Rhystic Study", 1, "binder-a"],
    ["Cyclonic Rift", 1, "binder-a"],
    ["Smothering Tithe", 1, "binder-a"],
    ["Birds of Paradise", 1, "binder-a"],
    ["Eternal Witness", 1, "binder-a"],
    ["Lightning Greaves", 1, "box-1"],
    ["Swiftfoot Boots", 1, "box-1"],
    ["Breeding Pool", 1, "binder-a"],
    ["Hallowed Fountain", 1, "binder-a"],
    ["Temple Garden", 1, "binder-a"],
    ["Overgrown Tomb", 1, "binder-a"],
    ["Watery Grave", 1, "binder-a"],
    ["Godless Shrine", 1, "binder-a"],
    ["Exotic Orchard", 1, "binder-a"],
    ["Reliquary Tower", 1, "binder-a"],
    ["Forest", 8, "land-box"],
    ["Island", 6, "land-box"],
    ["Plains", 4, "land-box"],
    ["Swamp", 4, "land-box"],
    ["Thassa's Oracle", 1, "binder-a"],
    ["Dualcaster Mage", 1, "box-1"],
    ["Twinflame", 0, "box-1"],
    ["Krenko, Mob Boss", 1, "box-1"],
    ["Lightning Bolt", 4, "box-1"],
    ["Kiki-Jiki, Mirror Breaker", 1, "box-1"],
    ["Restoration Angel", 1, "box-1"],
  ] as const;

  const rows: InventoryRow[] = [];
  const t = now();
  for (const [name, qty, loc] of names) {
    if (!qty) continue;
    const p = printingForName(name);
    if (!p) continue;
    rows.push({
      id: uid("inv"),
      scryfall_id: p.id,
      foil: "nonfoil",
      condition: "nm",
      lang: "en",
      qty,
      location: loc,
      notes: "",
      added_at: t,
      updated_at: t,
    });
  }
  return rows;
}

function seedDecks(): Deck[] {
  const atraxa = printingForName("Atraxa, Praetors' Voice");
  const krenko = printingForName("Krenko, Mob Boss");
  const t = now();
  const pick = (name: string, qty = 1): Deck["cards"][number] | null => {
    const p = printingForName(name);
    if (!p) return null;
    return { oracle_id: p.oracle_id, qty, preferred_printing_id: p.id, board: "main" };
  };
  const cards = [
    pick("Sol Ring"),
    pick("Arcane Signet"),
    pick("Command Tower"),
    pick("Cultivate"),
    pick("Farseek"),
    pick("Swords to Plowshares"),
    pick("Counterspell"),
    pick("Beast Within"),
    pick("Rhystic Study"),
    pick("Smothering Tithe"),
    pick("Birds of Paradise"),
    pick("Eternal Witness"),
    pick("Lightning Greaves"),
    pick("Breeding Pool"),
    pick("Hallowed Fountain"),
    pick("Temple Garden"),
    pick("Overgrown Tomb"),
    pick("Watery Grave"),
    pick("Godless Shrine"),
    pick("Exotic Orchard"),
    pick("Reliquary Tower"),
    pick("Forest", 4),
    pick("Island", 3),
    pick("Plains", 2),
    pick("Swamp", 2),
    pick("Thassa's Oracle"),
  ].filter((c): c is NonNullable<typeof c> => Boolean(c));

  return [
    {
      id: "deck_atraxa",
      name: "Atraxa — counters",
      format: "commander",
      commanders: atraxa ? [atraxa.id] : [],
      colors: atraxa?.color_identity ?? ["W", "U", "B", "G"],
      revision: 1,
      tier_label: "Bracket 3 · precon-plus",
      tier_as_of: t.slice(0, 10),
      salt_note: "Consultation line parked, not armed.",
      created_at: t,
      updated_at: t,
      cards,
    },
    {
      id: "deck_krenko",
      name: "Krenko goblins",
      format: "commander",
      commanders: krenko ? [krenko.id] : [],
      colors: ["R"],
      revision: 1,
      tier_label: "Casual kitchen",
      tier_as_of: t.slice(0, 10),
      salt_note: null,
      created_at: t,
      updated_at: t,
      cards: [pick("Sol Ring"), pick("Lightning Bolt", 1), pick("Swiftfoot Boots"), pick("Mountain", 8)].filter(
        (c): c is NonNullable<typeof c> => Boolean(c),
      ),
    },
  ];
}

function seedPrices(): PriceRow[] {
  const out: PriceRow[] = [];
  const seen = new Set<number>();
  for (const p of PRINTINGS) {
    const row = priceFromPrinting(p);
    if (!row || seen.has(row.tcgplayer_id)) continue;
    seen.add(row.tcgplayer_id);
    out.push(row);
  }
  return out;
}

const defaultSettings = (): Settings => ({
  networkPolicy: "wifi_only",
  collectionOnlyAdvice: false,
  lastRoot: "binder",
  lastBinderSegment: "faces",
  lastTableSegment: "list",
  lastDeckId: "deck_atraxa",
  lastSearch: "",
  catalogFetchedAt: now(),
  pricesFetchedAt: now(),
  edhrecFetchedAt: now(),
  comboIndexAt: now(),
  rulesVersion: "CR 2026-03-07",
  notificationsAsked: false,
  seedVersion: SEED_VERSION,
  scryfallCooldownUntil: null,
  scryfallLastCall: null,
  scryfallLastResult: null,
});

type SheetTarget = { kind: "printing" | "oracle"; id: string } | null;

type BinderState = {
  inventory: InventoryRow[];
  decks: Deck[];
  prices: PriceRow[];
  buyPins: BuyPin[];
  sessions: ScanSession[];
  advice: DeckAdvice[];
  settings: Settings;
  root: RootTab;
  binderSegment: BinderSegment;
  tableSegment: TableSegment;
  sheetTab: CardSheetTab;
  search: string;
  colorChip: string | null;
  typeChip: string | null;
  setChip: string | null;
  finishChip: Finish | null;
  activeDeckId: string | null;
  sheet: SheetTarget;
  chooser: { candidates: string[]; raw: string } | null;
  cameraOn: boolean;
  cameraDenied: boolean;
  syncBusy: string | null;
  toast: string | null;

  hydrateAdvice: () => void;
  setRoot: (t: RootTab) => void;
  setBinderSegment: (s: BinderSegment) => void;
  setTableSegment: (s: TableSegment) => void;
  setSearch: (q: string) => void;
  setChips: (p: Partial<Pick<BinderState, "colorChip" | "typeChip" | "setChip" | "finishChip">>) => void;
  setActiveDeck: (id: string) => void;
  openSheet: (target: SheetTarget) => void;
  closeSheet: () => void;
  setSheetTab: (t: CardSheetTab) => void;
  setCamera: (on: boolean, denied?: boolean) => void;
  setPolicy: (p: NetworkPolicy) => void;
  setCollectionOnly: (v: boolean) => void;
  bumpQty: (scryfallId: string, foil: Finish, delta: number, location?: string) => InventoryRow | null;
  setQty: (rowId: string, qty: number) => void;
  setLocation: (rowId: string, location: string) => void;
  addFromSearch: (scryfallId: string, foil?: Finish) => void;
  confirmScan: (scryfallId: string, foil: Finish, confidence: number, photo?: string | null) => void;
  closeChooser: () => void;
  addToDeck: (oracleId: string, preferredPrintingId?: string | null) => boolean;
  removeFromDeck: (oracleId: string) => void;
  setDeckQty: (oracleId: string, qty: number) => void;
  createDeck: (name: string, format: Deck["format"], commanderId?: string | null) => string;
  renameDeck: (id: string, name: string) => void;
  duplicateDeck: (id: string) => string | null;
  deleteDeck: (id: string) => void;
  setCommander: (printingId: string) => void;
  importDeckText: (text: string) => void;
  exportDeckText: () => string;
  addBasics: (targetLands?: number) => void;
  pinBuy: (oracleId: string, kind: BuyPin["kind"]) => void;
  unpinBuy: (id: string) => void;
  refreshPrice: (key: { tcgplayerId?: number | null; scryfallId?: string }) => Promise<void>;
  refreshOwnedPrices: (opts?: { force?: boolean }) => Promise<void>;
  runWorkersIfDue: () => Promise<void>;
  downloadCatalogMeta: () => Promise<void>;
  exportDump: () => BinderDump;
  importDump: (dump: BinderDump) => void;
  resetDemo: () => void;
  clearToast: () => void;
};

function applyGate(settings: Settings): Settings {
  const snap = scryfall.snapshot();
  return {
    ...settings,
    scryfallCooldownUntil: snap.cooldownUntil > Date.now() ? new Date(snap.cooldownUntil).toISOString() : null,
    scryfallLastCall: snap.lastAt,
    scryfallLastResult: snap.lastStatus
      ? `${snap.lastStatus}${snap.lastPath ? ` ${snap.lastPath}` : ""}`
      : settings.scryfallLastResult,
  };
}

function priceRowFromCard(card: ScryfallCardPrice, existing?: PriceRow): PriceRow | null {
  const id = card.tcgplayer_id ?? existing?.tcgplayer_id;
  if (!id) return null;
  const market = card.prices?.usd ? Number(card.prices.usd) : existing?.market ?? null;
  return {
    tcgplayer_id: id,
    market,
    mid: market != null ? Number((market * 1.06).toFixed(2)) : existing?.mid ?? null,
    low: market != null ? Number((market * 0.82).toFixed(2)) : existing?.low ?? null,
    source: "scryfall",
    fetched_at: now(),
  };
}
const LAST_ADD = new Map<string, number>();
let adviceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAdvice(get: () => BinderState, set: (p: Partial<BinderState>) => void) {
  if (adviceTimer) clearTimeout(adviceTimer);
  adviceTimer = setTimeout(() => {
    const s = get();
    const next = s.decks.map((d) => {
      const cached = s.advice.find((a) => a.deck_id === d.id && a.revision === d.revision);
      return cached ?? computeAdvice(d, s.inventory, s.settings.collectionOnlyAdvice);
    });
    set({ advice: next });
  }, 250);
}

export const useBinder = create<BinderState>()(
  persist(
    (set, get) => ({
      inventory: seedInventory(),
      decks: seedDecks(),
      prices: seedPrices(),
      buyPins: [],
      sessions: [],
      advice: [],
      settings: defaultSettings(),
      root: "binder",
      binderSegment: "faces",
      tableSegment: "list",
      sheetTab: "copy",
      search: "",
      colorChip: null,
      typeChip: null,
      setChip: null,
      finishChip: null,
      activeDeckId: "deck_atraxa",
      sheet: null,
      chooser: null,
      cameraOn: false,
      cameraDenied: false,
      syncBusy: null,
      toast: null,

      hydrateAdvice: () => scheduleAdvice(get, set),

      setRoot: (t) => {
        set({ root: t, cameraOn: t === "lens" ? get().cameraOn : false });
        set({ settings: { ...get().settings, lastRoot: t } });
      },
      setBinderSegment: (s) => {
        set({ binderSegment: s, settings: { ...get().settings, lastBinderSegment: s } });
      },
      setTableSegment: (s) => {
        set({ tableSegment: s, settings: { ...get().settings, lastTableSegment: s } });
      },
      setSearch: (q) => {
        set({ search: q, settings: { ...get().settings, lastSearch: q } });
      },
      setChips: (p) => set(p),
      setActiveDeck: (id) => {
        set({ activeDeckId: id, settings: { ...get().settings, lastDeckId: id } });
      },
      openSheet: (target) => set({ sheet: target, sheetTab: "copy" }),
      closeSheet: () => set({ sheet: null }),
      setSheetTab: (t) => set({ sheetTab: t }),
      setCamera: (on, denied) =>
        set({ cameraOn: on, cameraDenied: denied ?? get().cameraDenied }),
      setPolicy: (p) => set({ settings: { ...get().settings, networkPolicy: p } }),
      setCollectionOnly: (v) => {
        set({ settings: { ...get().settings, collectionOnlyAdvice: v } });
        scheduleAdvice(get, set);
      },

      bumpQty: (scryfallId, foil, delta, location = "inbox") => {
        const t = now();
        const inv = [...get().inventory];
        const idx = inv.findIndex((r) => r.scryfall_id === scryfallId && r.foil === foil);
        if (idx >= 0) {
          const nextQty = Math.max(0, inv[idx].qty + delta);
          if (nextQty === 0) inv.splice(idx, 1);
          else inv[idx] = { ...inv[idx], qty: nextQty, updated_at: t };
        } else if (delta > 0) {
          inv.unshift({
            id: uid("inv"),
            scryfall_id: scryfallId,
            foil,
            condition: "nm",
            lang: printingById(scryfallId)?.lang ?? "en",
            qty: delta,
            location,
            notes: "",
            added_at: t,
            updated_at: t,
          });
        }
        set({ inventory: inv });
        scheduleAdvice(get, set);
        return inv.find((r) => r.scryfall_id === scryfallId && r.foil === foil) ?? null;
      },

      setQty: (rowId, qty) => {
        const inv = get().inventory
          .map((r) => (r.id === rowId ? { ...r, qty: Math.max(0, qty), updated_at: now() } : r))
          .filter((r) => r.qty > 0);
        set({ inventory: inv });
        scheduleAdvice(get, set);
      },

      setLocation: (rowId, location) => {
        set({
          inventory: get().inventory.map((r) =>
            r.id === rowId ? { ...r, location, updated_at: now() } : r,
          ),
        });
      },

      addFromSearch: (scryfallId, foil = "nonfoil") => {
        get().bumpQty(scryfallId, foil, 1, "inbox");
        const p = printingById(scryfallId);
        set({ toast: p ? `Added ${p.name}` : "Added printing" });
      },

      confirmScan: (scryfallId, foil, confidence, photo) => {
        const key = `${scryfallId}:${foil}`;
        const last = LAST_ADD.get(key) ?? 0;
        if (Date.now() - last < 1600) {
          set({ toast: "Held — already counted" });
          return;
        }
        LAST_ADD.set(key, Date.now());
        if (confidence < 0.72) {
          const p = printingById(scryfallId);
          const sibs = p
            ? PRINTINGS.filter((x) => x.oracle_id === p.oracle_id).map((x) => x.id).slice(0, 6)
            : [scryfallId];
          set({ chooser: { candidates: sibs, raw: p?.name ?? "unknown" } });
          return;
        }
        get().bumpQty(scryfallId, foil, 1, "inbox");
        const sessions = [...get().sessions];
        let sess = sessions[0];
        if (!sess) {
          sess = { id: uid("scan"), started_at: now(), chips: [] };
          sessions.unshift(sess);
        }
        const chip: ScanChip = {
          id: uid("chip"),
          scryfall_id: scryfallId,
          foil,
          qty: 1,
          confidence,
          at: now(),
          photo: photo ?? null,
        };
        sess = { ...sess, chips: [chip, ...sess.chips].slice(0, 24) };
        sessions[0] = sess;
        const p = printingById(scryfallId);
        set({ sessions, toast: p ? `${p.name} · ${p.set.toUpperCase()} ${p.collector_number}` : "Logged" });
      },

      closeChooser: () => set({ chooser: null }),

      addToDeck: (oracleId, preferredPrintingId) => {
        const id = get().activeDeckId;
        if (!id) {
          set({ toast: ADD_BLOCK_COPY["no-deck"] });
          return false;
        }
        const deck = get().decks.find((d) => d.id === id);
        const printing =
          (preferredPrintingId ? printingById(preferredPrintingId) : null) ??
          ownedPrintingForOracle(oracleId, get().inventory) ??
          defaultPrinting(oracleId);
        if (!deck || !printing) {
          set({ toast: ADD_BLOCK_COPY.missing });
          return false;
        }
        const block = whyNotAdd(deck, printing);
        if (block) {
          set({ toast: ADD_BLOCK_COPY[block] });
          return false;
        }
        const pref = preferredPrintingId ?? printing.id;
        const decks = get().decks.map((d) => {
          if (d.id !== id) return d;
          const existing = d.cards.find((c) => c.oracle_id === oracleId && c.board !== "maybe");
          const cards = existing
            ? d.cards.map((c) =>
                c.oracle_id === oracleId && c.board !== "maybe" ? { ...c, qty: c.qty + 1 } : c,
              )
            : [
                ...d.cards,
                {
                  oracle_id: oracleId,
                  qty: 1,
                  preferred_printing_id: pref,
                  board: "main" as const,
                },
              ];
          return { ...d, cards, revision: d.revision + 1, updated_at: now() };
        });
        set({ decks, toast: `On the list · ${printing.name}` });
        scheduleAdvice(get, set);
        return true;
      },

      removeFromDeck: (oracleId) => {
        const id = get().activeDeckId;
        if (!id) return;
        const decks = get().decks.map((d) => {
          if (d.id !== id) return d;
          const cards = d.cards
            .map((c) => (c.oracle_id === oracleId ? { ...c, qty: c.qty - 1 } : c))
            .filter((c) => c.qty > 0);
          return { ...d, cards, revision: d.revision + 1, updated_at: now() };
        });
        set({ decks });
        scheduleAdvice(get, set);
      },

      setDeckQty: (oracleId, qty) => {
        const id = get().activeDeckId;
        if (!id) return;
        const next = Math.max(0, Math.floor(qty));
        const decks = get().decks.map((d) => {
          if (d.id !== id) return d;
          const cards =
            next === 0
              ? d.cards.filter((c) => c.oracle_id !== oracleId)
              : d.cards.map((c) => (c.oracle_id === oracleId ? { ...c, qty: next } : c));
          return { ...d, cards, revision: d.revision + 1, updated_at: now() };
        });
        set({ decks });
        scheduleAdvice(get, set);
      },

      createDeck: (name, format, commanderId) => {
        const t = now();
        const commander = commanderId ? printingById(commanderId) : null;
        const deck: Deck = {
          id: uid("deck"),
          name: name.trim() || "Untitled",
          format,
          commanders: commander ? [commander.id] : [],
          colors: commander?.color_identity ?? [],
          revision: 1,
          tier_label: null,
          tier_as_of: null,
          salt_note: null,
          created_at: t,
          updated_at: t,
          cards: [],
        };
        set({
          decks: [deck, ...get().decks],
          activeDeckId: deck.id,
          tableSegment: "list",
          settings: { ...get().settings, lastDeckId: deck.id, lastTableSegment: "list" },
          toast: commander ? `${deck.name} · ${commander.name}` : `${deck.name} on the table`,
        });
        scheduleAdvice(get, set);
        return deck.id;
      },

      renameDeck: (id, name) => {
        const n = name.trim();
        if (!n) return;
        set({
          decks: get().decks.map((d) => (d.id === id ? { ...d, name: n, updated_at: now() } : d)),
        });
      },

      duplicateDeck: (id) => {
        const src = get().decks.find((d) => d.id === id);
        if (!src) return null;
        const t = now();
        const copy: Deck = {
          ...src,
          id: uid("deck"),
          name: `${src.name} copy`,
          revision: 1,
          created_at: t,
          updated_at: t,
          cards: src.cards.map((c) => ({ ...c })),
        };
        set({
          decks: [copy, ...get().decks],
          activeDeckId: copy.id,
          settings: { ...get().settings, lastDeckId: copy.id },
          toast: `Copied ${src.name}`,
        });
        scheduleAdvice(get, set);
        return copy.id;
      },

      deleteDeck: (id) => {
        const decks = get().decks.filter((d) => d.id !== id);
        const next = decks[0]?.id ?? null;
        set({
          decks,
          activeDeckId: get().activeDeckId === id ? next : get().activeDeckId,
          settings: { ...get().settings, lastDeckId: next },
          toast: "Deck off the table",
        });
        scheduleAdvice(get, set);
      },

      setCommander: (printingId) => {
        const id = get().activeDeckId;
        const p = printingById(printingId);
        if (!id || !p) return;
        const decks = get().decks.map((d) => {
          if (d.id !== id) return d;
          const cards = d.cards.filter((c) => c.oracle_id !== p.oracle_id);
          return {
            ...d,
            commanders: [p.id],
            colors: p.color_identity,
            cards,
            revision: d.revision + 1,
            updated_at: now(),
          };
        });
        set({ decks, toast: `Commander · ${p.name}` });
        scheduleAdvice(get, set);
      },

      importDeckText: (text) => {
        const id = get().activeDeckId;
        if (!id) {
          set({ toast: ADD_BLOCK_COPY["no-deck"] });
          return;
        }
        const lines = parseDeckText(text);
        if (!lines.length) {
          set({ toast: "No cards in that list" });
          return;
        }
        let added = 0;
        let missed = 0;
        const decks = get().decks.map((d) => {
          if (d.id !== id) return d;
          let next = { ...d, cards: d.cards.map((c) => ({ ...c })) };
          for (const line of lines) {
            const p = resolveParsedLine(line);
            if (!p) {
              missed += 1;
              continue;
            }
            if (line.board === "command" || (isLegendaryCommander(p) && !next.commanders.length)) {
              next = {
                ...next,
                commanders: [p.id],
                colors: p.color_identity,
                cards: next.cards.filter((c) => c.oracle_id !== p.oracle_id),
              };
              added += 1;
              continue;
            }
            const block = whyNotAdd(next, p);
            if (block && block !== "singleton" && block !== "full") {
              missed += 1;
              continue;
            }
            const existing = next.cards.find((c) => c.oracle_id === p.oracle_id && c.board === line.board);
            const qty = isBasic(p) || next.format !== "commander" ? line.qty : Math.min(line.qty, 1);
            if (existing) {
              existing.qty = next.format === "commander" && !isBasic(p) ? 1 : existing.qty + qty;
            } else {
              next.cards.push({
                oracle_id: p.oracle_id,
                qty,
                preferred_printing_id: p.id,
                board: line.board,
              });
            }
            added += 1;
          }
          return { ...next, revision: next.revision + 1, updated_at: now() };
        });
        set({
          decks,
          toast: missed ? `Imported ${added} · skipped ${missed}` : `Imported ${added}`,
        });
        scheduleAdvice(get, set);
      },

      exportDeckText: () => {
        const deck = get().decks.find((d) => d.id === get().activeDeckId);
        return deck ? formatDeckText(deck) : "";
      },

      addBasics: (targetLands = 36) => {
        const id = get().activeDeckId;
        const deck = get().decks.find((d) => d.id === id);
        if (!id || !deck) return;
        const names = basicsForIdentity(deck.colors);
        if (!names.length) return;
        let lands = 0;
        for (const c of deck.cards) {
          if (c.board === "maybe") continue;
          const p = defaultPrinting(c.oracle_id);
          if (p?.type_line.includes("Land")) lands += c.qty;
        }
        let need = Math.max(0, targetLands - lands);
        if (!need) {
          set({ toast: "Land count already there" });
          return;
        }
        const per = Math.floor(need / names.length);
        let rem = need - per * names.length;
        const decks = get().decks.map((d) => {
          if (d.id !== id) return d;
          const cards = d.cards.map((c) => ({ ...c }));
          for (const name of names) {
            const p = printingForName(name);
            if (!p) continue;
            const add = per + (rem > 0 ? 1 : 0);
            if (rem > 0) rem -= 1;
            if (!add) continue;
            const owned = ownedPrintingForOracle(p.oracle_id, get().inventory);
            const existing = cards.find((c) => c.oracle_id === p.oracle_id && c.board === "main");
            if (existing) existing.qty += add;
            else
              cards.push({
                oracle_id: p.oracle_id,
                qty: add,
                preferred_printing_id: owned?.id ?? p.id,
                board: "main",
              });
          }
          return { ...d, cards, revision: d.revision + 1, updated_at: now() };
        });
        set({ decks, toast: `Basics to ${targetLands} lands` });
        scheduleAdvice(get, set);
      },

      pinBuy: (oracleId, kind) => {
        const deck_id = get().activeDeckId ?? "";
        if (get().buyPins.some((p) => p.oracle_id === oracleId && p.deck_id === deck_id)) return;
        set({
          buyPins: [
            { id: uid("pin"), oracle_id: oracleId, kind, deck_id, created_at: now() },
            ...get().buyPins,
          ],
        });
      },

      unpinBuy: (id) => set({ buyPins: get().buyPins.filter((p) => p.id !== id) }),

      refreshPrice: async ({ tcgplayerId, scryfallId }) => {
        scryfall.restoreCooldown(get().settings.scryfallCooldownUntil);
        const printing = scryfallId
          ? printingById(scryfallId)
          : PRINTINGS.find((p) => p.tcgplayer_id === tcgplayerId);
        if (!printing) {
          set({ toast: "No printing for that market id" });
          return;
        }
        set({ syncBusy: "single-price" });
        const result = printing.tcgplayer_id
          ? await scryfall.getCardByTcgplayer(printing.tcgplayer_id)
          : await scryfall.getCardById(printing.id);
        if (!result.ok) {
          set({
            syncBusy: null,
            toast: result.reason,
            settings: applyGate(get().settings),
          });
          return;
        }
        const card = result.json as ScryfallCardPrice;
        const next = priceRowFromCard(card, get().prices.find((r) => r.tcgplayer_id === card.tcgplayer_id));
        const prices = next
          ? [
              next,
              ...get().prices.filter((r) => r.tcgplayer_id !== next.tcgplayer_id),
            ]
          : get().prices;
        set({
          prices,
          syncBusy: null,
          toast: next ? `Market ${printing.name}` : "No tcgplayer id on that print",
          settings: { ...applyGate(get().settings), pricesFetchedAt: get().settings.pricesFetchedAt },
        });
      },

      refreshOwnedPrices: async (opts) => {
        const s = get().settings;
        scryfall.restoreCooldown(s.scryfallCooldownUntil);
        if (!opts?.force && pricesAreFresh(s.pricesFetchedAt)) {
          set({
            toast: "Owned prices still inside the 24h Scryfall window",
            settings: applyGate(s),
          });
          return;
        }
        const owned = get()
          .inventory.map((r) => printingById(r.scryfall_id))
          .filter((p): p is NonNullable<typeof p> => Boolean(p));
        const identifiers = owned.map((p) => ({ id: p.id }));
        if (!identifiers.length) {
          set({ toast: "No owned printings to price" });
          return;
        }
        set({ syncBusy: "owned-prices" });
        const batches = chunkIds(identifiers);
        const byTcg = new Map(get().prices.map((p) => [p.tcgplayer_id, p]));
        let blocked: string | null = null;
        for (const batch of batches) {
          const result = await scryfall.postCollection(batch);
          if (!result.ok) {
            blocked = result.reason;
            break;
          }
          const data = result.json as { data?: ScryfallCardPrice[] };
          for (const card of data.data ?? []) {
            const row = priceRowFromCard(card, card.tcgplayer_id ? byTcg.get(card.tcgplayer_id) : undefined);
            if (row) byTcg.set(row.tcgplayer_id, row);
          }
        }
        set({
          prices: [...byTcg.values()],
          syncBusy: null,
          toast: blocked ?? `Owned prices · ${batches.length} collection batch${batches.length === 1 ? "" : "es"}`,
          settings: {
            ...applyGate(get().settings),
            pricesFetchedAt: blocked ? get().settings.pricesFetchedAt : now(),
          },
        });
      },

      downloadCatalogMeta: async () => {
        scryfall.restoreCooldown(get().settings.scryfallCooldownUntil);
        set({ syncBusy: "catalog" });
        const result = await scryfall.getBulkIndex();
        if (!result.ok) {
          set({
            syncBusy: null,
            toast: result.reason,
            settings: applyGate(get().settings),
          });
          return;
        }
        const payload = result.json as { data?: Array<{ type?: string; updated_at?: string }> };
        const def = payload.data?.find((x) => x.type === "default_cards") ?? payload.data?.[0];
        set({
          syncBusy: null,
          toast: def?.updated_at
            ? `Bulk index ${def.updated_at.slice(0, 10)} — full file not pulled`
            : "Bulk index ok",
          settings: { ...applyGate(get().settings), catalogFetchedAt: now() },
        });
      },

      runWorkersIfDue: async () => {
        const s = get().settings;
        if (s.networkPolicy === "manual") return;
        scryfall.restoreCooldown(s.scryfallCooldownUntil);
        if (typeof navigator !== "undefined" && "connection" in navigator) {
          const conn = (navigator as Navigator & { connection?: { saveData?: boolean; type?: string } }).connection;
          if (s.networkPolicy === "wifi_only" && (conn?.saveData || conn?.type === "cellular")) {
            set({ toast: "Workers idle — Wi-Fi only" });
            return;
          }
        }
        if (!catalogIsFresh(s.catalogFetchedAt)) {
          await get().downloadCatalogMeta();
        }
        if (!pricesAreFresh(get().settings.pricesFetchedAt)) {
          await get().refreshOwnedPrices();
        }
      },

      exportDump: () => {
        const s = get();
        return {
          inventory: s.inventory,
          decks: s.decks,
          prices: s.prices,
          buyPins: s.buyPins,
          sessions: s.sessions,
          advice: s.advice,
          settings: s.settings,
        };
      },

      importDump: (dump) => {
        set({
          inventory: dump.inventory ?? [],
          decks: dump.decks ?? [],
          prices: dump.prices ?? get().prices,
          buyPins: dump.buyPins ?? [],
          sessions: dump.sessions ?? [],
          advice: dump.advice ?? [],
          settings: { ...defaultSettings(), ...dump.settings, seedVersion: SEED_VERSION },
        });
        scheduleAdvice(get, set);
      },

      resetDemo: () => {
        set({
          inventory: seedInventory(),
          decks: seedDecks(),
          prices: seedPrices(),
          buyPins: [],
          sessions: [],
          advice: [],
          settings: defaultSettings(),
          activeDeckId: "deck_atraxa",
          toast: "Demo binder restored",
        });
        scheduleAdvice(get, set);
      },

      clearToast: () => set({ toast: null }),
    }),
    {
      name: "wubrger.binder.v1",
      storage: createJSONStorage(() => binderStorage()),
      partialize: (s) => ({
        inventory: s.inventory,
        decks: s.decks,
        prices: s.prices,
        buyPins: s.buyPins,
        sessions: s.sessions,
        advice: s.advice,
        settings: s.settings,
        root: s.root,
        binderSegment: s.binderSegment,
        tableSegment: s.tableSegment,
        search: s.search,
        activeDeckId: s.activeDeckId,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.settings = { ...defaultSettings(), ...state.settings };
        scryfall.restoreCooldown(state.settings.scryfallCooldownUntil);
        if (state.settings.seedVersion !== SEED_VERSION && state.inventory.length === 0) {
          state.resetDemo();
        }
        queueMicrotask(() => {
          useBinder.getState().hydrateAdvice();
          useBinder.getState().runWorkersIfDue();
        });
      },
    },
  ),
);

export function useActiveDeck() {
  return useBinder((s) => s.decks.find((d) => d.id === s.activeDeckId) ?? s.decks[0] ?? null);
}

export function useDeckAdvice() {
  const deck = useActiveDeck();
  return useBinder((s) => {
    if (!deck) return null;
    return s.advice.find((a) => a.deck_id === deck.id && a.revision === deck.revision) ??
      s.advice.find((a) => a.deck_id === deck.id) ??
      null;
  });
}

export function ownedQtyForOracle(oracleId: string, inventory: InventoryRow[]) {
  let n = 0;
  for (const row of inventory) {
    const p = printingById(row.scryfall_id);
    if (p?.oracle_id === oracleId) n += row.qty;
  }
  return n;
}

export function priceForPrinting(p: (typeof PRINTINGS)[number] | undefined, prices: PriceRow[]) {
  if (!p) return null;
  if (p.tcgplayer_id) {
    const hit = prices.find((x) => x.tcgplayer_id === p.tcgplayer_id);
    if (hit) return hit;
  }
  const usd = p.prices_usd ? Number(p.prices_usd) : null;
  if (usd == null) return null;
  return {
    tcgplayer_id: p.tcgplayer_id ?? 0,
    market: usd,
    mid: Number((usd * 1.06).toFixed(2)),
    low: Number((usd * 0.82).toFixed(2)),
    source: "scryfall" as const,
    fetched_at: p.released_at,
  };
}
