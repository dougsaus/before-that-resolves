import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildArchidektDeckData,
  buildMoxfieldDeckData,
  cacheDeckFromUrl,
  fetchDeckSummary,
  getLastCachedDeck
} from './deck';

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
          quantity: 1,
          categories: ['Sideboard', 'Artifact'],
          card: { oracleCard: { name: 'Wishboard Card' } }
        },
        {
          quantity: 1,
          categories: ['Maybeboard', 'Instant'],
          card: { oracleCard: { name: 'Maybe Card' } }
        },
        {
          quantity: 1,
          categories: ['Land', 'Sideboard'],
          card: { oracleCard: { name: 'Main Deck Land' } }
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
    expect(deck.cards.length).toBe(3);
    expect(deck.cards[0].name).toBe('Edgar Markov');
    expect(deck.cards[0].section).toBe('Commander');
    expect(deck.format).toBe('commander');
    expect(deck.cards.some((card) => card.name === 'Wishboard Card')).toBe(false);
    expect(deck.cards.some((card) => card.name === 'Maybe Card')).toBe(false);
    expect(deck.cards.some((card) => card.name === 'Main Deck Land')).toBe(true);
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
    } as unknown as Response);

    const deck = await cacheDeckFromUrl(
      'https://archidekt.com/decks/99999/raw',
      'conv-123'
    );

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
    } as unknown as Response);

    await cacheDeckFromUrl('https://archidekt.com/decks/55555/cache', 'conv-123');
    const cached = getLastCachedDeck('conv-123');

    expect(cached?.name).toBe('Cached Deck');
    expect(cached?.cards[0]?.name).toBe('Edgar Markov');
  });

  it('ignores numeric deck format values in summaries', async () => {
    const deckData = {
      name: 'Numeric Format Deck',
      deckFormat: 3,
      cards: []
    };

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => deckData
    } as unknown as Response);

    const summary = await fetchDeckSummary(
      'https://archidekt.com/decks/77777/numeric'
    );

    expect(summary.format).toBeNull();
  });

  it('builds deck data from a raw Moxfield payload', () => {
    const deckData = {
      name: 'Mox Deck',
      format: 'commander',
      boards: {
        commanders: {
          cards: {
            commander: { quantity: 1, card: { name: 'Alela, Artful Provocateur' } }
          },
          count: 1
        },
        mainboard: {
          cards: {
            card1: { quantity: 2, card: { name: 'Sol Ring' } }
          },
          count: 2
        },
        sideboard: {
          cards: {
            card2: { quantity: 1, card: { name: 'Sideboard Card' } }
          },
          count: 1
        }
      }
    };

    const deck = buildMoxfieldDeckData(deckData, 'https://moxfield.com/decks/abc123');

    expect(deck.source).toBe('moxfield');
    expect(deck.name).toBe('Mox Deck');
    expect(deck.format).toBe('commander');
    expect(deck.cards.length).toBe(2);
    expect(deck.cards.some((card) => card.name === 'Sideboard Card')).toBe(false);
    expect(deck.cards.some((card) => card.section === 'Commander')).toBe(true);
  });

  it('summarizes Moxfield decks using commander boards', async () => {
    const deckData = {
      name: 'Mox Summary',
      format: 'commander',
      colorIdentity: ['U', 'B'],
      boards: {
        commanders: {
          cards: {
            commander: { quantity: 1, card: { name: 'Satoru Umezawa' } }
          },
          count: 1
        }
      }
    };

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => deckData
    } as unknown as Response);

    const summary = await fetchDeckSummary('https://moxfield.com/decks/xyz987');

    expect(summary.name).toBe('Mox Summary');
    expect(summary.commanderNames).toEqual(['Satoru Umezawa']);
    expect(summary.colorIdentity).toEqual(['U', 'B']);
    expect(summary.source).toBe('moxfield');
  });
});
