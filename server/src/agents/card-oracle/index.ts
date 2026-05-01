import fs from 'fs';
import path from 'path';
import { Agent, Runner, type Model, type RunConfig } from '@openai/agents';
import type { OracleModelSelection } from '../../types/provider';
import { buildProviderConfig } from '../../config/model-provider';
import {
  searchCardTool,
  cardCollectionTool,
  advancedSearchTool,
  getCardRulingsTool,
  randomCommanderTool,
  checkCommanderLegalityTool
} from '../../tools/card-tools';
import { createLoadedDeckTool, createLoadedDeckRawTool } from '../../tools/deck-tools';
import { createCommanderBracketTool } from '../../tools/bracket-tool';
import { createGoldfishAgentTool } from '../../tools/goldfish-agent-tool';
import { extractResponseText, countToolCalls, getToolCallDetails } from '../../utils/agent-helpers';
import { getConversationState, getHistory, setHistory, setLastResponseId } from '../../utils/conversation-store';

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
  resolvedModel: string | Model,
  selection: OracleModelSelection,
  runConfig: Partial<RunConfig>,
  conversationId: string
) {
  const { reasoningEffort, verbosity, provider } = selection;
  const normalizedEffort = toModelReasoningEffort(reasoningEffort);
  const modelSettings = provider !== 'anthropic' && (normalizedEffort || verbosity)
    ? {
      ...(normalizedEffort ? { reasoning: { effort: normalizedEffort } } : {}),
      ...(verbosity ? { text: { verbosity } } : {})
    }
    : undefined;

  return new Agent({
    name: 'Card Oracle',
    model: resolvedModel,
    modelSettings,
    instructions: loadPrompt('card-oracle.md'),
    tools: [
      searchCardTool,
      cardCollectionTool,
      advancedSearchTool,
      getCardRulingsTool,
      randomCommanderTool,
      checkCommanderLegalityTool,
      createLoadedDeckTool(conversationId),
      createLoadedDeckRawTool(conversationId),
      createCommanderBracketTool(resolvedModel, selection, runConfig),
      createGoldfishAgentTool(resolvedModel, selection, runConfig, conversationId)
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
  selection: OracleModelSelection = { provider: 'openai' }
) {
  console.log('🎴 Card Oracle Agent executing query:', query);
  const startTime = Date.now();
  const { apiKey, provider } = selection;

  try {
    if (!apiKey) {
      return {
        success: false,
        error: provider === 'anthropic'
          ? 'Anthropic API key is required. Provide one in the UI.'
          : 'OpenAI API key is required. Provide one in the UI.'
      };
    }

    if (!conversationId) {
      return { success: false, error: 'Conversation ID is required.' };
    }

    const { model: resolvedModel, runConfig } = buildProviderConfig(selection);

    const isAnthropic = provider === 'anthropic';
    const existingHistory = isAnthropic ? getHistory(conversationId) : [];
    const messages = existingHistory.length > 0
      ? [...existingHistory, { role: 'user' as const, content: query }]
      : [{ role: 'user' as const, content: query }];

    const runOptions = isAnthropic
      ? { context: { selection }, maxTurns: 100 }
      : {
        previousResponseId: getConversationState(conversationId).openai?.lastResponseId,
        context: { selection },
        maxTurns: 100
      };

    const cardOracleAgent = createCardOracleAgent(
      resolvedModel,
      selection,
      runConfig,
      conversationId
    );
    const runner = new Runner(runConfig);
    const result = await runner.run(cardOracleAgent, messages, runOptions);

    if (isAnthropic) {
      setHistory(conversationId, result.history);
    } else {
      setLastResponseId(conversationId, result.lastResponseId);
    }

    const responseText = extractResponseText(result);
    const toolCallCount = countToolCalls(result);
    const totalDuration = Date.now() - startTime;

    const response: {
      success: boolean;
      response?: string;
      toolCalls?: number;
      metadata?: {
        toolCalls: ReturnType<typeof getToolCallDetails>;
        totalDuration: number;
        modelResponses: number;
        tokensUsed: number | null;
      };
      error?: string;
    } = {
      success: true,
      response: responseText || 'No response generated.',
      toolCalls: toolCallCount
    };

    // Include detailed metadata if in dev mode
    if (devMode) {
      const toolCallDetails = getToolCallDetails(result);
      const state = result.state as {
        _modelResponses?: unknown[];
        _totalTokens?: number;
      };

      response.metadata = {
        toolCalls: toolCallDetails,
        totalDuration,
        modelResponses: state?._modelResponses?.length || 0,
        tokensUsed: state?._totalTokens || null
      };

      console.log('📊 Dev Mode - Metadata:', response.metadata);
    }

    return response;
  } catch (error: unknown) {
    const maybeError = error as { status?: number; response?: { status?: number }; message?: string };
    const status = maybeError?.status || maybeError?.response?.status;
    const providerLabel = provider === 'anthropic' ? 'Anthropic' : 'OpenAI';
    const safeMessage =
      status === 401 || status === 403
        ? `${providerLabel} API key is invalid or unauthorized.`
        : maybeError?.message || `${providerLabel} request failed.`;
    console.error('❌ Card Oracle Agent error:', safeMessage);
    return {
      success: false,
      error: safeMessage,
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
