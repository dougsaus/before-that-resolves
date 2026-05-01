import { describe, expect, it } from 'vitest';
import type { AgentInputItem } from '@openai/agents';
import {
  getConversationState,
  getHistory,
  getOrCreateConversationId,
  resetConversation,
  setHistory,
  setLastResponseId
} from './conversation-store';

describe('conversation-store', () => {
  describe('OpenAI state', () => {
    it('creates and retrieves conversation state', () => {
      const conversationId = getOrCreateConversationId();
      const state = getConversationState(conversationId);

      expect(state).toBeDefined();
      expect(state.openai?.lastResponseId).toBeUndefined();

      setLastResponseId(conversationId, 'resp_123');
      const updated = getConversationState(conversationId);
      expect(updated.openai?.lastResponseId).toBe('resp_123');
    });

    it('ignores setLastResponseId when value is undefined', () => {
      const conversationId = getOrCreateConversationId();
      setLastResponseId(conversationId, 'resp_111');
      setLastResponseId(conversationId, undefined);
      expect(getConversationState(conversationId).openai?.lastResponseId).toBe('resp_111');
    });
  });

  describe('Anthropic history state', () => {
    it('returns empty array when no history is stored', () => {
      const conversationId = getOrCreateConversationId();
      expect(getHistory(conversationId)).toEqual([]);
    });

    it('stores and retrieves history', () => {
      const conversationId = getOrCreateConversationId();
      const history = [
        { role: 'user', content: 'What is Sol Ring?' },
        { role: 'assistant', content: [{ type: 'output_text', text: 'Sol Ring is a mana rock.' }] }
      ] as AgentInputItem[];

      setHistory(conversationId, history);
      expect(getHistory(conversationId)).toEqual(history);
    });

    it('replaces history on subsequent calls', () => {
      const conversationId = getOrCreateConversationId();
      const firstHistory = [{ role: 'user', content: 'First' }] as AgentInputItem[];
      const secondHistory = [
        { role: 'user', content: 'First' },
        { role: 'assistant', content: [{ type: 'output_text', text: 'Reply' }] },
        { role: 'user', content: 'Second' }
      ] as AgentInputItem[];

      setHistory(conversationId, firstHistory);
      setHistory(conversationId, secondHistory);
      expect(getHistory(conversationId)).toEqual(secondHistory);
    });
  });

  describe('reset', () => {
    it('clears all state including openai and history', () => {
      const conversationId = getOrCreateConversationId();
      setLastResponseId(conversationId, 'resp_456');
      setHistory(conversationId, [{ role: 'user', content: 'Hello' }] as AgentInputItem[]);

      const cleared = resetConversation(conversationId);
      expect(cleared).toBe(true);

      const clearedAgain = resetConversation(conversationId);
      expect(clearedAgain).toBe(false);

      expect(getConversationState(conversationId).openai).toBeUndefined();
      expect(getHistory(conversationId)).toEqual([]);
    });
  });
});
