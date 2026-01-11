import { z } from 'zod';
import { tool } from '@openai/agents';
import { scryfallService } from '../services/scryfall';
import type { Card, CardFace } from '../types/shared';

type ToolCardFace = {
  name?: string;
  manaCost?: string;
  type?: string;
  oracleText?: string;
  colors?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
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
  cardFaces?: ToolCardFace[];
};

function formatColors(colors?: string[]) {
  return colors && colors.length > 0 ? colors.join(', ') : 'Colorless';
}

function formatCardFace(face: CardFace): ToolCardFace {
  return {
    name: face.name,
    manaCost: face.mana_cost,
    type: face.type_line,
    oracleText: face.oracle_text,
    colors: formatColors(face.colors),
    power: face.power,
    toughness: face.toughness,
    loyalty: face.loyalty
  };
}

function formatToolCard(card: Card): ToolCard {
  return {
    name: card.name,
    layout: card.layout,
    manaCost: card.mana_cost,
    type: card.type_line,
    oracleText: card.oracle_text,
    colors: formatColors(card.color_identity),
    power: card.power,
    toughness: card.toughness,
    loyalty: card.loyalty,
    cardFaces: card.card_faces?.map(formatCardFace)
  };
}

/**
 * Card Search Tool
 *
 * LEARNING POINT: This is how you create a tool for an agent!
 * - Use Zod to define the parameter schema
 * - The schema automatically validates input
 * - Type inference gives you TypeScript types
 */
export const searchCardTool = tool({
  name: 'search_card',
  description: 'Search for a Magic: The Gathering card by name',
  parameters: z.object({
    cardName: z.string().describe('The name of the card to search for')
  }),
  execute: async ({ cardName }) => {
    console.log(`🔍 Searching for card: ${cardName}`);

    const card = await scryfallService.searchCardByName(cardName);

    if (!card) {
      return {
        success: false,
        message: `Card "${cardName}" not found`
      };
    }

    return {
      success: true,
      card: formatToolCard(card)
    };
  }
});

/**
 * Card Collection Tool
 *
 * LEARNING POINT: Batch multiple card lookups in one call.
 */
export const cardCollectionTool = tool({
  name: 'card_collection',
  description: 'Fetch a batch of cards by name using Scryfall collection lookup',
  parameters: z.object({
    cardNames: z.array(z.string()).min(1).max(75)
      .describe('Array of card names to fetch in a single batch')
  }),
  execute: async ({ cardNames }) => {
    console.log(`🧺 Fetching card collection: ${cardNames.join(', ')}`);

    const { cards, notFound } = await scryfallService.getCardCollection(cardNames);

    return {
      success: true,
      count: cards.length,
      notFound,
      cards: cards.map((card) => formatToolCard(card))
    };
  }
});

/**
 * Advanced Card Search Tool
 *
 * LEARNING POINT: More complex Zod schemas with optional fields
 * and enums for type safety!
 */
export const advancedSearchTool = tool({
  name: 'advanced_search',
  description: 'Search for cards with specific criteria',
  parameters: z.object({
    query: z.string().optional().nullable().describe('Search query in Scryfall syntax'),
    colors: z.array(z.enum(['W', 'U', 'B', 'R', 'G'])).optional().nullable()
      .describe('Color identity to search for'),
    type: z.string().optional().nullable().describe('Card type (e.g., "creature", "instant")'),
    commander: z.boolean().optional().nullable().describe('Only search for legendary creatures'),
    limit: z.number().min(1).max(20).default(5).describe('Maximum results to return')
  }),
  execute: async ({ query, colors, type, commander, limit }) => {
    console.log(`🔍 Advanced search with criteria:`, { query, colors, type, commander, limit });

    // Build Scryfall query
    let searchQuery = query || '';

    if (colors && colors.length > 0) {
      searchQuery += ` c:${colors.join('')}`;
    }

    if (type) {
      searchQuery += ` t:${type}`;
    }

    if (commander) {
      searchQuery += ' is:commander';
    }

    const cards = await scryfallService.searchCards(searchQuery.trim(), limit);

    return {
      success: true,
      count: cards.length,
      cards: cards.map((card) => formatToolCard(card))
    };
  }
});

/**
 * Get Card Rulings Tool
 *
 * LEARNING POINT: Tools can call multiple API methods
 * and combine results!
 */
export const getCardRulingsTool = tool({
  name: 'get_card_rulings',
  description: 'Get official rulings for a specific card',
  parameters: z.object({
    cardName: z.string().describe('The name of the card to get rulings for')
  }),
  execute: async ({ cardName }) => {
    console.log(`📜 Getting rulings for: ${cardName}`);

    // First, find the card to get its ID
    const card = await scryfallService.searchCardByName(cardName);

    if (!card) {
      return {
        success: false,
        message: `Card "${cardName}" not found`
      };
    }

    // Then get its rulings
    const rulings = await scryfallService.getCardRulings(card.id);

    return {
      success: true,
      card: card.name,
      rulings: rulings.length > 0 ? rulings : ['No official rulings for this card']
    };
  }
});

/**
 * Random Commander Suggestion Tool
 *
 * LEARNING POINT: Simple tools don't need parameters!
 */
export const randomCommanderTool = tool({
  name: 'random_commander',
  description: 'Get a random legendary creature for Commander',
  parameters: z.object({}), // No parameters needed
  execute: async () => {
    console.log(`🎲 Getting random commander...`);

    const commander = await scryfallService.getRandomCommander();

    if (!commander) {
      return {
        success: false,
        message: 'Failed to get random commander'
      };
    }

    return {
      success: true,
      commander: formatToolCard(commander)
    };
  }
});

/**
 * Commander Legality Check Tool
 *
 * LEARNING POINT: Tools can implement business logic,
 * not just API calls!
 */
export const checkCommanderLegalityTool = tool({
  name: 'check_commander_legality',
  description: 'Check if a card can be your commander',
  parameters: z.object({
    cardName: z.string().describe('The card to check for commander legality')
  }),
  execute: async ({ cardName }) => {
    console.log(`⚖️ Checking commander legality for: ${cardName}`);

    const card = await scryfallService.searchCardByName(cardName);

    if (!card) {
      return {
        success: false,
        message: `Card "${cardName}" not found`
      };
    }

    // Check if it's a legendary creature or has "can be your commander"
    const isLegendaryCreature = card.type_line.includes('Legendary') &&
                                card.type_line.includes('Creature');
    const canBeCommander = card.oracle_text?.includes('can be your commander') || false;

    const isLegal = isLegendaryCreature || canBeCommander;

    return {
      success: true,
      card: card.name,
      isLegal,
      reason: isLegal
        ? 'This card can be your commander'
        : 'Only legendary creatures (or cards that say "can be your commander") are legal commanders',
      colorIdentity: card.color_identity.length > 0
        ? card.color_identity.join(', ')
        : 'Colorless'
    };
  }
});
