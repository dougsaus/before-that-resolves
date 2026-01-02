import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildArchidektDeckData, cacheArchidektDeckFromUrl, getLastCachedArchidektDeck } from './deck';

describe('deck service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds deck data from a raw Archidekt payload', async () => {
    const deckData = {
      name: 'Archi Deck',
      deckFormat: 'commander',
      cards: [
        {
          quantity: 1,
          categories: ['Commander'],
          card: { oracleCard: { name: 'Edgar Markov' } }
        },
        {
          quantity: 2,
          categories: ['Mainboard'],
          card: { name: 'Swamp' }
        }
      ]
    };

    const deck = buildArchidektDeckData(deckData, 'https://archidekt.com/decks/12345/test');

    expect(deck.source).toBe('archidekt');
    expect(deck.name).toBe('Archi Deck');
    expect(deck.cards.length).toBe(2);
    expect(deck.cards[0].name).toBe('Edgar Markov');
    expect(deck.cards[0].section).toBe('Commander');
    expect(deck.format).toBe('commander');
  });

  it('loads raw Archidekt deck data from a valid URL', async () => {
    const deckData = {
      name: 'Raw Deck',
      cards: []
    };

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => deckData
    } as any);

    const deck = await cacheArchidektDeckFromUrl('https://archidekt.com/decks/99999/raw');

    expect(deck.name).toBe('Raw Deck');
  });

  it('exposes the last cached deck as structured data', async () => {
    const deckData = {
      name: 'Cached Deck',
      deckFormat: 'commander',
      cards: [
        {
          quantity: 1,
          categories: ['Commander'],
          card: { oracleCard: { name: 'Edgar Markov' } }
        }
      ]
    };

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => deckData
    } as any);

    await cacheArchidektDeckFromUrl('https://archidekt.com/decks/55555/cache');
    const cached = getLastCachedArchidektDeck();

    expect(cached?.name).toBe('Cached Deck');
    expect(cached?.cards[0]?.name).toBe('Edgar Markov');
  });
});
