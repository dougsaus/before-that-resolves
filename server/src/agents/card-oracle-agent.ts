import { Agent, run } from '@openai/agents';
import { openaiConfig } from '../config/openai';
import {
  searchCardTool,
  advancedSearchTool,
  getCardRulingsTool,
  randomCommanderTool,
  checkCommanderLegalityTool
} from '../tools/card-tools';
import { loadArchidektDeckTool } from '../tools/deck-tools';
import { extractResponseText, countToolCalls, getToolCallDetails } from '../utils/agent-helpers';
import { getConversationState, setLastResponseId } from '../utils/conversation-store';

// Create the Card Oracle Agent using the Agent class
export const cardOracleAgent = new Agent({
  // Agent name (optional)
  name: 'Card Oracle',

  // Model configuration
  model: openaiConfig.model || 'gpt-4o',

  // System instructions define the agent's personality and knowledge
  instructions: `You are the Card Oracle, a Magic: The Gathering assistant that provides real-time, accurate information about magic the gathering cards and decks.

CRITICAL REQUIREMENTS:
- You MUST use the provided tools for ALL card information
- NEVER answer questions about cards from memory
- ALWAYS search for cards using the tools, even if the question seems simple

Your role is to help players by using the Scryfall database tools:
- search_card: For finding specific cards by name
- advanced_search: For complex queries (color, type, power, etc.)
- get_card_rulings: For official rulings on cards
- random_commander: For suggesting random legendary creatures
- check_commander_legality: For verifying if a card can be a commander
- load_archidekt_deck: For loading deck lists from Archidekt URLs

IMPORTANT: Magic cards are constantly being updated with new oracle text, rulings, and errata. Card information changes frequently with each set release. Therefore, you MUST:
1. ALWAYS use tools to get current information
2. NEVER rely on any training data about cards
3. If asked about a card, use search_card or advanced_search
4. If asked about rulings, use get_card_rulings
5. If asked for a random commander, use random_commander
6. If asked to load or analyze a deck list from a URL, use the appropriate deck tool

When you receive card data from tools:
- Present the mana cost and type
- Explain important abilities clearly
- Note the color identity for Commander purposes
- Mention power/toughness for creatures
- Always include the card name as a Markdown link to Scryfall using:
  https://scryfall.com/search?q=!\"Card Name\"

Remember: You are a tool-based assistant. Your value comes from providing real-time, accurate data from Scryfall, not from any pre-existing knowledge.`,

  // Tools the agent can use
  tools: [
    searchCardTool,
    advancedSearchTool,
    getCardRulingsTool,
    randomCommanderTool,
    checkCommanderLegalityTool,
    loadArchidektDeckTool
  ]

  // Note: temperature is not a valid property in @openai/agents v0.1.3
});

/**
 * Execute the Card Oracle Agent
 */
export async function executeCardOracle(
  query: string,
  devMode: boolean = false,
  conversationId?: string
) {
  console.log('🎴 Card Oracle Agent executing query:', query);
  const startTime = Date.now();

  try {
    const runOptions = conversationId
      ? {
        previousResponseId: getConversationState(conversationId).lastResponseId
      }
      : undefined;
    const result = await run(
      cardOracleAgent,
      [
        {
          role: 'user',
          content: query
        }
      ],
      runOptions
    );
    if (conversationId) {
      setLastResponseId(conversationId, result.lastResponseId);
    }

    const responseText = extractResponseText(result);
    const toolCallCount = countToolCalls(result);
    const totalDuration = Date.now() - startTime;

    const response: any = {
      success: true,
      response: responseText || 'No response generated.',
      toolCalls: toolCallCount
    };

    // Include detailed metadata if in dev mode
    if (devMode) {
      const toolCallDetails = getToolCallDetails(result);
      const state = result.state as any;

      response.metadata = {
        toolCalls: toolCallDetails,
        totalDuration,
        modelResponses: state?._modelResponses?.length || 0,
        tokensUsed: state?._totalTokens || null
      };

      console.log('📊 Dev Mode - Metadata:', response.metadata);
    }

    return response;
  } catch (error: any) {
    console.error('❌ Card Oracle Agent error:', error);
    return {
      success: false,
      error: error.message,
      response: null
    };
  }
}

/**
 * LEARNING CHECKPOINT for @openai/agents v0.1.3:
 *
 * You've now created your first agent! Here's what you learned:
 *
 * 1. Agents are created with new Agent() and configured with:
 *    - name for identity (optional)
 *    - instructions for behavior
 *    - tools array for capabilities
 *    - model for the LLM to use
 *    - Note: temperature is NOT a valid property in v0.1.3
 *
 * 2. Tools are created with the tool() function:
 *    - name and description for the agent to understand
 *    - parameters as Zod schemas for validation
 *    - execute function that returns data
 *    - The agent decides when/how to use them
 *
 * 3. Running an agent with run() function:
 *    - Accepts either a string or array of input items
 *    - NOT an object with { messages: [...] }
 *    - Returns a result with:
 *      - result.output: array of output items
 *      - result.state: contains the conversation state
 *    - Does NOT return result.messages
 *
 * Next, we'll connect this to your Express server so you can test it!
 */

// Example queries you can test:
export const exampleQueries = [
  "What is Lightning Bolt?",
  "Can Atraxa be my commander?",
  "Find all red instant spells",
  "What are the rulings for Doubling Season?",
  "Suggest a random commander for me",
  "Is Griselbrand legal as a commander?",
  "Find green creatures with power 5 or greater"
];
