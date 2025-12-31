import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchArchidektDeck } from './deck';

describe('deck service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads an Archidekt deck from a valid URL', async () => {
    const deckData = {
      name: 'Archi Deck',
      format: 'commander',
      cards: [
        {
          quantity: 1,
          category: 'Commander',
          card: { oracleCard: { name: 'Edgar Markov' } }
        },
        {
          quantity: 2,
          category: 'Mainboard',
          card: { name: 'Swamp' }
        }
      ]
    };

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => deckData
    } as any);

    const deck = await fetchArchidektDeck('https://archidekt.com/decks/12345/test');

    expect(deck.source).toBe('archidekt');
    expect(deck.name).toBe('Archi Deck');
    expect(deck.cards.length).toBe(2);
    expect(deck.cards[0].name).toBe('Edgar Markov');
  });

  it('rejects invalid deck URLs', async () => {
    await expect(fetchArchidektDeck('https://example.com/decks/123')).rejects.toThrow(
      /Invalid Archidekt URL/
    );
  });
});
