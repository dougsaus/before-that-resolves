import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetLastCachedArchidektDeck = vi.fn();
const mockGetLastCachedArchidektDeckRaw = vi.fn();

vi.mock('../services/deck', () => ({
  getLastCachedArchidektDeck: mockGetLastCachedArchidektDeck,
  getLastCachedArchidektDeckRaw: mockGetLastCachedArchidektDeckRaw
}));

type ToolInvoker = {
  invoke: (runContext: unknown, input: string, details?: unknown) => Promise<unknown>;
};

async function invokeTool<TInput, TResult>(
  tool: ToolInvoker,
  input: TInput
): Promise<TResult> {
  return tool.invoke(undefined, JSON.stringify(input), undefined);
}

async function loadTools() {
  vi.resetModules();
  return import('./deck-tools');
}

describe('deck tools', () => {
  beforeEach(() => {
    mockGetLastCachedArchidektDeck.mockReset();
    mockGetLastCachedArchidektDeckRaw.mockReset();
  });

  it('returns loaded deck data for get_archidekt_deck', async () => {
    mockGetLastCachedArchidektDeck.mockReturnValue({
      source: 'archidekt',
      name: 'Cached Deck',
      url: 'https://archidekt.com/decks/1/test',
      format: 'commander',
      cards: []
    });
    const tools = await loadTools();

    const result = await invokeTool<Record<string, never>, { success: boolean; deck?: unknown }>(
      tools.getArchidektDeckTool,
      {}
    );

    expect(result.success).toBe(true);
    expect(result.deck?.name).toBe('Cached Deck');
  });

  it('returns loaded raw data for get_archidekt_deck_raw', async () => {
    mockGetLastCachedArchidektDeckRaw.mockReturnValue({ name: 'Raw Cached Deck' });
    const tools = await loadTools();

    const result = await invokeTool<Record<string, never>, { success: boolean; deck?: unknown }>(
      tools.getArchidektDeckRawTool,
      {}
    );

    expect(result.success).toBe(true);
    expect(result.deck?.name).toBe('Raw Cached Deck');
  });

  it('returns an error when no deck is loaded', async () => {
    mockGetLastCachedArchidektDeck.mockReturnValue(null);
    const tools = await loadTools();

    const result = await invokeTool<Record<string, never>, { success: boolean; message?: string }>(
      tools.getArchidektDeckTool,
      {}
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/No Archidekt deck is loaded/);
  });
});
