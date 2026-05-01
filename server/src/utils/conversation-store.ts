import crypto from 'crypto';
import type { AgentInputItem } from '@openai/agents';

type ConversationState = {
  openai?: {
    lastResponseId?: string;
  };
  history?: AgentInputItem[];
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
  state.openai = { ...state.openai, lastResponseId };
}

export function setHistory(conversationId: string, history: AgentInputItem[]) {
  const state = getConversationState(conversationId);
  state.history = history;
}

export function getHistory(conversationId: string): AgentInputItem[] {
  return getConversationState(conversationId).history ?? [];
}

export function resetConversation(conversationId: string): boolean {
  return conversations.delete(conversationId);
}
