type DeckSource = 'archidekt' | 'moxfield';

type DeckCard = {
  name: string;
  quantity: number;
  section?: string;
};

export type DeckData = {
  source: DeckSource;
  name: string;
  url: string;
  format?: string | null;
  cards: DeckCard[];
};

export type DeckSummary = {
  id: string;
  name: string;
  format: string | null;
  url: string;
  commanderNames: string[];
  colorIdentity: string[];
  source: DeckSource;
};

export type RawDeck = {
  source: DeckSource;
  deck: ArchidektDeck | MoxfieldDeck;
};

type FetchResult = {
  ok: boolean;
  status: number;
  json?: unknown;
  error?: string;
};

type ArchidektCardEntry = {
  categories?: string[];
  category?: string;
  board?: string;
  section?: string;
  card?: {
    oracleCard?: { name?: string };
    name?: string;
  };
  cardName?: string;
  quantity?: number;
  qty?: number;
};

type ArchidektDeck = {
  cards?: ArchidektCardEntry[];
  name?: string;
  format?: string;
  deckFormat?: string;
};

type MoxfieldBoardCard = {
  boardType?: string;
  card?: {
    name?: string;
    color_identity?: unknown;
    colorIdentity?: unknown;
    colors?: unknown;
  };
  colorIdentityOverride?: unknown;
  useColorIdentityOverride?: boolean;
  quantity?: number;
};

type MoxfieldBoard = {
  cards?: Record<string, MoxfieldBoardCard>;
  count?: number;
};

type MoxfieldDeck = {
  name?: string;
  format?: string;
  publicId?: string;
  publicUrl?: string;
  colorIdentity?: unknown;
  boards?: Record<string, MoxfieldBoard>;
  main?: {
    name?: string;
    color_identity?: unknown;
    colorIdentity?: unknown;
    colors?: unknown;
  };
};

const COLOR_NAME_MAP: Record<string, string> = {
  white: 'W',
  blue: 'U',
  black: 'B',
  red: 'R',
  green: 'G'
};
const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'];
const MOXFIELD_EXCLUDED_BOARDS = new Set(['maybeboard', 'sideboard', 'tokens']);
const MOXFIELD_BOARD_LABELS: Record<string, string> = {
  attractions: 'Attractions',
  commanders: 'Commander',
  companions: 'Companion',
  contraptions: 'Contraptions',
  mainboard: 'Mainboard',
  planes: 'Planes',
  schemes: 'Schemes',
  signatureSpells: 'Signature Spell',
  stickers: 'Stickers',
  tokens: 'Tokens'
};

function normalizeColorIdentity(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const colors = input
    .map((value) => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      if (!trimmed) return null;
      const lower = trimmed.toLowerCase();
      if (COLOR_NAME_MAP[lower]) {
        return COLOR_NAME_MAP[lower];
      }
      const upper = trimmed.toUpperCase();
      if (COLOR_NAME_MAP[upper.toLowerCase()]) {
        return COLOR_NAME_MAP[upper.toLowerCase()];
      }
      if (['W', 'U', 'B', 'R', 'G'].includes(upper)) {
        return upper;
      }
      return null;
    })
    .filter((color): color is string => Boolean(color));
  return Array.from(new Set(colors));
}

function sortColorIdentity(colors: string[]): string[] {
  return Array.from(new Set(colors)).sort((a, b) => COLOR_ORDER.indexOf(a) - COLOR_ORDER.indexOf(b));
}

function getCardColorIdentity(entry: ArchidektCardEntry): string[] {
  const oracleCard = entry?.card?.oracleCard as { colorIdentity?: unknown; color_identity?: unknown; colors?: unknown } | undefined;
  const raw =
    oracleCard?.colorIdentity ??
    oracleCard?.color_identity ??
    oracleCard?.colors ??
    [];
  return normalizeColorIdentity(raw);
}

function getMoxfieldCardColorIdentity(entry: MoxfieldBoardCard): string[] {
  const useOverride = Boolean(entry.useColorIdentityOverride);
  const raw =
    (useOverride ? entry.colorIdentityOverride : undefined) ??
    entry.card?.color_identity ??
    entry.card?.colorIdentity ??
    entry.card?.colors ??
    [];
  return normalizeColorIdentity(raw);
}

