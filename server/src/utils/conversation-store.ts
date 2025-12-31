import crypto from 'crypto';

type ConversationState = {
  lastResponseId?: string;
};

const conversations = new Map<string, ConversationState>();

export function getOrCreateConversationId(): string {
  return `conv_${crypto.randomUUID()}`;
}

export function getConversationState(conversationId: string): ConversationState {
  const existing = conversations.get(conversationId);
  if (existing) {
    return existing;
  }

  const state: ConversationState = {};
  conversations.set(conversationId, state);
  return state;
}

export function setLastResponseId(conversationId: string, lastResponseId?: string) {
  if (!lastResponseId) return;
  const state = getConversationState(conversationId);
  state.lastResponseId = lastResponseId;
}

export function resetConversation(conversationId: string): boolean {
  return conversations.delete(conversationId);
}
