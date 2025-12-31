import { describe, expect, it } from 'vitest';
import {
  getConversationState,
  getOrCreateConversationId,
  resetConversation,
  setLastResponseId
} from './conversation-store';

describe('conversation-store', () => {
  it('creates and retrieves conversation state', () => {
    const conversationId = getOrCreateConversationId();
    const state = getConversationState(conversationId);

    expect(state).toBeDefined();
    expect(state.lastResponseId).toBeUndefined();

    setLastResponseId(conversationId, 'resp_123');
    const updated = getConversationState(conversationId);
    expect(updated.lastResponseId).toBe('resp_123');
  });

  it('resets conversation state', () => {
    const conversationId = getOrCreateConversationId();
    setLastResponseId(conversationId, 'resp_456');

    const cleared = resetConversation(conversationId);
    expect(cleared).toBe(true);

    const clearedAgain = resetConversation(conversationId);
    expect(clearedAgain).toBe(false);
  });
});