function isCommanderEntry(entry: ArchidektCardEntry): boolean {
  const categories: string[] = [];
  if (Array.isArray(entry.categories)) {
    categories.push(...entry.categories);
  }
  if (entry.category) categories.push(entry.category);
  if (entry.board) categories.push(entry.board);
  if (entry.section) categories.push(entry.section);
  return categories.some((category) => category.toLowerCase().includes('commander'));
}

function extractCommanderNames(cards: ArchidektCardEntry[]): string[] {
  const names = cards
    .filter(isCommanderEntry)
    .map((entry) => entry?.card?.oracleCard?.name || entry?.card?.name || entry?.cardName)
    .filter((name): name is string => Boolean(name));
  return Array.from(new Set(names));
}

function extractColorIdentityFromCards(cards: ArchidektCardEntry[]): string[] {
  const colors = cards.flatMap((entry) => getCardColorIdentity(entry));
  return sortColorIdentity(colors);
}

function getMoxfieldBoardCards(deck: MoxfieldDeck, boardKey: string): MoxfieldBoardCard[] {
  const board = deck.boards?.[boardKey];
  if (!board?.cards) return [];
  return Object.values(board.cards);
}

function extractMoxfieldCommanderNames(deck: MoxfieldDeck): string[] {
  const commanderCards = getMoxfieldBoardCards(deck, 'commanders');
  const names = commanderCards
    .map((entry) => entry.card?.name)
    .filter((name): name is string => Boolean(name));
  return Array.from(new Set(names));
}

function extractMoxfieldColorIdentity(deck: MoxfieldDeck, commanderNames: string[]): string[] {
  const rawDeckIdentity = deck.colorIdentity;
  if (Array.isArray(rawDeckIdentity)) {
    return sortColorIdentity(normalizeColorIdentity(rawDeckIdentity));
  }
  if (typeof rawDeckIdentity === 'string') {
    const letters = rawDeckIdentity
      .trim()
      .toUpperCase()
      .split('')
      .filter((value) => COLOR_ORDER.includes(value));
    return sortColorIdentity(letters);
  }
  const commanderCards = getMoxfieldBoardCards(deck, 'commanders');
  const colors = commanderNames.length > 0
    ? commanderCards.flatMap((entry) => getMoxfieldCardColorIdentity(entry))
    : Object.values(deck.boards ?? {}).flatMap((board) =>
        Object.values(board.cards ?? {}).flatMap((entry) => getMoxfieldCardColorIdentity(entry))
      );
  return sortColorIdentity(colors);
}

type CachedDeck = {
  source: DeckSource;
  deckId: string;
  deckUrl: string;
  deck: ArchidektDeck | MoxfieldDeck;
};

type DeckCache = {
  decks: Map<string, CachedDeck>;
  lastDeckKey?: string;
};

const conversationDecks = new Map<string, DeckCache>();

function getDeckCache(conversationId: string): DeckCache {
  const existing = conversationDecks.get(conversationId);
  if (existing) {
    return existing;
  }
  const cache: DeckCache = { decks: new Map() };
  conversationDecks.set(conversationId, cache);
  return cache;
}

async function fetchJson(
  url: string,
  options: { headers?: Record<string, string> } = {}
): Promise<FetchResult> {
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'before-that-resolves/1.0',
        ...(options.headers ?? {})
      }
    });

    if (!response.ok) {
      return { ok: false, status: response.status, error: `Request failed (${response.status})` };
    }

    const json = await response.json();
    return { ok: true, status: response.status, json };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network error';
    return { ok: false, status: 0, error: message };
  }
}

function parseDeckId(url: string, expectedHost: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.host.includes(expectedHost)) return null;

    const segments = parsed.pathname.split('/').filter(Boolean);
    const deckIndex = segments.indexOf('decks');
    if (deckIndex === -1 || deckIndex + 1 >= segments.length) return null;
    return segments[deckIndex + 1];
  } catch {
    return null;
  }
}

function buildCacheKey(source: DeckSource, deckId: string): string {
  return `${source}:${deckId}`;
}

