type DeckCard = {
  name: string;
  quantity: number;
  section?: string;
};

export type DeckData = {
  source: 'archidekt';
  name: string;
  url: string;
  format?: string | null;
  cards: DeckCard[];
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

type DeckCache = {
  decks: Map<string, ArchidektDeck>;
  lastDeckId?: string;
  lastDeckUrl?: string;
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

async function fetchJson(url: string): Promise<FetchResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'user-agent': 'before-that-resolves/1.0'
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

async function fetchArchidektDeckById(deckId: string): Promise<ArchidektDeck> {
  const apiUrl = `https://archidekt.com/api/decks/${deckId}/`;
  const result = await fetchJson(apiUrl);

  if (!result.ok || !result.json) {
    throw new Error(result.error || 'Failed to load Archidekt deck');
  }

  return result.json as ArchidektDeck;
}

export async function fetchArchidektDeckSummary(deckUrl: string): Promise<{
  id: string;
  name: string;
  format: string | null;
  url: string;
}> {
  const deckId = parseDeckId(deckUrl, 'archidekt.com');
  if (!deckId) {
    throw new Error('Invalid Archidekt URL. Expected https://archidekt.com/decks/{deckId}/{slug}');
  }

  const deck = await fetchArchidektDeckById(deckId);
  return {
    id: deckId,
    name: deck.name || 'Untitled Deck',
    format: deck.format || deck.deckFormat || null,
    url: deckUrl
  };
}

export async function cacheArchidektDeckFromUrl(
  deckUrl: string,
  conversationId: string
): Promise<ArchidektDeck> {
  const deckId = parseDeckId(deckUrl, 'archidekt.com');
  if (!deckId) {
    throw new Error('Invalid Archidekt URL. Expected https://archidekt.com/decks/{deckId}/{slug}');
  }

  const cache = getDeckCache(conversationId);
  const cached = cache.decks.get(deckId);
  if (cached) {
    cache.lastDeckId = deckId;
    cache.lastDeckUrl = deckUrl;
    return cached;
  }

  const deck = await fetchArchidektDeckById(deckId);
  cache.decks.set(deckId, deck);
  cache.lastDeckId = deckId;
  cache.lastDeckUrl = deckUrl;
  return deck;
}

export function buildArchidektDeckData(deck: ArchidektDeck, deckUrl: string): DeckData {
  return buildDeckData(deck, deckUrl);
}

export function getLastCachedArchidektDeck(conversationId: string): DeckData | null {
  const cache = conversationDecks.get(conversationId);
  if (!cache?.lastDeckId || !cache?.lastDeckUrl) {
    return null;
  }
  const cached = cache.decks.get(cache.lastDeckId);
  if (!cached) {
    return null;
  }
  return buildDeckData(cached, cache.lastDeckUrl);
}

export function getLastCachedArchidektDeckRaw(conversationId: string): ArchidektDeck | null {
  const cache = conversationDecks.get(conversationId);
  if (!cache?.lastDeckId) {
    return null;
  }
  return cache.decks.get(cache.lastDeckId) ?? null;
}

export function resetArchidektDeckCache(conversationId: string): void {
  conversationDecks.delete(conversationId);
}

function buildDeckData(deck: ArchidektDeck, deckUrl: string): DeckData {
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
