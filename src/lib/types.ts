export type Finish = "nonfoil" | "foil" | "etched";
export type Condition = "nm" | "lp" | "mp" | "hp" | "dmg";
export type NetworkPolicy = "wifi_only" | "wifi_and_mobile" | "manual";
export type RootTab = "binder" | "table" | "lens" | "atlas";
export type BinderSegment = "faces" | "sets" | "value" | "where";
export type TableSegment = "list" | "own" | "synergy" | "combos" | "power" | "test";
export type CardSheetTab = "copy" | "print" | "market" | "play" | "rules" | "combo";
export type Mode = "collect" | "brew" | "play";
export type BuyPinKind = "suggest" | "combo";

export type Printing = {
  id: string;
  oracle_id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  lang: string;
  rarity: string;
  mana_cost: string;
  cmc: number;
  type_line: string;
  oracle_text: string;
  colors: string[];
  color_identity: string[];
  power: string | null;
  toughness: string | null;
  keywords: string[];
  legalities: Record<string, string>;
  tcgplayer_id: number | null;
  tcgplayer_etched_id: number | null;
  finishes: string[];
  released_at: string;
  artist: string;
  edhrec_rank: number | null;
  image_small: string | null;
  image_normal: string | null;
  prices_usd: string | null;
  prices_usd_foil: string | null;
  scryfall_uri: string | null;
};

export type InventoryRow = {
  id: string;
  scryfall_id: string;
  foil: Finish;
  condition: Condition;
  lang: string;
  qty: number;
  location: string;
  notes: string;
  added_at: string;
  updated_at: string;
};

export type DeckCard = {
  oracle_id: string;
  qty: number;
  preferred_printing_id: string | null;
  board: "main" | "command" | "maybe";
};

export type Deck = {
  id: string;
  name: string;
  format: "commander" | "modern" | "casual";
  commanders: string[];
  colors: string[];
  revision: number;
  tier_label: string | null;
  tier_as_of: string | null;
  salt_note: string | null;
  created_at: string;
  updated_at: string;
  cards: DeckCard[];
};

export type ScanChip = {
  id: string;
  scryfall_id: string;
  foil: Finish;
  qty: number;
  confidence: number;
  at: string;
  photo?: string | null;
};

export type ScanSession = {
  id: string;
  started_at: string;
  chips: ScanChip[];
};

export type PriceRow = {
  tcgplayer_id: number;
  market: number | null;
  mid: number | null;
  low: number | null;
  source: "tcgplayer" | "scryfall";
  fetched_at: string;
};

export type ComboRecipe = {
  id: string;
  name: string;
  pieces: string[];
  results: string;
  steps: string[];
  popularity: number;
  bracket: number;
};

export type DeckAdvice = {
  deck_id: string;
  revision: number;
  computed_at: string;
  suggest: SuggestRow[];
  combos: ComboMatch[];
  rail: { ownedHigh: number; combosReady: number; oneAway: number };
};

export type SuggestRow = {
  oracle_id: string;
  score: number;
  reasons: string[];
  hole: string | null;
  lift: number;
  inclusion: number;
  owned: boolean;
  in_deck: boolean;
};

export type ComboMatch = {
  combo_id: string;
  state: "ready" | "almost" | "buy";
  missing: string[];
  present: string[];
};

export type BuyPin = {
  id: string;
  oracle_id: string;
  kind: BuyPinKind;
  deck_id: string;
  created_at: string;
};

export type Settings = {
  networkPolicy: NetworkPolicy;
  collectionOnlyAdvice: boolean;
  lastRoot: RootTab;
  lastBinderSegment: BinderSegment;
  lastTableSegment: TableSegment;
  lastDeckId: string | null;
  lastSearch: string;
  catalogFetchedAt: string | null;
  pricesFetchedAt: string | null;
  edhrecFetchedAt: string | null;
  comboIndexAt: string | null;
  rulesVersion: string;
  notificationsAsked: boolean;
  seedVersion: number;
  scryfallCooldownUntil: string | null;
  scryfallLastCall: string | null;
  scryfallLastResult: string | null;
};

export type BinderDump = {
  inventory: InventoryRow[];
  decks: Deck[];
  prices: PriceRow[];
  buyPins: BuyPin[];
  sessions: ScanSession[];
  advice: DeckAdvice[];
  settings: Settings;
};
