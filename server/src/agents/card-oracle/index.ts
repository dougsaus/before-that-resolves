import fs from 'fs';
import path from 'path';
import { Agent, run } from '@openai/agents';
import { openaiConfig } from '../../config/openai';
import {
  searchCardTool,
  cardCollectionTool,
  advancedSearchTool,
  getCardRulingsTool,
  randomCommanderTool,
  checkCommanderLegalityTool
} from '../../tools/card-tools';
import { getArchidektDeckTool, getArchidektDeckRawTool } from '../../tools/deck-tools';
import { createCommanderBracketTool } from '../../tools/bracket-tool';
import { createGoldfishAgentTool } from '../../tools/goldfish-agent-tool';
import { extractResponseText, countToolCalls, getToolCallDetails } from '../../utils/agent-helpers';
import { getConversationState, setLastResponseId } from '../../utils/conversation-store';

export type ReasoningEffort = 'low' | 'medium' | 'high';
type ModelSettingsReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | null;
export type TextVerbosity = 'low' | 'medium' | 'high';

function loadPrompt(filename: string): string {
  const promptPath = path.resolve(__dirname, filename);
  return fs.readFileSync(promptPath, 'utf-8').trim();
}

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
      cardCollectionTool,
      advancedSearchTool,
      getCardRulingsTool,
      randomCommanderTool,
      checkCommanderLegalityTool,
      getArchidektDeckTool,
      getArchidektDeckRawTool,
      createCommanderBracketTool(model, reasoningEffort, verbosity),
      createGoldfishAgentTool(model, reasoningEffort, verbosity)
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
        context: { model, reasoningEffort, verbosity },
        maxTurns: 100
      }
      : { context: { model, reasoningEffort, verbosity }, maxTurns: 100 };
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
