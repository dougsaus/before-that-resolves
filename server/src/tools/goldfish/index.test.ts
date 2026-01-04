import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunContext } from '@openai/agents';

const mockGetLastCachedArchidektDeck = vi.fn();

vi.mock('../../services/deck', () => ({
  getLastCachedArchidektDeck: mockGetLastCachedArchidektDeck
}));

type ToolSet = typeof import('./index');
type CardRef = { id: string; name: string };

function buildDeck(cardCount: number, commanderName: string) {
  const cards = [{ name: commanderName, quantity: 1, section: 'Commander' }];
  for (let i = 1; i <= cardCount - 1; i += 1) {
    cards.push({ name: `Card ${i}`, quantity: 1, section: 'Mainboard' });
  }
  return {
    source: 'archidekt' as const,
    name: 'Test Deck',
    url: 'https://archidekt.com/decks/123456/example',
    format: 'Commander',
    cards
  };
}

type ToolInvoker = {
  invoke: (runContext: RunContext<unknown>, input: string, details?: { toolCall: unknown }) => Promise<unknown>;
};

async function invokeTool<TInput, TResult>(
  tool: ToolInvoker,
  input: TInput
): Promise<TResult> {
  return tool.invoke({} as RunContext<unknown>, JSON.stringify(input), undefined) as Promise<TResult>;
}

async function loadTools(): Promise<ToolSet> {
  vi.resetModules();
  return import('./index');
}

async function buildTools(conversationId = 'conv-123') {
  const tools = await loadTools();
  return {
    ...tools,
    loadDeck: tools.createLoadDeckTool(conversationId)
  };
}

