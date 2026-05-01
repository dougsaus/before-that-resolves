import { describe, it, expect } from 'vitest';
import { createCommanderBracketAgent } from './index';
import type { OracleModelSelection } from '../../types/provider';

const openaiSelection: OracleModelSelection = {
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: 'sk-test',
  reasoningEffort: 'high',
  verbosity: 'high'
};

const anthropicSelection: OracleModelSelection = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  apiKey: 'sk-ant-test',
  reasoningEffort: 'high',
  verbosity: 'high'
};

describe('createCommanderBracketAgent', () => {
  it('uses the resolved model for agent construction', () => {
    const agent = createCommanderBracketAgent('gpt-4o', openaiSelection);
    expect(agent.model).toBe('gpt-4o');
  });

  it('applies reasoning and verbosity modelSettings for openai', () => {
    const agent = createCommanderBracketAgent('gpt-4o', openaiSelection);
    expect(agent.modelSettings?.reasoning?.effort).toBe('high');
    expect(agent.modelSettings?.text?.verbosity).toBe('high');
  });

  it('strips reasoning and verbosity modelSettings for anthropic', () => {
    const agent = createCommanderBracketAgent('claude-sonnet-4-6', anthropicSelection);
    expect(agent.modelSettings?.reasoning).toBeUndefined();
    expect(agent.modelSettings?.text?.verbosity).toBeUndefined();
  });

  it('omits modelSettings entirely when no reasoning or verbosity provided', () => {
    const selection: OracleModelSelection = { provider: 'openai', apiKey: 'sk-test' };
    const agent = createCommanderBracketAgent('gpt-4o', selection);
    expect(agent.modelSettings?.reasoning).toBeUndefined();
    expect(agent.modelSettings?.text?.verbosity).toBeUndefined();
  });
});
