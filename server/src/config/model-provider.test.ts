import { describe, it, expect } from 'vitest';
import { OpenAIProvider } from '@openai/agents';
import { AiSdkModel } from '@openai/agents-extensions/ai-sdk';
import { buildProviderConfig, OPENAI_DEFAULT_MODEL } from './model-provider';

describe('buildProviderConfig', () => {
  describe('openai provider', () => {
    it('returns a string model', () => {
      const { model } = buildProviderConfig({ provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test' });
      expect(model).toBe('gpt-4o');
    });

    it('defaults to OPENAI_DEFAULT_MODEL when model not specified', () => {
      const { model } = buildProviderConfig({ provider: 'openai', apiKey: 'sk-test' });
      expect(model).toBe(OPENAI_DEFAULT_MODEL);
    });

    it('includes OpenAIProvider in runConfig', () => {
      const { runConfig } = buildProviderConfig({ provider: 'openai', apiKey: 'sk-test' });
      expect(runConfig.modelProvider).toBeInstanceOf(OpenAIProvider);
    });
  });

  describe('anthropic provider', () => {
    it('returns an AiSdkModel instance', () => {
      const { model } = buildProviderConfig({ provider: 'anthropic', model: 'claude-sonnet-4-6', apiKey: 'sk-ant-test' });
      expect(model).toBeInstanceOf(AiSdkModel);
    });

    it('defaults to ANTHROPIC_DEFAULT_MODEL when model not specified', () => {
      const config = buildProviderConfig({ provider: 'anthropic', apiKey: 'sk-ant-test' });
      expect(config.model).toBeInstanceOf(AiSdkModel);
    });

    it('returns empty runConfig (no modelProvider)', () => {
      const { runConfig } = buildProviderConfig({ provider: 'anthropic', apiKey: 'sk-ant-test' });
      expect(runConfig.modelProvider).toBeUndefined();
    });
  });
});
