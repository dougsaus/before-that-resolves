import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunContext } from '@openai/agents';

const mockGetLastCachedDeck = vi.fn();
const mockGetLastCachedDeckRaw = vi.fn();

vi.mock('../services/deck', () => ({
  getLastCachedDeck: mockGetLastCachedDeck,
  getLastCachedDeckRaw: mockGetLastCachedDeckRaw
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
    mockGetLastCachedDeck.mockReset();
    mockGetLastCachedDeckRaw.mockReset();
  });

  it('returns loaded deck data for get_loaded_deck', async () => {
    mockGetLastCachedDeck.mockReturnValue({
      source: 'archidekt',
      name: 'Cached Deck',
      url: 'https://archidekt.com/decks/1/test',
      format: 'commander',
      cards: []
    });
    const tools = await loadTools();
    const tool = tools.createLoadedDeckTool('conv-123');

    const result = await invokeTool<Record<string, never>, { success: boolean; deck?: { name?: string } }>(
      tool,
      {}
    );

    expect(result.success).toBe(true);
    expect(result.deck?.name).toBe('Cached Deck');
    expect(mockGetLastCachedDeck).toHaveBeenCalledWith('conv-123');
  });

  it('returns loaded raw data for get_loaded_deck_raw', async () => {
    mockGetLastCachedDeckRaw.mockReturnValue({
      source: 'moxfield',
      deck: { name: 'Raw Cached Deck' }
    });
    const tools = await loadTools();
    const tool = tools.createLoadedDeckRawTool('conv-123');

    const result = await invokeTool<Record<string, never>, { success: boolean; deck?: { name?: string }; source?: string }>(
      tool,
      {}
    );

    expect(result.success).toBe(true);
    expect(result.deck?.name).toBe('Raw Cached Deck');
    expect(result.source).toBe('moxfield');
    expect(mockGetLastCachedDeckRaw).toHaveBeenCalledWith('conv-123');
  });

  it('returns an error when no deck is loaded', async () => {
    mockGetLastCachedDeck.mockReturnValue(null);
    const tools = await loadTools();
    const tool = tools.createLoadedDeckTool('conv-123');

    const result = await invokeTool<Record<string, never>, { success: boolean; message?: string }>(
      tool,
      {}
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/No deck is loaded/);
    expect(mockGetLastCachedDeck).toHaveBeenCalledWith('conv-123');
  });
});
