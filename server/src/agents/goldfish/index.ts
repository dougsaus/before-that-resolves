import fs from 'fs';
import path from 'path';
import { Agent } from '@openai/agents';
import { openaiConfig } from '../../config/openai';
import type { ReasoningEffort, TextVerbosity } from '../card-oracle';
import { toModelReasoningEffort } from '../card-oracle';
import {
  loadDeck,
  reset,
  shuffle,
  draw,
  peek,
  zoneContents,
  moveById,
  findAndMoveByName
} from '../../tools/goldfish';

function loadPrompt(filename: string): string {
  const promptPath = path.resolve(__dirname, filename);
  return fs.readFileSync(promptPath, 'utf-8').trim();
}

export function createGoldfishAgent(
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
    name: 'Commander Goldfish Expert',
    model: model || openaiConfig.model || 'gpt-4o',
    modelSettings,
    instructions: loadPrompt('goldfish.md'),
    tools: [loadDeck, reset, shuffle, draw, peek, zoneContents, moveById, findAndMoveByName]
  });
}
