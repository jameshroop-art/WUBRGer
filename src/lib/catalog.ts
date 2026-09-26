import printingsJson from "@/data/printings.json";
import type { Printing } from "@/lib/types";

export const PRINTINGS = printingsJson as Printing[];

const byId = new Map<string, Printing>();
const byOracle = new Map<string, Printing[]>();
const byName = new Map<string, Printing[]>();
const bySetNum = new Map<string, Printing[]>();

for (const p of PRINTINGS) {
  byId.set(p.id, p);
  const o = byOracle.get(p.oracle_id) ?? [];
  o.push(p);
  byOracle.set(p.oracle_id, o);
  const n = byName.get(p.name.toLowerCase()) ?? [];
  n.push(p);
  byName.set(p.name.toLowerCase(), n);
  const k = `${p.set}:${p.collector_number}:${p.lang}`;
  const s = bySetNum.get(k) ?? [];
  s.push(p);
  bySetNum.set(k, s);
}

export function rememberPrinting(p: Printing) {
  if (byId.has(p.id)) return p;
  PRINTINGS.push(p);
  byId.set(p.id, p);
  const o = byOracle.get(p.oracle_id) ?? [];
  o.push(p);
  byOracle.set(p.oracle_id, o);
  const n = byName.get(p.name.toLowerCase()) ?? [];
  n.push(p);
  byName.set(p.name.toLowerCase(), n);
  const k = `${p.set}:${p.collector_number}:${p.lang}`;
  const s = bySetNum.get(k) ?? [];
  s.push(p);
  bySetNum.set(k, s);
  return p;
}

export function printingFromScryfall(card: Record<string, unknown>): Printing {
  const img = (card.image_uris as Record<string, string> | undefined) ??
    ((card.card_faces as { image_uris?: Record<string, string> }[] | undefined)?.[0]?.image_uris);
  return {
    id: String(card.id ?? ""),
    oracle_id: String(card.oracle_id ?? card.id ?? ""),
    name: String(card.name ?? ""),
    set: String(card.set ?? ""),
    set_name: String(card.set_name ?? ""),
    collector_number: String(card.collector_number ?? ""),
    lang: String(card.lang ?? "en"),
    rarity: String(card.rarity ?? ""),
    mana_cost: String(card.mana_cost ?? ""),
    cmc: Number(card.cmc ?? 0),
    type_line: String(card.type_line ?? ""),
    oracle_text: String(card.oracle_text ?? ""),
    colors: Array.isArray(card.colors) ? (card.colors as string[]) : [],
    color_identity: Array.isArray(card.color_identity) ? (card.color_identity as string[]) : [],
    power: card.power == null ? null : String(card.power),
    toughness: card.toughness == null ? null : String(card.toughness),
    keywords: Array.isArray(card.keywords) ? (card.keywords as string[]) : [],
    legalities: (card.legalities as Record<string, string>) ?? {},
    tcgplayer_id: typeof card.tcgplayer_id === "number" ? card.tcgplayer_id : null,
    tcgplayer_etched_id: typeof card.tcgplayer_etched_id === "number" ? card.tcgplayer_etched_id : null,
    finishes: Array.isArray(card.finishes) ? (card.finishes as string[]) : ["nonfoil"],
    released_at: String(card.released_at ?? ""),
    artist: String(card.artist ?? ""),
    edhrec_rank: typeof card.edhrec_rank === "number" ? card.edhrec_rank : null,
    image_small: img?.small ?? null,
    image_normal: img?.normal ?? null,
    prices_usd: (card.prices as { usd?: string | null } | undefined)?.usd ?? null,
    prices_usd_foil: (card.prices as { usd_foil?: string | null } | undefined)?.usd_foil ?? null,
    scryfall_uri: typeof card.scryfall_uri === "string" ? card.scryfall_uri : null,
  };
}

export function printingById(id: string) {
  return byId.get(id);
}

export function printingsByOracle(oracleId: string) {
  return byOracle.get(oracleId) ?? [];
}

export function defaultPrinting(oracleId: string) {
  const list = printingsByOracle(oracleId);
  return list[0];
}

export function searchPrintings(q: string, limit = 24) {
  const s = q.trim().toLowerCase();
  if (!s) return PRINTINGS.slice(0, limit);
  const hits: Printing[] = [];
  for (const p of PRINTINGS) {
    if (
      p.name.toLowerCase().includes(s) ||
      p.set.includes(s) ||
      p.collector_number.toLowerCase() === s ||
      `${p.set}${p.collector_number}`.includes(s.replace(/\s+/g, ""))
    ) {
      hits.push(p);
      if (hits.length >= limit) break;
    }
  }
  return hits;
}

export function resolvePrinting(set: string, number: string, lang = "en") {
  return bySetNum.get(`${set.toLowerCase()}:${number}:${lang}`)?.[0];
}

export function oracleIdForName(name: string) {
  return byName.get(name.toLowerCase())?.[0]?.oracle_id;
}

export function printingForName(name: string) {
  return byName.get(name.toLowerCase())?.[0];
}

export const SETS = (() => {
  const m = new Map<string, { code: string; name: string; total: number }>();
  for (const p of PRINTINGS) {
    const cur = m.get(p.set) ?? { code: p.set, name: p.set_name, total: 0 };
    cur.total += 1;
    m.set(p.set, cur);
  }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
})();

export function colorLabel(ci: string[]) {
  if (!ci.length) return "C";
  return [...ci].sort((a, b) => "WUBRG".indexOf(a) - "WUBRG".indexOf(b)).join("");
}

export function isLegalCommander(p: Printing, format: string) {
  const v = p.legalities[format] ?? p.legalities.commander;
  return v === "legal" || v === "restricted";
}

export function identityOk(cardCi: string[], deckCi: string[]) {
  return cardCi.every((c) => deckCi.includes(c));
}

export const TYPE_CHIPS = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Land", "Planeswalker"];

export function primaryType(typeLine: string) {
  for (const t of TYPE_CHIPS) if (typeLine.includes(t)) return t;
  return "Other";
}
