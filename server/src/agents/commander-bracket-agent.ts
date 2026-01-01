import { Agent } from '@openai/agents';
import { openaiConfig } from '../config/openai';
import { loadPrompt } from '../utils/prompt-loader';
import type { ReasoningEffort, TextVerbosity } from './card-oracle-agent';
import { toModelReasoningEffort } from './card-oracle-agent';

export function createCommanderBracketAgent(
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
    name: 'Commander Bracket Expert',
    model: model || openaiConfig.model || 'gpt-4o',
    modelSettings,
    instructions: loadPrompt('commander-bracket.md')
  });
}
