import fs from 'fs';
import path from 'path';
import { Agent, type Model } from '@openai/agents';
import type { OracleModelSelection } from '../../types/provider';
import { toModelReasoningEffort } from '../card-oracle';

function loadPrompt(filename: string): string {
  const promptPath = path.resolve(__dirname, filename);
  return fs.readFileSync(promptPath, 'utf-8').trim();
}

export function createCommanderBracketAgent(
  resolvedModel: string | Model,
  selection: OracleModelSelection
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
    name: 'Commander Bracket Expert',
    model: resolvedModel,
    modelSettings,
    instructions: loadPrompt('commander-bracket.md')
  });
}
