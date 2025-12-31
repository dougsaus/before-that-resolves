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

export async function fetchArchidektDeck(deckUrl: string): Promise<DeckData> {
  const deckId = parseDeckId(deckUrl, 'archidekt.com');
  if (!deckId) {
    throw new Error('Invalid Archidekt URL. Expected https://archidekt.com/decks/{deckId}/{slug}');
  }

  const apiUrl = `https://archidekt.com/api/decks/${deckId}/`;
  const result = await fetchJson(apiUrl);

  if (!result.ok || !result.json) {
    throw new Error(result.error || 'Failed to load Archidekt deck');
  }

  const deck = result.json;
  const cards = Array.isArray(deck.cards)
    ? deck.cards
      .map((entry: any) => ({
        name: entry?.card?.oracleCard?.name || entry?.card?.name || entry?.cardName,
        quantity: entry?.quantity ?? entry?.qty ?? 0,
        section: entry?.category || entry?.board || entry?.section
      }))
      .filter((entry: any) => entry.name)
    : [];

  return {
    source: 'archidekt',
    name: deck.name || 'Untitled Deck',
    url: deckUrl,
    format: deck.format || null,
    cards
  };
}
