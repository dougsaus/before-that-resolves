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
import { commanderBracketTool } from '../tools/bracket-tool';
import { extractResponseText, countToolCalls, getToolCallDetails } from '../utils/agent-helpers';
import { getConversationState, setLastResponseId } from '../utils/conversation-store';
import { loadPrompt } from '../utils/prompt-loader';

export type ReasoningEffort = 'low' | 'medium' | 'high';
type ModelSettingsReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | null;
export type TextVerbosity = 'low' | 'medium' | 'high';

export function toModelReasoningEffort(
  effort?: ReasoningEffort
): ModelSettingsReasoningEffort | undefined {
  if (!effort) return undefined;
  return effort;
}

function createCardOracleAgent(
  model?: string,
  reasoningEffort?: ReasoningEffort,
  verbosity?: TextVerbosity
) {
  const normalizedEffort = toModelReasoningEffort(reasoningEffort);
  const modelSettings = normalizedEffort || verbosity
    ? {
      ...(normalizedEffort ? { reasoning: { effort: normalizedEffort } } : {}),
      ...(verbosity ? { text: { verbosity } } : {})
    }
    : undefined;

  return new Agent({
    name: 'Card Oracle',
    model: model || openaiConfig.model || 'gpt-4o',
    modelSettings,
    instructions: loadPrompt('card-oracle.md'),
    tools: [
      searchCardTool,
      advancedSearchTool,
      getCardRulingsTool,
      randomCommanderTool,
      checkCommanderLegalityTool,
      loadArchidektDeckTool,
      commanderBracketTool
    ]
  });
}

/**
 * Execute the Card Oracle Agent
 */
export async function executeCardOracle(
  query: string,
  devMode: boolean = false,
  conversationId?: string,
  model?: string,
  reasoningEffort?: ReasoningEffort,
  verbosity?: TextVerbosity
) {
  console.log('🎴 Card Oracle Agent executing query:', query);
  const startTime = Date.now();

  try {
    const runOptions = conversationId
      ? {
        previousResponseId: getConversationState(conversationId).lastResponseId,
        context: { model, reasoningEffort, verbosity }
      }
      : { context: { model, reasoningEffort, verbosity } };
    const cardOracleAgent = createCardOracleAgent(model, reasoningEffort, verbosity);
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
