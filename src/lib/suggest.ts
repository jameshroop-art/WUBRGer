import { PRINTINGS, defaultPrinting, identityOk, printingById } from "@/lib/catalog";
import { COMBOS } from "@/lib/combos";
import type { ComboMatch, Deck, InventoryRow, SuggestRow } from "@/lib/types";

const HOLE_TAGS: { hole: string; test: (t: string, text: string, name: string) => boolean }[] = [
  {
    hole: "ramp",
    test: (t, text, name) =>
      /Signet|Talisman|Sol Ring|Arcane Signet|Cultivate|Kodama|Farseek|Nature's Lore|Three Visits|Rampant|Chromatic|Mind Stone|Fellwar/.test(
        name,
      ) ||
      (t.includes("Artifact") && /add \{/.test(text.toLowerCase())),
  },
  {
    hole: "draw",
    test: (_t, text, name) =>
      /Rhystic|Mystic Remora|Esper Sentinel|Phyrexian Arena|Necropotence|Brainstorm|Ponder|Preordain|The One Ring|Sylvan Library/.test(
        name,
      ) || /draw a card/i.test(text),
  },
  {
    hole: "interaction",
    test: (t, text, name) =>
      /Swords|Path to Exile|Counterspell|Cyclonic|Beast Within|Generous Gift|Pongify|Toxic Deluge|Wrath|Damnation|Farewell|Chaos Warp|Swan Song|Negate/.test(
        name,
      ) ||
      ((t.includes("Instant") || t.includes("Sorcery")) &&
        /destroy|exile|counter target|bounce/i.test(text)),
  },
  {
    hole: "lands",
    test: (t) => t.includes("Land"),
  },
];

function holeFor(p: ReturnType<typeof defaultPrinting>) {
  if (!p) return null;
  for (const h of HOLE_TAGS) if (h.test(p.type_line, p.oracle_text, p.name)) return h.hole;
  return null;
}

export function ownedOracles(inv: InventoryRow[]) {
  const s = new Set<string>();
  for (const row of inv) {
    if (row.qty <= 0) continue;
    const p = printingById(row.scryfall_id);
    if (p) s.add(p.oracle_id);
  }
  return s;
}

export function deckOracleSet(deck: Deck) {
  const s = new Set<string>();
  for (const c of deck.cards) if (c.qty > 0) s.add(c.oracle_id);
  for (const id of deck.commanders) {
    const p = printingById(id) ?? defaultPrinting(id);
    if (p) s.add(p.oracle_id);
  }
  return s;
}

export function matchCombos(deck: Deck, inv: InventoryRow[]): ComboMatch[] {
  const inDeck = deckOracleSet(deck);
  const owned = ownedOracles(inv);
  const out: ComboMatch[] = [];
  for (const recipe of COMBOS) {
    const present = recipe.pieces.filter((id) => inDeck.has(id));
    const missing = recipe.pieces.filter((id) => !inDeck.has(id));
    if (missing.length === 0) {
      out.push({ combo_id: recipe.id, state: "ready", missing, present });
    } else if (missing.length === 1) {
      const miss = missing[0];
      out.push({
        combo_id: recipe.id,
        state: owned.has(miss) ? "almost" : "buy",
        missing,
        present,
      });
    } else if (missing.length === 2 && present.length >= 1) {
      out.push({
        combo_id: recipe.id,
        state: "buy",
        missing,
        present,
      });
    }
  }
  const rank = { ready: 0, almost: 1, buy: 2 };
  return out.sort((a, b) => rank[a.state] - rank[b.state]);
}

export function suggestForDeck(deck: Deck, inv: InventoryRow[], collectionOnly: boolean): SuggestRow[] {
  const inDeck = deckOracleSet(deck);
  const owned = ownedOracles(inv);
  const deckCi = deck.colors;
  const holesPresent = new Set<string>();
  for (const oid of inDeck) {
    const p = defaultPrinting(oid);
    const h = holeFor(p);
    if (h) holesPresent.add(h);
  }

  const seen = new Set<string>();
  const rows: SuggestRow[] = [];

  for (const p of PRINTINGS) {
    if (seen.has(p.oracle_id)) continue;
    seen.add(p.oracle_id);
    if (inDeck.has(p.oracle_id)) continue;
    if (!identityOk(p.color_identity, deckCi) && deckCi.length) continue;
    if ((p.legalities.commander ?? "not_legal") === "not_legal" && deck.format === "commander") continue;
    if (p.type_line.includes("Basic Land")) continue;

    const hole = holeFor(p);
    const isOwned = owned.has(p.oracle_id);
    if (collectionOnly && !isOwned) continue;

    const lift = p.edhrec_rank ? Math.max(0, 1 - Math.min(p.edhrec_rank, 8000) / 8000) : 0.15;
    const inclusion = p.edhrec_rank && p.edhrec_rank < 400 ? 1 : p.edhrec_rank && p.edhrec_rank < 1500 ? 0.6 : 0.2;
    let score = 0;
    const reasons: string[] = [];
    if (isOwned) {
      score += 3;
      reasons.push("owned");
    }
    score += 2 * lift;
    if (lift > 0.4) reasons.push("high lift");
    score += inclusion;
    if (inclusion >= 0.6) reasons.push("staple");
    if (hole && !holesPresent.has(hole)) {
      score += 1.5;
      reasons.push(`fills ${hole}`);
    }
    if (p.name === "Sol Ring" || p.name === "Command Tower" || p.name === "Arcane Signet") {
      score += 0.8;
      reasons.push("curve rock");
    }
    if (deck.tier_label?.toLowerCase().includes("casual") && /Consultation|Tainted Pact|Jeweled Lotus|Mana Crypt/.test(p.name)) {
      score -= 1;
      reasons.push("salty");
    }

    rows.push({
      oracle_id: p.oracle_id,
      score,
      reasons,
      hole,
      lift,
      inclusion,
      owned: isOwned,
      in_deck: false,
    });
  }

  rows.sort((a, b) => b.score - a.score);
  return rows.slice(0, 12);
}

export function computeAdvice(deck: Deck, inv: InventoryRow[], collectionOnly: boolean) {
  const suggest = suggestForDeck(deck, inv, collectionOnly);
  const combos = matchCombos(deck, inv);
  return {
    deck_id: deck.id,
    revision: deck.revision,
    computed_at: new Date().toISOString(),
    suggest,
    combos,
    rail: {
      ownedHigh: suggest.filter((s) => s.owned).length,
      combosReady: combos.filter((c) => c.state === "ready").length,
      oneAway: combos.filter((c) => c.state === "almost" || (c.state === "buy" && c.missing.length === 1)).length,
    },
  };
}