export function getDeckSourceFromUrl(input: string | null): DeckSource | null {
  if (!input) return null;
  try {
    const parsed = new URL(input);
    if (parsed.host.includes('archidekt.com') && parsed.pathname.includes('/decks/')) {
      return 'archidekt';
    }
    if (parsed.host.includes('moxfield.com') && parsed.pathname.includes('/decks/')) {
      return 'moxfield';
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchArchidektDeckById(deckId: string): Promise<ArchidektDeck> {
  const apiUrl = `https://archidekt.com/api/decks/${deckId}/`;
  const result = await fetchJson(apiUrl);

  if (!result.ok || !result.json) {
    throw new Error(result.error || 'Failed to load Archidekt deck');
  }

  return result.json as ArchidektDeck;
}

async function fetchMoxfieldDeckById(deckId: string): Promise<MoxfieldDeck> {
  const apiUrl = `https://api2.moxfield.com/v3/decks/all/${deckId}`;
  const result = await fetchJson(apiUrl, {
    headers: {
      origin: 'https://www.moxfield.com',
      referer: 'https://www.moxfield.com/'
    }
  });

  if (!result.ok || !result.json) {
    throw new Error(result.error || 'Failed to load Moxfield deck');
  }

  return result.json as MoxfieldDeck;
}

async function fetchArchidektDeckSummary(deckUrl: string): Promise<DeckSummary> {
  const deckId = parseDeckId(deckUrl, 'archidekt.com');
  if (!deckId) {
    throw new Error('Invalid Archidekt URL. Expected https://archidekt.com/decks/{deckId}/{slug}');
  }

  const deck = await fetchArchidektDeckById(deckId);
  const cards = Array.isArray(deck.cards) ? deck.cards : [];
  const commanderNames = extractCommanderNames(cards);
  const colorIdentity = commanderNames.length > 0
    ? extractColorIdentityFromCards(cards.filter(isCommanderEntry))
    : extractColorIdentityFromCards(cards);
  const format =
    typeof deck.format === 'string'
      ? deck.format
      : typeof deck.deckFormat === 'string'
        ? deck.deckFormat
        : null;
  return {
    id: deckId,
    name: deck.name || 'Untitled Deck',
    format,
    url: deckUrl,
    commanderNames,
    colorIdentity,
    source: 'archidekt'
  };
}

async function fetchMoxfieldDeckSummary(deckUrl: string): Promise<DeckSummary> {
  const deckId = parseDeckId(deckUrl, 'moxfield.com');
  if (!deckId) {
    throw new Error('Invalid Moxfield URL. Expected https://moxfield.com/decks/{deckId}');
  }

  const deck = await fetchMoxfieldDeckById(deckId);
  const commanderNames = extractMoxfieldCommanderNames(deck);
  const colorIdentity = extractMoxfieldColorIdentity(deck, commanderNames);
  return {
    id: deckId,
    name: deck.name || 'Untitled Deck',
    format: typeof deck.format === 'string' ? deck.format : null,
    url: deckUrl,
    commanderNames,
    colorIdentity,
    source: 'moxfield'
  };
}

export async function fetchDeckSummary(deckUrl: string): Promise<DeckSummary> {
  const source = getDeckSourceFromUrl(deckUrl);
  if (source === 'archidekt') {
    return fetchArchidektDeckSummary(deckUrl);
  }
  if (source === 'moxfield') {
    return fetchMoxfieldDeckSummary(deckUrl);
  }
  throw new Error('Invalid deck URL. Expected an Archidekt or Moxfield deck link.');
}

export async function cacheDeckFromUrl(
  deckUrl: string,
  conversationId: string
): Promise<ArchidektDeck | MoxfieldDeck> {
  const source = getDeckSourceFromUrl(deckUrl);
  if (!source) {
    throw new Error('Invalid deck URL. Expected an Archidekt or Moxfield deck link.');
  }

  const deckId = parseDeckId(deckUrl, source === 'archidekt' ? 'archidekt.com' : 'moxfield.com');
  if (!deckId) {
    throw new Error(
      source === 'archidekt'
        ? 'Invalid Archidekt URL. Expected https://archidekt.com/decks/{deckId}/{slug}'
        : 'Invalid Moxfield URL. Expected https://moxfield.com/decks/{deckId}'
    );
  }

  const cache = getDeckCache(conversationId);
  const cacheKey = buildCacheKey(source, deckId);
  const cached = cache.decks.get(cacheKey);
  if (cached) {
    cached.deckUrl = deckUrl;
    cache.lastDeckKey = cacheKey;
    return cached.deck;
  }

  const deck = source === 'archidekt'
    ? await fetchArchidektDeckById(deckId)
    : await fetchMoxfieldDeckById(deckId);
  cache.decks.set(cacheKey, {
    source,
    deckId,
    deckUrl,
    deck
  });
  cache.lastDeckKey = cacheKey;
  return deck;
}

export function buildArchidektDeckData(deck: ArchidektDeck, deckUrl: string): DeckData {
  return buildArchidektDeckList(deck, deckUrl);
}

export function buildMoxfieldDeckData(deck: MoxfieldDeck, deckUrl: string): DeckData {
  const boards = deck.boards ?? {};
  const cards: DeckCard[] = [];
  for (const [boardKey, board] of Object.entries(boards)) {
    if (MOXFIELD_EXCLUDED_BOARDS.has(boardKey)) continue;
    const section = boardKey === 'mainboard'
      ? undefined
      : MOXFIELD_BOARD_LABELS[boardKey] ?? boardKey;
    const entries = Object.values(board.cards ?? {});
    for (const entry of entries) {
      const name = entry.card?.name;
      if (!name) continue;
      cards.push({
        name,
        quantity: entry.quantity ?? 0,
        section
      });
    }
  }

  return {
    source: 'moxfield',
    name: deck.name || 'Untitled Deck',
    url: deckUrl,
    format: typeof deck.format === 'string' ? deck.format : null,
    cards
  };
}

export function getLastCachedDeck(conversationId: string): DeckData | null {
  const cache = conversationDecks.get(conversationId);
  if (!cache?.lastDeckKey) {
    return null;
  }
  const cached = cache.decks.get(cache.lastDeckKey);
  if (!cached) {
    return null;
  }
  return cached.source === 'archidekt'
    ? buildArchidektDeckList(cached.deck as ArchidektDeck, cached.deckUrl)
    : buildMoxfieldDeckData(cached.deck as MoxfieldDeck, cached.deckUrl);
}

export function getLastCachedDeckRaw(conversationId: string): RawDeck | null {
  const cache = conversationDecks.get(conversationId);
  if (!cache?.lastDeckKey) {
    return null;
  }
  const cached = cache.decks.get(cache.lastDeckKey);
  if (!cached) {
    return null;
  }
  return {
    source: cached.source,
    deck: cached.deck
  };
}

export function resetDeckCache(conversationId: string): void {
  conversationDecks.delete(conversationId);
}

function buildArchidektDeckList(deck: ArchidektDeck, deckUrl: string): DeckData {
  const cards = Array.isArray(deck.cards)
    ? deck.cards
        .map((entry: ArchidektCardEntry): DeckCard | null => {
          const categories = Array.isArray(entry?.categories) ? entry.categories : [];
          const normalizedCategories = categories.map((category: string) => category.toLowerCase());
          const primaryCategory = normalizedCategories[0];
          const isExcludedCategory = primaryCategory === 'maybeboard' || primaryCategory === 'sideboard';
          if (isExcludedCategory) {
            return null;
          }
          const hasCommanderCategory = normalizedCategories.includes('commander');
          const name = entry?.card?.oracleCard?.name || entry?.card?.name || entry?.cardName;
          if (!name) {
            return null;
          }
          return {
            name,
            quantity: entry?.quantity ?? entry?.qty ?? 0,
            section:
              entry?.category ||
              entry?.board ||
              entry?.section ||
              (hasCommanderCategory ? 'Commander' : undefined)
          };
        })
        .filter((entry): entry is DeckCard => entry !== null)
    : [];

  return {
    source: 'archidekt',
    name: deck.name || 'Untitled Deck',
    url: deckUrl,
    format: deck.format || deck.deckFormat || null,
    cards
  };
}
