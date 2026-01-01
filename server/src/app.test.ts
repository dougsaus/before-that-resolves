import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app';

describe('app routes', () => {
  it('returns a conversationId and calls the agent', async () => {
    const execute = vi.fn().mockResolvedValue({
      success: true,
      response: 'ok',
      toolCalls: 0
    });
    const getOrCreateConversationId = vi.fn().mockReturnValue('conv-123');

    const app = createApp({
      executeCardOracle: execute,
      getOrCreateConversationId
    });

    const response = await request(app)
      .post('/api/agent/query')
      .send({ query: 'Hello there' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.conversationId).toBe('conv-123');
    expect(execute).toHaveBeenCalledWith(
      'Hello there',
      false,
      'conv-123',
      undefined,
      undefined,
      undefined
    );
  });

  it('uses the provided conversationId', async () => {
    const execute = vi.fn().mockResolvedValue({
      success: true,
      response: 'ok',
      toolCalls: 0
    });
    const getOrCreateConversationId = vi.fn().mockReturnValue('conv-999');

    const app = createApp({
      executeCardOracle: execute,
      getOrCreateConversationId
    });

    const response = await request(app)
      .post('/api/agent/query')
      .send({ query: 'Ping', conversationId: 'conv-abc' })
      .expect(200);

    expect(response.body.conversationId).toBe('conv-abc');
    expect(getOrCreateConversationId).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledWith(
      'Ping',
      false,
      'conv-abc',
      undefined,
      undefined,
      undefined
    );
  });

  it('validates required query', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/agent/query')
      .send({})
      .expect(400);

    expect(response.body.error).toBe('Query is required');
  });

  it('resets conversations', async () => {
    const resetConversation = vi.fn().mockReturnValue(true);
    const app = createApp({ resetConversation });

    const response = await request(app)
      .post('/api/agent/reset')
      .send({ conversationId: 'conv-123' })
      .expect(200);

    expect(response.body.cleared).toBe(true);
    expect(resetConversation).toHaveBeenCalledWith('conv-123');
  });

  it('caches Archidekt decks', async () => {
    const cacheArchidektDeckFromUrl = vi.fn().mockResolvedValue({ name: 'Raw Deck' });
    const app = createApp({ cacheArchidektDeckFromUrl });

    const response = await request(app)
      .post('/api/deck/cache')
      .send({ deckUrl: 'https://archidekt.com/decks/12345/test' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(cacheArchidektDeckFromUrl).toHaveBeenCalledWith(
      'https://archidekt.com/decks/12345/test'
    );
  });
});
