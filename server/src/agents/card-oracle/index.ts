import fs from 'fs';
import path from 'path';
import { Agent, OpenAIProvider, Runner, type RunConfig } from '@openai/agents';
import { openaiConfig } from '../../config/openai';
import {
  searchCardTool,
  cardCollectionTool,
  advancedSearchTool,
  getCardRulingsTool,
  randomCommanderTool,
  checkCommanderLegalityTool
} from '../../tools/card-tools';
import { createArchidektDeckTool, createArchidektDeckRawTool } from '../../tools/deck-tools';
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
  verbosity?: TextVerbosity,
  runConfig?: Partial<RunConfig>,
  conversationId?: string
) {
  if (!conversationId) {
    throw new Error('Conversation ID is required to create the Card Oracle agent.');
  }
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
      createArchidektDeckTool(conversationId),
      createArchidektDeckRawTool(conversationId),
      createCommanderBracketTool(model, reasoningEffort, verbosity, runConfig),
      createGoldfishAgentTool(model, reasoningEffort, verbosity, runConfig, conversationId)
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
  verbosity?: TextVerbosity,
  apiKey?: string
) {
  console.log('🎴 Card Oracle Agent executing query:', query);
  const startTime = Date.now();
  const resolvedKey = apiKey;

  try {
    if (!resolvedKey) {
      return {
        success: false,
        error: 'OpenAI API key is required. Provide one in the UI.'
      };
    }

    const runConfig: Partial<RunConfig> = {
      modelProvider: new OpenAIProvider({ apiKey: resolvedKey })
    };
    const runOptions = conversationId
      ? {
        previousResponseId: getConversationState(conversationId).lastResponseId,
        context: { model, reasoningEffort, verbosity },
        maxTurns: 100
      }
      : { context: { model, reasoningEffort, verbosity }, maxTurns: 100 };
    const cardOracleAgent = createCardOracleAgent(
      model,
      reasoningEffort,
      verbosity,
      runConfig,
      conversationId
    );
    const runner = new Runner(runConfig);
    const result = await runner.run(
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
    const safeMessage =
      status === 401 || status === 403
        ? 'OpenAI API key is invalid or unauthorized.'
        : maybeError?.message || 'OpenAI request failed.';
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
