import { z } from 'zod';
import { tool } from '@openai/agents';
import { getLastCachedDeck, getLastCachedDeckRaw } from '../services/deck';

export function createLoadedDeckTool(conversationId: string) {
  return tool({
    name: 'get_loaded_deck',
    description: 'Return the currently loaded deck list',
    parameters: z.object({}),
    execute: async () => {
      const deck = getLastCachedDeck(conversationId);
      if (!deck) {
        return { success: false, message: 'No deck is loaded' };
      }
      return { success: true, deck };
    }
  });
}

export function createLoadedDeckRawTool(conversationId: string) {
  return tool({
    name: 'get_loaded_deck_raw',
    description: 'Return the currently loaded raw deck payload',
    parameters: z.object({}),
    execute: async () => {
      const deck = getLastCachedDeckRaw(conversationId);
      if (!deck) {
        return { success: false, message: 'No deck is loaded' };
      }
      return { success: true, deck: deck.deck, source: deck.source };
    }
  });
}
