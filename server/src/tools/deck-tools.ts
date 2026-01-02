import { z } from 'zod';
import { tool } from '@openai/agents';
import { getLastCachedArchidektDeck, getLastCachedArchidektDeckRaw } from '../services/deck';

export const getArchidektDeckTool = tool({
  name: 'get_archidekt_deck',
  description: 'Return the currently loaded Archidekt deck list',
  parameters: z.object({}),
  execute: async () => {
    const deck = getLastCachedArchidektDeck();
    if (!deck) {
      return { success: false, message: 'No Archidekt deck is loaded' };
    }
    return { success: true, deck };
  }
});

export const getArchidektDeckRawTool = tool({
  name: 'get_archidekt_deck_raw',
  description: 'Return the currently loaded raw Archidekt deck payload',
  parameters: z.object({}),
  execute: async () => {
    const deck = getLastCachedArchidektDeckRaw();
    if (!deck) {
      return { success: false, message: 'No Archidekt deck is loaded' };
    }
    return { success: true, deck };
  }
});
