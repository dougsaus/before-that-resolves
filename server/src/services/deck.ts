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
  json?: any;
  error?: string;
};

const archidektRawCache = new Map<string, any>();
let lastArchidektDeckId: string | null = null;
let lastArchidektDeckUrl: string | null = null;

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
  } catch (error: any) {
    return { ok: false, status: 0, error: error?.message || 'Network error' };
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

export async function cacheArchidektDeckFromUrl(deckUrl: string): Promise<any> {
  const deckId = parseDeckId(deckUrl, 'archidekt.com');
  if (!deckId) {
    throw new Error('Invalid Archidekt URL. Expected https://archidekt.com/decks/{deckId}/{slug}');
  }

  const cached = archidektRawCache.get(deckId);
  if (cached) {
    lastArchidektDeckId = deckId;
    lastArchidektDeckUrl = deckUrl;
    return cached;
  }

  const apiUrl = `https://archidekt.com/api/decks/${deckId}/`;
  const result = await fetchJson(apiUrl);

  if (!result.ok || !result.json) {
    throw new Error(result.error || 'Failed to load Archidekt deck');
  }

  archidektRawCache.set(deckId, result.json);
  lastArchidektDeckId = deckId;
  lastArchidektDeckUrl = deckUrl;
  return result.json;
}

export function buildArchidektDeckData(deck: any, deckUrl: string): DeckData {
  return buildDeckData(deck, deckUrl);
}

export function getLastCachedArchidektDeck(): DeckData | null {
  if (!lastArchidektDeckId || !lastArchidektDeckUrl) {
    return null;
  }
  const cached = archidektRawCache.get(lastArchidektDeckId);
  if (!cached) {
    return null;
  }
  return buildDeckData(cached, lastArchidektDeckUrl);
}

export function getLastCachedArchidektDeckRaw(): any | null {
  if (!lastArchidektDeckId) {
    return null;
  }
  return archidektRawCache.get(lastArchidektDeckId) ?? null;
}

function buildDeckData(deck: any, deckUrl: string): DeckData {
  const cards = Array.isArray(deck.cards)
    ? deck.cards
      .map((entry: any) => {
        const categories = Array.isArray(entry?.categories) ? entry.categories : [];
        const normalizedCategories = categories.map((category: string) => category.toLowerCase());
        const primaryCategory = normalizedCategories[0];
        const isExcludedCategory = primaryCategory === 'maybeboard' || primaryCategory === 'sideboard';
        if (isExcludedCategory) {
          return null;
        }
        const hasCommanderCategory = normalizedCategories.includes('commander');
        return {
          name: entry?.card?.oracleCard?.name || entry?.card?.name || entry?.cardName,
          quantity: entry?.quantity ?? entry?.qty ?? 0,
          section:
            entry?.category ||
            entry?.board ||
            entry?.section ||
            (hasCommanderCategory ? 'Commander' : undefined)
        };
      })
      .filter((entry: any) => entry?.name)
    : [];

  return {
    source: 'archidekt',
    name: deck.name || 'Untitled Deck',
    url: deckUrl,
    format: deck.format || deck.deckFormat || null,
    cards
  };
}
