import { Agent, run } from '@openai/agents';
import { openaiConfig } from '../config/openai';
import {
  searchCardTool,
  advancedSearchTool,
  getCardRulingsTool,
  randomCommanderTool,
  checkCommanderLegalityTool
} from '../tools/card-tools';
import { extractResponseText, countToolCalls } from '../utils/agent-helpers';

/**
 * LESSON 1: Your First Agent!
 *
 * This is the Card Oracle Agent - it helps users with MTG card information.
 *
 * KEY CONCEPTS FOR @openai/agents v0.1.3:
 * 1. new Agent() - Creates an agent instance with specific capabilities
 * 2. Tool registration - Giving the agent tools to use
 * 3. Instructions - Defining the agent's behavior
 * 4. run() function - Executing the agent with user input
 *
 * The agent will automatically:
 * - Understand user intent
 * - Choose appropriate tools
 * - Handle tool responses
 * - Generate helpful answers
 */

// Create the Card Oracle Agent using the Agent class
export const cardOracleAgent = new Agent({
  // Agent name (optional)
  name: 'Card Oracle',

  // Model configuration
  model: openaiConfig.model || 'gpt-4o',

  // System instructions define the agent's personality and knowledge
  instructions: `You are the Card Oracle, an expert on Magic: The Gathering cards and the Commander/EDH format.

Your role is to help players with:
- Finding specific cards and their details
- Explaining card rulings and interactions
- Checking commander legality
- Suggesting commanders for different playstyles
- Understanding card text and abilities

You have access to the entire Scryfall database of Magic cards. Be helpful, accurate, and enthusiastic about Magic!

When discussing cards:
- Always mention the mana cost and type
- Explain important abilities clearly
- Note the color identity for Commander purposes
- Mention power/toughness for creatures

Remember: Commander is a singleton format (only one of each card except basic lands) with 100-card decks led by a legendary creature.`,

  // Tools the agent can use
  tools: [
    searchCardTool,
    advancedSearchTool,
    getCardRulingsTool,
    randomCommanderTool,
    checkCommanderLegalityTool
  ]

  // Note: temperature is not a valid property in @openai/agents v0.1.3
});

/**
 * Execute the Card Oracle Agent
 *
 * LEARNING POINT: Using the run() function with Agent!
 * The agent will:
 * 1. Analyze the query
 * 2. Decide which tools to use (if any)
 * 3. Call the tools with appropriate parameters
 * 4. Synthesize the results into a response
 */
export async function executeCardOracle(query: string) {
  console.log('🎴 Card Oracle Agent executing query:', query);

  try {
    // Run the agent using the run function
    // In @openai/agents v0.1.3, run() accepts either:
    // 1. A string directly: run(agent, "query")
    // 2. An array of input items: run(agent, [{ role: 'user', content: 'query' }])
    const result = await run(
      cardOracleAgent,
      [
        {
          role: 'user',
          content: query
        }
      ]
    );

    // Use helper functions to extract data from the result
    const responseText = extractResponseText(result);
    const toolCallCount = countToolCalls(result);

    return {
      success: true,
      response: responseText || 'No response generated.',
      toolCalls: toolCallCount
    };
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