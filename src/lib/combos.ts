import { oracleIdForName, printingForName } from "@/lib/catalog";
import type { ComboRecipe } from "@/lib/types";

function pieces(...names: string[]) {
  return names.map((n) => oracleIdForName(n)).filter((x): x is string => Boolean(x));
}

export const COMBOS: ComboRecipe[] = [
  {
    id: "thassa-consult",
    name: "Thassa's Oracle + Demonic Consultation",
    pieces: pieces("Thassa's Oracle", "Demonic Consultation"),
    results: "Win the game by emptying the library, then seeing no cards.",
    steps: [
      "Cast Demonic Consultation naming a card not in your library.",
      "Exile your library.",
      "Cast Thassa's Oracle. Devotion check sees an empty library.",
    ],
    popularity: 96,
    bracket: 4,
  },
  {
    id: "thassa-pact",
    name: "Thassa's Oracle + Tainted Pact",
    pieces: pieces("Thassa's Oracle", "Tainted Pact"),
    results: "Win after exiling a unique-name library.",
    steps: [
      "Cast Tainted Pact and exile until the library is gone.",
      "Resolve Thassa's Oracle with an empty library.",
    ],
    popularity: 88,
    bracket: 4,
  },
  {
    id: "dual-twin",
    name: "Dualcaster Mage + Twinflame",
    pieces: pieces("Dualcaster Mage", "Twinflame"),
    results: "Infinite hasty Dualcasters.",
    steps: [
      "Cast Twinflame targeting any creature.",
      "Flash in Dualcaster Mage copying Twinflame, targeting Dualcaster.",
      "Each copy makes another Dualcaster; loop.",
    ],
    popularity: 74,
    bracket: 3,
  },
  {
    id: "dual-heat",
    name: "Dualcaster Mage + Heat Shimmer",
    pieces: pieces("Dualcaster Mage", "Heat Shimmer"),
    results: "Infinite hasty Dualcasters.",
    steps: ["Same loop as Twinflame, substituting Heat Shimmer."],
    popularity: 61,
    bracket: 3,
  },
  {
    id: "deadeye-palin",
    name: "Deadeye Navigator + Palinchron",
    pieces: pieces("Deadeye Navigator", "Palinchron"),
    results: "Infinite mana and etbs.",
    steps: [
      "Soulbond Deadeye to Palinchron.",
      "Flicker Palinchron for mana, recast the soulbond, repeat.",
    ],
    popularity: 58,
    bracket: 3,
  },
  {
    id: "kiki-resto",
    name: "Kiki-Jiki + Restoration Angel",
    pieces: pieces("Kiki-Jiki, Mirror Breaker", "Restoration Angel"),
    results: "Infinite hasty angels.",
    steps: [
      "Kiki copies Restoration Angel.",
      "The copy flickers Kiki, untapping him.",
    ],
    popularity: 70,
    bracket: 3,
  },
  {
    id: "kiki-felidar",
    name: "Kiki-Jiki + Felidar Guardian",
    pieces: pieces("Kiki-Jiki, Mirror Breaker", "Felidar Guardian"),
    results: "Infinite hasty cats.",
    steps: ["Copy Felidar, flicker Kiki, repeat."],
    popularity: 66,
    bracket: 3,
  },
  {
    id: "kiki-combat",
    name: "Kiki-Jiki + Combat Celebrant",
    pieces: pieces("Kiki-Jiki, Mirror Breaker", "Combat Celebrant"),
    results: "Infinite combat phases.",
    steps: ["Copy Celebrant, exert for an extra combat, copy again."],
    popularity: 55,
    bracket: 3,
  },
  {
    id: "twin-pester",
    name: "Splinter Twin + Pestermite",
    pieces: pieces("Splinter Twin", "Pestermite"),
    results: "Infinite hasty Pestermites.",
    steps: ["Enchant Pestermite. Tap for a copy that untaps the original."],
    popularity: 52,
    bracket: 3,
  },
  {
    id: "squirrel-earth",
    name: "Squirrel Nest + Earthcraft",
    pieces: pieces("Squirrel Nest", "Earthcraft"),
    results: "Infinite squirrels.",
    steps: ["Make a squirrel, tap it with Earthcraft to untap the enchanted land, repeat."],
    popularity: 48,
    bracket: 2,
  },
  {
    id: "gond-alarm",
    name: "Presence of Gond + Intruder Alarm",
    pieces: pieces("Presence of Gond", "Intruder Alarm"),
    results: "Infinite 1/1s.",
    steps: ["Tap enchanted creature for a token. Alarm untaps all creatures."],
    popularity: 41,
    bracket: 2,
  },
  {
    id: "breach-storm",
    name: "Underworld Breach + Lion's Eye Diamond + Brain Freeze",
    pieces: pieces("Underworld Breach", "Lion's Eye Diamond", "Brain Freeze"),
    results: "Storm mill wins.",
    steps: [
      "Breach in play. Crack LED, escape Brain Freeze, escape LED, loop.",
    ],
    popularity: 80,
    bracket: 4,
  },
  {
    id: "assault-celebrant",
    name: "Aggravated Assault + Combat Celebrant",
    pieces: pieces("Aggravated Assault", "Combat Celebrant"),
    results: "Infinite combats if mana lines up.",
    steps: ["Exert Celebrant, extra combat, pay for Assault, repeat."],
    popularity: 36,
    bracket: 2,
  },
].filter((c) => c.pieces.length >= 2);

export function comboById(id: string) {
  return COMBOS.find((c) => c.id === id);
}

export function comboNamePieces(combo: ComboRecipe) {
  return combo.pieces.map((oid) => printingForName("") || oid);
}
