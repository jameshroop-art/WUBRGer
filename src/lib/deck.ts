import {
  PRINTINGS,
  defaultPrinting,
  identityOk,
  printingById,
  printingForName,
  resolvePrinting,
} from "@/lib/catalog";
import type { Deck, DeckCard, InventoryRow, Printing } from "@/lib/types";

export function isBasic(p: Printing | undefined | null) {
  if (!p) return false;
  return p.type_line.includes("Basic");
}

export function isLegendaryCommander(p: Printing) {
  const t = p.type_line;
  if (!t.includes("Legendary")) return false;
  return t.includes("Creature") || t.includes("Planeswalker");
}

export function formatTarget(format: Deck["format"]) {
  return format === "commander" ? 100 : 60;
}

export function mainQty(deck: Deck) {
  return deck.cards.filter((c) => c.board !== "maybe").reduce((n, c) => n + c.qty, 0);
}

export function deckTotal(deck: Deck) {
  const main = mainQty(deck);
  if (deck.format === "commander") return main + (deck.commanders[0] ? 1 : 0);
  return main;
}

export function landQty(deck: Deck) {
  let n = 0;
  for (const c of deck.cards) {
    if (c.board === "maybe") continue;
    const p = defaultPrinting(c.oracle_id);
    if (p?.type_line.includes("Land")) n += c.qty;
  }
  return n;
}

export function commanderPrinting(deck: Deck) {
  const id = deck.commanders[0];
  return id ? printingById(id) ?? defaultPrinting(id) : null;
}

export function commanderOracle(deck: Deck) {
  return commanderPrinting(deck)?.oracle_id ?? null;
}

export function ownedPrintingForOracle(oracleId: string, inventory: InventoryRow[]) {
  for (const row of inventory) {
    if (row.qty <= 0) continue;
    const p = printingById(row.scryfall_id);
    if (p?.oracle_id === oracleId) return p;
  }
  return defaultPrinting(oracleId);
}

const BASIC_BY_COLOR: Record<string, string> = {
  W: "Plains",
  U: "Island",
  B: "Swamp",
  R: "Mountain",
  G: "Forest",
};

export function basicsForIdentity(colors: string[]) {
  if (!colors.length) return ["Wastes"];
  return colors.map((c) => BASIC_BY_COLOR[c]).filter(Boolean);
}

export type AddBlock =
  | "no-deck"
  | "singleton"
  | "identity"
  | "legal"
  | "full"
  | "commander-slot"
  | "missing";

export function whyNotAdd(deck: Deck, printing: Printing): AddBlock | null {
  const cmd = commanderOracle(deck);
  if (cmd && printing.oracle_id === cmd) return "commander-slot";
  const legal = printing.legalities[deck.format] ?? printing.legalities.commander;
  if (deck.format === "commander" && legal === "not_legal") return "legal";
  if (legal === "banned") return "legal";
  if (deck.colors.length && !identityOk(printing.color_identity, deck.colors)) return "identity";
  const existing = deck.cards.find((c) => c.oracle_id === printing.oracle_id && c.board !== "maybe");
  if (existing && !isBasic(printing) && deck.format === "commander") return "singleton";
  if (existing && !isBasic(printing) && deck.format !== "commander" && existing.qty >= 4) return "singleton";
  if (deckTotal(deck) >= formatTarget(deck.format) && !existing) return "full";
  return null;
}

export const ADD_BLOCK_COPY: Record<AddBlock, string> = {
  "no-deck": "No deck on the table.",
  singleton: "Already on the list (singleton).",
  identity: "Off this commander’s identity.",
  legal: "Not legal in this format.",
  full: "List is full.",
  "commander-slot": "That’s the commander.",
  missing: "Unknown card.",
};

export type ParsedLine = {
  qty: number;
  name: string;
  set?: string;
  collector?: string;
  board: DeckCard["board"];
};

export function parseDeckText(text: string): ParsedLine[] {
  let board: DeckCard["board"] = "main";
  const out: ParsedLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("//") || line.startsWith("#")) continue;
    const head = line.toLowerCase().replace(/:$/, "");
    if (head === "commander" || head === "commanders") {
      board = "command";
      continue;
    }
    if (head === "deck" || head === "main" || head === "mainboard" || head === "main board") {
      board = "main";
      continue;
    }
    if (head === "maybe" || head === "maybeboard" || head === "considering" || head === "sideboard" || head === "side") {
      board = "maybe";
      continue;
    }
    const m = line.match(
      /^(?:(\d+)\s*[xX]?\s+)?(.+?)(?:\s+\(([A-Za-z0-9]+)\)(?:\s+(\S+))?)?(?:\s+\*[Ff]\*)?\s*$/,
    );
    if (!m) continue;
    const name = m[2].replace(/\s*\[[^\]]+\]\s*$/, "").trim();
    if (name.length < 2) continue;
    out.push({
      qty: Math.max(1, Number(m[1] || 1)),
      name,
      set: m[3]?.toLowerCase(),
      collector: m[4],
      board,
    });
  }
  return out;
}

