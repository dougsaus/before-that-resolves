export type ModelProviderKind = 'openai' | 'anthropic';

export type OracleModelSelection = {
  provider: ModelProviderKind;
  model?: string;
  apiKey?: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
};
