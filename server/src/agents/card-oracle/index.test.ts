import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Runner } from '@openai/agents';
import type { AgentInputItem } from '@openai/agents';
import { executeCardOracle } from './index';
import { getConversationState, getHistory, setLastResponseId } from '../../utils/conversation-store';
import { getOrCreateConversationId } from '../../utils/conversation-store';

vi.mock('../../config/model-provider', () => ({
  buildProviderConfig: vi.fn().mockReturnValue({ model: 'gpt-4o', runConfig: {} }),
  OPENAI_DEFAULT_MODEL: 'gpt-4o',
  ANTHROPIC_DEFAULT_MODEL: 'claude-sonnet-4-6'
}));

const fakeHistory: AgentInputItem[] = [
  { role: 'user', content: 'What is Sol Ring?' } as AgentInputItem
];

const fakeRunResult = {
  lastResponseId: 'resp_mock_123',
  history: fakeHistory,
  output: [{
    type: 'message',
    role: 'assistant',
    content: [{ type: 'output_text', text: 'A great mana rock.' }]
  }],
  newItems: [],
  rawResponses: [],
  state: {}
};

describe('executeCardOracle', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let runSpy: ReturnType<typeof vi.spyOn<any, any>>;

  beforeEach(() => {
    runSpy = vi.spyOn(Runner.prototype, 'run').mockResolvedValue(fakeRunResult as never);
  });

  describe('early error returns (no API calls)', () => {
    it('returns openai error when apiKey is missing for openai', async () => {
      const result = await executeCardOracle('test', false, 'conv-1', { provider: 'openai' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('OpenAI');
    });

    it('returns anthropic error when apiKey is missing for anthropic', async () => {
      const result = await executeCardOracle('test', false, 'conv-1', { provider: 'anthropic' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Anthropic');
    });

    it('returns error when conversationId is missing', async () => {
      const result = await executeCardOracle('test', false, undefined, { provider: 'openai', apiKey: 'sk-test' });
      expect(result.success).toBe(false);
    });
  });

  describe('OpenAI conversation state', () => {
    it('passes previousResponseId from store to runner', async () => {
      const conversationId = getOrCreateConversationId();
      setLastResponseId(conversationId, 'resp_prior_456');

      await executeCardOracle('Hello', false, conversationId, { provider: 'openai', apiKey: 'sk-test' });

      const callArgs = runSpy.mock.calls[0];
      const runOptions = callArgs[2] as { previousResponseId?: string };
      expect(runOptions.previousResponseId).toBe('resp_prior_456');
    });

    it('stores lastResponseId after run', async () => {
      const conversationId = getOrCreateConversationId();

      await executeCardOracle('Hello', false, conversationId, { provider: 'openai', apiKey: 'sk-test' });

      expect(getConversationState(conversationId).openai?.lastResponseId).toBe('resp_mock_123');
    });
  });

  describe('Anthropic conversation state', () => {
    it('does not pass previousResponseId for anthropic', async () => {
      const conversationId = getOrCreateConversationId();

      await executeCardOracle('Hello', false, conversationId, { provider: 'anthropic', apiKey: 'sk-ant-test' });

      const callArgs = runSpy.mock.calls[0];
      const runOptions = callArgs[2] as { previousResponseId?: string };
      expect(runOptions.previousResponseId).toBeUndefined();
    });

    it('stores result.history after run', async () => {
      const conversationId = getOrCreateConversationId();

      await executeCardOracle('Hello', false, conversationId, { provider: 'anthropic', apiKey: 'sk-ant-test' });

      expect(getHistory(conversationId)).toEqual(fakeHistory);
    });

    it('prepends stored history to messages on subsequent turns', async () => {
      const conversationId = getOrCreateConversationId();

      // First turn — stores history
      await executeCardOracle('Hello', false, conversationId, { provider: 'anthropic', apiKey: 'sk-ant-test' });

      runSpy.mockClear();

      // Second turn — should prepend stored history
      await executeCardOracle('Follow up', false, conversationId, { provider: 'anthropic', apiKey: 'sk-ant-test' });

      const callArgs = runSpy.mock.calls[0];
      const messages = callArgs[1] as AgentInputItem[];
      expect(messages.length).toBeGreaterThan(1);
      expect(messages[0]).toEqual(fakeHistory[0]);
      const lastMsg = messages[messages.length - 1] as { role: string; content: string };
      expect(lastMsg.content).toBe('Follow up');
    });
  });
});
