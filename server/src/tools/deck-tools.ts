import { z } from 'zod';
import { tool } from '@openai/agents';
import { fetchArchidektDeck } from '../services/deck';

export const loadArchidektDeckTool = tool({
  name: 'load_archidekt_deck',
  description: 'Load a Commander deck list from an Archidekt deck URL',
  parameters: z.object({
    deckUrl: z.string().min(1).describe('The Archidekt deck URL')
  }),
  execute: async ({ deckUrl }) => {
    console.log(`🗂️ Loading Archidekt deck: ${deckUrl}`);
    try {
      const deck = await fetchArchidektDeck(deckUrl);
      return {
        success: true,
        deck
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || 'Failed to load Archidekt deck'
      };
    }
  }
});