export function resolveParsedLine(line: ParsedLine): Printing | null {
  if (line.set && line.collector) {
    const hit = resolvePrinting(line.set, line.collector);
    if (hit) return hit;
  }
  const exact = printingForName(line.name);
  if (exact) return exact;
  const q = line.name.toLowerCase();
  for (const p of PRINTINGS) {
    if (p.name.toLowerCase() === q) return p;
  }
  for (const p of PRINTINGS) {
    if (p.name.toLowerCase().startsWith(q)) return p;
  }
  return null;
}

export function formatDeckText(deck: Deck) {
  const cmd = commanderPrinting(deck);
  const lines: string[] = [];
  if (cmd) {
    lines.push("Commander");
    lines.push(`1 ${cmd.name} (${cmd.set.toUpperCase()}) ${cmd.collector_number}`);
    lines.push("");
  }
  lines.push("Deck");
  for (const c of deck.cards.filter((x) => x.board !== "maybe")) {
    const p = (c.preferred_printing_id ? printingById(c.preferred_printing_id) : null) ?? defaultPrinting(c.oracle_id);
    if (!p) continue;
    lines.push(`${c.qty} ${p.name} (${p.set.toUpperCase()}) ${p.collector_number}`);
  }
  const maybe = deck.cards.filter((x) => x.board === "maybe");
  if (maybe.length) {
    lines.push("");
    lines.push("Maybeboard");
    for (const c of maybe) {
      const p = defaultPrinting(c.oracle_id);
      if (!p) continue;
      lines.push(`${c.qty} ${p.name}`);
    }
  }
  return lines.join("\n");
}

export function searchOwnedFirst(q: string, inventory: InventoryRow[], limit = 16) {
  const s = q.trim().toLowerCase();
  const ownedIds = new Set<string>();
  const owned: Printing[] = [];
  for (const row of inventory) {
    if (row.qty <= 0) continue;
    const p = printingById(row.scryfall_id);
    if (!p || ownedIds.has(p.oracle_id)) continue;
    if (s && !p.name.toLowerCase().includes(s) && !p.set.includes(s)) continue;
    ownedIds.add(p.oracle_id);
    owned.push(p);
    if (owned.length >= limit) return owned;
  }
  const rest: Printing[] = [];
  const seen = new Set(ownedIds);
  for (const p of PRINTINGS) {
    if (seen.has(p.oracle_id)) continue;
    if (s && !p.name.toLowerCase().includes(s) && !p.set.includes(s)) continue;
    seen.add(p.oracle_id);
    rest.push(p);
    if (owned.length + rest.length >= limit) break;
  }
  return [...owned, ...rest];
}

export function searchCommanders(q: string, format: Deck["format"], limit = 16) {
  const s = q.trim().toLowerCase();
  const out: Printing[] = [];
  const seen = new Set<string>();
  for (const p of PRINTINGS) {
    if (seen.has(p.oracle_id)) continue;
    if (!isLegendaryCommander(p)) continue;
    const legal = p.legalities[format] ?? p.legalities.commander;
    if (legal === "not_legal" || legal === "banned") continue;
    if (s && !p.name.toLowerCase().includes(s)) continue;
    seen.add(p.oracle_id);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

export type DeckIssue = { oracle_id: string; name: string; kind: "identity" | "legal" | "singleton" | "count" };

export function deckIssues(deck: Deck): DeckIssue[] {
  const issues: DeckIssue[] = [];
  const seen = new Map<string, number>();
  for (const c of deck.cards) {
    if (c.board === "maybe") continue;
    const p = defaultPrinting(c.oracle_id);
    if (!p) continue;
    if (deck.colors.length && !identityOk(p.color_identity, deck.colors)) {
      issues.push({ oracle_id: c.oracle_id, name: p.name, kind: "identity" });
    }
    const legal = p.legalities[deck.format] ?? p.legalities.commander;
    if (legal === "banned" || (deck.format === "commander" && legal === "not_legal")) {
      issues.push({ oracle_id: c.oracle_id, name: p.name, kind: "legal" });
    }
    if (!isBasic(p)) {
      const n = (seen.get(c.oracle_id) ?? 0) + c.qty;
      seen.set(c.oracle_id, n);
      if (deck.format === "commander" && n > 1) {
        issues.push({ oracle_id: c.oracle_id, name: p.name, kind: "singleton" });
      }
    }
  }
  const total = deckTotal(deck);
  const target = formatTarget(deck.format);
  if (total !== target) {
    issues.push({ oracle_id: "", name: `${total}/${target}`, kind: "count" });
  }
  return issues;
}

export function groupDeckCards(deck: Deck) {
  const groups = new Map<string, DeckCard[]>();
  const order = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Land", "Other"];
  for (const c of deck.cards.filter((x) => x.board !== "maybe")) {
    const p = defaultPrinting(c.oracle_id);
    const key = p ? order.find((t) => p.type_line.includes(t)) ?? "Other" : "Other";
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }
  return order.filter((k) => groups.has(k)).map((k) => ({ type: k, cards: groups.get(k)! }));
}
