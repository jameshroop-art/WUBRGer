export type LoadingSlide = {
  id: string;
  art: string;
  cards: string[];
  title: string;
  rule: string;
  cite: string;
};

export const LOADING_SLIDES: LoadingSlide[] = [
  {
    id: "yuriko",
    art: "/icons/splash-orc.png",
    cards: ["Yuriko, the Tiger's Shadow"],
    title: "Ninjutsu is not casting",
    rule: "Yuriko's ninjutsu puts her onto the battlefield from the command zone. That is an activated ability, not a cast. Commander tax never applies, and Fierce Guardianship cannot be thrown at the ninjutsu itself.",
    cite: "CR 702.49a · 903.8",
  },
  {
    id: "greaves",
    art: "/icons/splash-lion.png",
    cards: ["Lightning Greaves", "Swiftfoot Boots"],
    title: "Shroud does not trap the boots",
    rule: "Equip targets the creature you attach to, not the Equipment. A creature wearing Lightning Greaves has shroud, but you can still move the Greaves onto a different creature because that activate targets the new body.",
    cite: "CR 702.6a · 702.18a",
  },
  {
    id: "rift",
    art: "/icons/splash-mage.png",
    cards: ["Cyclonic Rift"],
    title: "Overload stops targeting",
    rule: "An overloaded Cyclonic Rift does not target. Hexproof, shroud, ward, and Deflecting Swat do nothing to it. Overload is an alternative cost, so cost reducers still shrink the seven, and you cannot pay both the two and the overload.",
    cite: "CR 702.119b · 118.9",
  },
  {
    id: "ur-dragon",
    art: "/icons/splash-dragon.png",
    cards: ["The Ur-Dragon"],
    title: "The discount eats commander tax",
    rule: "Cost reduction is applied after additional costs are added to the total. If The Ur-Dragon is your commander, “Dragon spells you cast cost {1} less” reduces the tax you pay to recast it from the zone.",
    cite: "CR 601.2f · 118.7d · 903.8",
  },
  {
    id: "teferi",
    art: "/icons/splash-lich.png",
    cards: ["Teferi's Protection"],
    title: "Phased commanders stay put",
    rule: "Teferi's Protection phases your permanents out. A phased-out commander is still on the battlefield, still your commander, and does not move to the command zone. Tokens that phase out will phase back in; they are not exiled.",
    cite: "CR 702.26b · 903.9",
  },
  {
    id: "consult",
    art: "/icons/splash-cyber.png",
    cards: ["Demonic Consultation", "Thassa's Oracle", "Tainted Pact"],
    title: "Consultation is not a search",
    rule: "Demonic Consultation never searches and never shuffles. Name a card that is not in your library and the rest of the library is exiled. Thassa's Oracle then checks cards-in-library against devotion on resolution — if Oracle has already left, devotion no longer counts her.",
    cite: "CR 701.19 · Oracle ruling, Consultation",
  },
  {
    id: "earthcraft",
    art: "/icons/splash-ember.png",
    cards: ["Squirrel Nest", "Earthcraft", "Presence of Gond", "Intruder Alarm"],
    title: "Nest only loops on a basic",
    rule: "Earthcraft untaps a target basic land. Squirrel Nest on a shock or Command Tower does not go infinite with Earthcraft. Presence of Gond plus Intruder Alarm does: the token is an “enters” event that untaps the enchanted creature.",
    cite: "CR 701.3 · Earthcraft oracle text",
  },
];

export function pickSlide(prevId?: string) {
  const pool = prevId ? LOADING_SLIDES.filter((s) => s.id !== prevId) : LOADING_SLIDES;
  return pool[Math.floor(Math.random() * pool.length)] ?? LOADING_SLIDES[0];
}
