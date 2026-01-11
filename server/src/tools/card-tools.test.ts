import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunContext } from '@openai/agents';
import type { Card } from '../types/shared';

const mockSearchCardByName = vi.fn();
const mockGetCardCollection = vi.fn();
const mockSearchCards = vi.fn();
const mockGetRandomCommander = vi.fn();
const mockGetCardRulings = vi.fn();

vi.mock('../services/scryfall', () => ({
  scryfallService: {
    searchCardByName: mockSearchCardByName,
    getCardCollection: mockGetCardCollection,
    searchCards: mockSearchCards,
    getRandomCommander: mockGetRandomCommander,
    getCardRulings: mockGetCardRulings
  }
}));

type ToolInvoker = {
  invoke: (runContext: RunContext<unknown>, input: string, details?: { toolCall: unknown }) => Promise<unknown>;
};

type ToolCard = {
  name: string;
  layout?: string;
  manaCost?: string;
  type: string;
  oracleText?: string;
  colors: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  cardFaces?: Array<{
    name?: string;
    manaCost?: string;
    type?: string;
    oracleText?: string;
    colors?: string;
    power?: string;
    toughness?: string;
    loyalty?: string;
  }>;
};

async function invokeTool<TInput, TResult>(tool: ToolInvoker, input: TInput): Promise<TResult> {
  return tool.invoke({} as RunContext<unknown>, JSON.stringify(input), undefined) as Promise<TResult>;
}

async function loadTools() {
  vi.resetModules();
  return import('./card-tools');
}

function buildDoubleFacedCard(): Card {
  return {
    id: 'card-1',
    name: 'Avatar Aang // Aang, Master of Elements',
    layout: 'transform',
    mana_cost: undefined,
    type_line: 'Legendary Creature — Avatar // Legendary Creature — Avatar',
    oracle_text: undefined,
    colors: ['W', 'U'],
    color_identity: ['W', 'U'],
    power: undefined,
    toughness: undefined,
    loyalty: undefined,
    image_uris: { normal: 'https://img.scryfall.com/card.png' },
    card_faces: [
      {
        name: 'Avatar Aang',
        mana_cost: '{W}{U}',
        type_line: 'Legendary Creature — Avatar',
        oracle_text: 'Face one text.',
        colors: ['W', 'U'],
        power: '3',
        toughness: '3'
      },
      {
        name: 'Aang, Master of Elements',
        mana_cost: '{W}{U}',
        type_line: 'Legendary Creature — Avatar',
        oracle_text: 'Face two text.',
        colors: ['W', 'U'],
        power: '4',
        toughness: '4'
      }
    ]
  };
}

describe('card tools', () => {
  beforeEach(() => {
    mockSearchCardByName.mockReset();
    mockGetCardCollection.mockReset();
    mockSearchCards.mockReset();
    mockGetRandomCommander.mockReset();
    mockGetCardRulings.mockReset();
  });

  it('returns card faces for search_card', async () => {
    const mockCard = buildDoubleFacedCard();
    mockSearchCardByName.mockResolvedValue(mockCard);
    const tools = await loadTools();

    const result = await invokeTool<{ cardName: string }, { success: boolean; card: ToolCard }>(
      tools.searchCardTool,
      { cardName: 'Avatar Aang' }
    );

    expect(result.success).toBe(true);
    expect(result.card.layout).toBe('transform');
    expect(result.card.oracleText).toBeUndefined();
    expect(result.card.colors).toBe('W, U');
    expect(result.card.cardFaces).toHaveLength(2);
    expect(result.card.cardFaces?.[0]?.name).toBe('Avatar Aang');
    expect(result.card.cardFaces?.[0]?.oracleText).toBe('Face one text.');
  });

  it('returns card faces for card_collection', async () => {
    const mockCard = buildDoubleFacedCard();
    mockGetCardCollection.mockResolvedValue({ cards: [mockCard], notFound: [] });
    const tools = await loadTools();

    const result = await invokeTool<
      { cardNames: string[] },
      { success: boolean; count: number; cards: ToolCard[]; notFound: string[] }
    >(tools.cardCollectionTool, { cardNames: ['Avatar Aang'] });

    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(result.cards[0]?.cardFaces?.[1]?.name).toBe('Aang, Master of Elements');
    expect(result.cards[0]?.cardFaces?.[1]?.oracleText).toBe('Face two text.');
  });
});
