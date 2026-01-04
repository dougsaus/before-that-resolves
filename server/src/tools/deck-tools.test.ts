import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunContext } from '@openai/agents';

const mockGetLastCachedArchidektDeck = vi.fn();
const mockGetLastCachedArchidektDeckRaw = vi.fn();

vi.mock('../services/deck', () => ({
  getLastCachedArchidektDeck: mockGetLastCachedArchidektDeck,
  getLastCachedArchidektDeckRaw: mockGetLastCachedArchidektDeckRaw
}));

type ToolInvoker = {
  invoke: (runContext: RunContext<unknown>, input: string, details?: { toolCall: unknown }) => Promise<unknown>;
};

async function invokeTool<TInput, TResult>(
  tool: ToolInvoker,
  input: TInput
): Promise<TResult> {
  return tool.invoke({} as RunContext<unknown>, JSON.stringify(input), undefined) as Promise<TResult>;
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
    const tool = tools.createArchidektDeckTool('conv-123');

    const result = await invokeTool<Record<string, never>, { success: boolean; deck?: { name?: string } }>(
      tool,
      {}
    );

    expect(result.success).toBe(true);
    expect(result.deck?.name).toBe('Cached Deck');
    expect(mockGetLastCachedArchidektDeck).toHaveBeenCalledWith('conv-123');
  });

  it('returns loaded raw data for get_archidekt_deck_raw', async () => {
    mockGetLastCachedArchidektDeckRaw.mockReturnValue({ name: 'Raw Cached Deck' });
    const tools = await loadTools();
    const tool = tools.createArchidektDeckRawTool('conv-123');

    const result = await invokeTool<Record<string, never>, { success: boolean; deck?: { name?: string } }>(
      tool,
      {}
    );

    expect(result.success).toBe(true);
    expect(result.deck?.name).toBe('Raw Cached Deck');
    expect(mockGetLastCachedArchidektDeckRaw).toHaveBeenCalledWith('conv-123');
  });

  it('returns an error when no deck is loaded', async () => {
    mockGetLastCachedArchidektDeck.mockReturnValue(null);
    const tools = await loadTools();
    const tool = tools.createArchidektDeckTool('conv-123');

    const result = await invokeTool<Record<string, never>, { success: boolean; message?: string }>(
      tool,
      {}
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/No Archidekt deck is loaded/);
    expect(mockGetLastCachedArchidektDeck).toHaveBeenCalledWith('conv-123');
  });
});
