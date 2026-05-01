import fs from 'fs';
import path from 'path';
import { Agent, type Model } from '@openai/agents';
import type { OracleModelSelection } from '../../types/provider';
import { toModelReasoningEffort } from '../card-oracle';
import {
  createLoadDeckTool,
  reset,
  shuffle,
  draw,
  peek,
  zoneContents,
  moveById,
  findAndMoveByName
} from '../../tools/goldfish';
import { createLoadedDeckRawTool } from '../../tools/deck-tools';
import { cardCollectionTool, searchCardTool } from '../../tools/card-tools';

function loadPrompt(filename: string): string {
  const promptPath = path.resolve(__dirname, filename);
  return fs.readFileSync(promptPath, 'utf-8').trim();
}

export function createGoldfishAgent(
  resolvedModel: string | Model,
  selection: OracleModelSelection,
  conversationId?: string
) {
  const { reasoningEffort, verbosity, provider } = selection;
  const normalizedEffort = toModelReasoningEffort(reasoningEffort);
  const modelSettings = provider !== 'anthropic' && (normalizedEffort || verbosity)
    ? {
      ...(normalizedEffort ? { reasoning: { effort: normalizedEffort } } : {}),
      ...(verbosity ? { text: { verbosity } } : {})
    }
    : undefined;

  if (!conversationId) {
    throw new Error('Conversation ID is required to create the goldfish agent.');
  }

  return new Agent({
    name: 'Commander Goldfish Expert',
    model: resolvedModel,
    modelSettings,
    instructions: loadPrompt('goldfish.md'),
    tools: [
      createLoadDeckTool(conversationId),
      reset,
      shuffle,
      draw,
      peek,
      zoneContents,
      moveById,
      findAndMoveByName,
      createLoadedDeckRawTool(conversationId),
      searchCardTool,
      cardCollectionTool
    ]
  });
}
