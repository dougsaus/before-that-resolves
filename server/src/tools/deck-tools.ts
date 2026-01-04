import { z } from 'zod';
import { tool } from '@openai/agents';
import { getLastCachedArchidektDeck, getLastCachedArchidektDeckRaw } from '../services/deck';

export function createArchidektDeckTool(conversationId: string) {
  return tool({
    name: 'get_archidekt_deck',
    description: 'Return the currently loaded Archidekt deck list',
    parameters: z.object({}),
    execute: async () => {
      const deck = getLastCachedArchidektDeck(conversationId);
      if (!deck) {
        return { success: false, message: 'No Archidekt deck is loaded' };
      }
      return { success: true, deck };
    }
  });
}

export function createArchidektDeckRawTool(conversationId: string) {
  return tool({
    name: 'get_archidekt_deck_raw',
    description: 'Return the currently loaded raw Archidekt deck payload',
    parameters: z.object({}),
    execute: async () => {
      const deck = getLastCachedArchidektDeckRaw(conversationId);
      if (!deck) {
        return { success: false, message: 'No Archidekt deck is loaded' };
      }
      return { success: true, deck };
    }
  });
}