describe('goldfish tools', () => {
  beforeEach(() => {
    mockGetLastCachedArchidektDeck.mockReset();
    mockGetLastCachedArchidektDeck.mockReturnValue(buildDeck(100, "Atraxa, Praetors' Voice"));
  });

  it('loads a deck and resets zones with commander in command zone', async () => {
    const tools = await buildTools();

    const loadResult = await invokeTool<
      Record<string, never>,
      { ok: boolean; error?: string; cardCount?: number }
    >(tools.loadDeck, {});
    expect(loadResult.ok).toBe(true);

    const resetResult = await invokeTool<
      { seed: number },
      { zones: { commandCount: number; libraryCount: number; handCount: number } }
    >(tools.reset, { seed: 1 });
    expect(resetResult.zones.commandCount).toBe(1);
    expect(resetResult.zones.libraryCount).toBe(99);
    expect(resetResult.zones.handCount).toBe(0);

    const commandZone = await invokeTool<{ zone: string }, { cards: CardRef[] }>(
      tools.zoneContents,
      { zone: 'command' }
    );
    expect(commandZone.cards[0]?.name).toBe("Atraxa, Praetors' Voice");
  });

  it('rejects decks that are not exactly 100 cards', async () => {
    mockGetLastCachedArchidektDeck.mockReturnValue(buildDeck(99, "Atraxa, Praetors' Voice"));
    const tools = await buildTools();

    const loadResult = await invokeTool<
      Record<string, never>,
      { ok: boolean; error?: string; cardCount?: number }
    >(tools.loadDeck, {});

    expect(loadResult.ok).toBe(false);
  });

  it('produces deterministic shuffles with a seed', async () => {
    const tools = await buildTools();

    await invokeTool(tools.loadDeck, {});
    await invokeTool(tools.reset, { seed: 42 });
    const peekOne = await invokeTool<{ n: number }, { cards: CardRef[] }>(tools.peek, { n: 5 });

    await invokeTool(tools.reset, { seed: 42 });
    const peekTwo = await invokeTool<{ n: number }, { cards: CardRef[] }>(tools.peek, { n: 5 });

    expect(peekOne.cards.map((card) => card.name)).toEqual(
      peekTwo.cards.map((card) => card.name)
    );
  });

  it('draws cards into the requested zone', async () => {
    const tools = await buildTools();

    await invokeTool(tools.loadDeck, {});
    await invokeTool(tools.reset, { seed: 5 });

    const drawResult = await invokeTool<{ n: number }, { cards: CardRef[]; libraryCount: number }>(
      tools.draw,
      { n: 2 }
    );
    expect(drawResult.cards).toHaveLength(2);
    expect(drawResult.libraryCount).toBe(97);

    const handZone = await invokeTool<{ zone: string }, { cards: CardRef[] }>(
      tools.zoneContents,
      { zone: 'hand' }
    );
    expect(handZone.cards).toHaveLength(2);

    await invokeTool(tools.draw, { n: 1, toZone: 'battlefield' });
    const battlefield = await invokeTool<{ zone: string }, { cards: CardRef[] }>(
      tools.zoneContents,
      { zone: 'battlefield' }
    );
    expect(battlefield.cards).toHaveLength(1);
  });

  it('peeks without moving cards', async () => {
    const tools = await buildTools();

    await invokeTool(tools.loadDeck, {});
    await invokeTool(tools.reset, { seed: 9 });

    const peekResult = await invokeTool<{ n: number }, { cards: CardRef[] }>(tools.peek, { n: 3 });
    const drawResult = await invokeTool<{ n: number }, { cards: CardRef[] }>(tools.draw, { n: 1 });

    expect(peekResult.cards[0]?.id).toBe(drawResult.cards[0]?.id);
  });

  it('moves cards by id between zones and validates library placement', async () => {
    const tools = await buildTools();

    await invokeTool(tools.loadDeck, {});
    await invokeTool(tools.reset, { seed: 3 });

    const drawResult = await invokeTool<{ n: number }, { cards: CardRef[] }>(tools.draw, { n: 1 });
    const cardId = drawResult.cards[0].id;

    const invalidMove = await invokeTool<{ cardId: string; fromZone: string; toZone: string }, { ok: boolean }>(
      tools.moveById,
      {
      cardId,
      fromZone: 'hand',
      toZone: 'library'
      }
    );
    expect(invalidMove.ok).toBe(false);

    const validMove = await invokeTool<{ cardId: string; fromZone: string; toZone: string }, { ok: boolean }>(
      tools.moveById,
      {
      cardId,
      fromZone: 'hand',
      toZone: 'battlefield'
      }
    );
    expect(validMove.ok).toBe(true);

    const handZone = await invokeTool<{ zone: string }, { cards: CardRef[] }>(
      tools.zoneContents,
      { zone: 'hand' }
    );
    const battlefield = await invokeTool<{ zone: string }, { cards: CardRef[] }>(
      tools.zoneContents,
      { zone: 'battlefield' }
    );
    expect(handZone.cards).toHaveLength(0);
    expect(battlefield.cards).toHaveLength(1);
  });

  it('moves cards between library and revealed to simulate scry', async () => {
    const tools = await buildTools();

    await invokeTool(tools.loadDeck, {});
    await invokeTool(tools.reset, { seed: 15 });

    const peekResult = await invokeTool<{ n: number }, { cards: CardRef[] }>(tools.peek, { n: 1 });
    const cardId = peekResult.cards[0].id;

    const toRevealed = await invokeTool<
      { cardId: string; fromZone: string; toZone: string },
      { ok: boolean }
    >(tools.moveById, {
      cardId,
      fromZone: 'library',
      toZone: 'revealed'
    });
    expect(toRevealed.ok).toBe(true);

    const backToTop = await invokeTool<
      { cardId: string; fromZone: string; toZone: string; toLibraryPosition: string },
      { ok: boolean }
    >(tools.moveById, {
      cardId,
      fromZone: 'revealed',
      toZone: 'library',
      toLibraryPosition: 'top'
    });
    expect(backToTop.ok).toBe(true);

    const drawResult = await invokeTool<{ n: number }, { cards: CardRef[] }>(tools.draw, { n: 1 });
    expect(drawResult.cards[0]?.id).toBe(cardId);
  });

  it('finds and moves a card by name with shuffling', async () => {
    const tools = await buildTools();

    await invokeTool(tools.loadDeck, {});
    await invokeTool(tools.reset, { seed: 11 });

    const targetName = 'Card 10';
    const moveResult = await invokeTool<
      { cardName: string },
      { ok: boolean; movedCard: CardRef }
    >(tools.findAndMoveByName, { cardName: targetName });
    expect(moveResult.ok).toBe(true);
    expect(moveResult.movedCard.name).toBe(targetName);

    const handZone = await invokeTool<{ zone: string }, { cards: CardRef[] }>(
      tools.zoneContents,
      { zone: 'hand' }
    );
    expect(handZone.cards.some((card) => card.name === targetName)).toBe(true);
  });

  it('returns ok:false when moves are impossible and preserves state', async () => {
    const tools = await buildTools();

    await invokeTool(tools.loadDeck, {});
    await invokeTool(tools.reset, { seed: 21 });

    const drawResult = await invokeTool<{ n: number }, { libraryCount: number }>(tools.draw, { n: 99 });
    expect(drawResult.libraryCount).toBe(0);

    const failDraw = await invokeTool<{ n: number }, { ok: boolean }>(tools.draw, { n: 1 });
    expect(failDraw.ok).toBe(false);

    const failMove = await invokeTool<{ cardName: string }, { ok: boolean }>(
      tools.findAndMoveByName,
      { cardName: 'Does Not Exist' }
    );
    expect(failMove.ok).toBe(false);

    const handZone = await invokeTool<{ zone: string }, { cards: CardRef[] }>(
      tools.zoneContents,
      { zone: 'hand' }
    );
    expect(handZone.cards).toHaveLength(99);
  });

  it('loads from the currently loaded deck', async () => {
    mockGetLastCachedArchidektDeck.mockReturnValue(buildDeck(100, "Atraxa, Praetors' Voice"));
    const tools = await buildTools();

    const loadResult = await invokeTool<
      Record<string, never>,
      { ok: boolean; error?: string; cardCount?: number }
    >(tools.loadDeck, {});

    expect(loadResult.ok).toBe(true);
  });
});
