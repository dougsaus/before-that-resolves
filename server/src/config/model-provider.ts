import { OpenAIProvider, type Model, type RunConfig } from '@openai/agents';
import { aisdk } from '@openai/agents-extensions/ai-sdk';
import { createAnthropic } from '@ai-sdk/anthropic';
import { openaiConfig } from './openai';
import type { OracleModelSelection } from '../types/provider';

export const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-4-6';
export const OPENAI_DEFAULT_MODEL = openaiConfig.model || 'gpt-4o';

export type ProviderConfig = {
  model: string | Model;
  runConfig: Partial<RunConfig>;
};

export function buildProviderConfig(selection: OracleModelSelection): ProviderConfig {
  const { provider, model, apiKey } = selection;

  if (provider === 'anthropic') {
    const anthropicProvider = createAnthropic({ apiKey });
    return {
      model: aisdk(anthropicProvider(model || ANTHROPIC_DEFAULT_MODEL)),
      runConfig: {}
    };
  }

  return {
    model: model || OPENAI_DEFAULT_MODEL,
    runConfig: {
      modelProvider: new OpenAIProvider({ apiKey })
    }
  };
}
