import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app';

describe('app routes', () => {
  const testApiKey = 'sk-test';

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
      .set('x-openai-key', testApiKey)
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
      undefined,
      testApiKey
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
      .set('x-openai-key', testApiKey)
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
      undefined,
      testApiKey
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

  it('rejects agent queries without an API key', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/agent/query')
      .send({ query: 'Hello there' })
      .expect(401);

    expect(response.body.error).toBe('OpenAI API key is required. Provide one in the UI.');
  });

  it('passes through a per-request API key', async () => {
    const execute = vi.fn().mockResolvedValue({
      success: true,
      response: 'ok',
      toolCalls: 0
    });

    const app = createApp({
      executeCardOracle: execute
    });

    await request(app)
      .post('/api/agent/query')
      .set('x-openai-key', 'sk-test')
      .send({ query: 'Hello there' })
      .expect(200);

    expect(execute).toHaveBeenCalledWith(
      'Hello there',
      false,
      expect.any(String),
      undefined,
      undefined,
      undefined,
      'sk-test'
    );
  });

  it('resets conversations', async () => {
    const resetConversation = vi.fn().mockReturnValue(true);
    const resetArchidektDeckCache = vi.fn();
    const app = createApp({ resetConversation, resetArchidektDeckCache });

    const response = await request(app)
      .post('/api/agent/reset')
      .send({ conversationId: 'conv-123' })
      .expect(200);

    expect(response.body.cleared).toBe(true);
    expect(resetConversation).toHaveBeenCalledWith('conv-123');
    expect(resetArchidektDeckCache).toHaveBeenCalledWith('conv-123');
  });

  it('caches Archidekt decks', async () => {
    const cacheArchidektDeckFromUrl = vi.fn().mockResolvedValue({ name: 'Raw Deck' });
    const app = createApp({ cacheArchidektDeckFromUrl });

    const response = await request(app)
      .post('/api/deck/cache')
      .send({ deckUrl: 'https://archidekt.com/decks/12345/test', conversationId: 'conv-123' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(cacheArchidektDeckFromUrl).toHaveBeenCalledWith(
      'https://archidekt.com/decks/12345/test',
      'conv-123'
    );
  });

  it('exports chat as pdf', async () => {
    const generateChatPdf = vi.fn().mockResolvedValue(Buffer.from('pdf'));
    const app = createApp({ generateChatPdf });

    const response = await request(app)
      .post('/api/chat/export-pdf')
      .send({
        title: 'Before That Resolves',
        subtitle: 'Commander Deck Analyzer & Strategy Assistant',
        messages: [{ role: 'user', content: 'Hello' }]
      })
      .expect(200);

    expect(response.headers['content-type']).toContain('application/pdf');
    expect(generateChatPdf).toHaveBeenCalled();
  });

  it('validates chat export payload', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/chat/export-pdf')
      .send({ messages: [] })
      .expect(400);

    expect(response.body.error).toBe('messages are required');
  });

  it('requires a Google token to access deck collections', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/decks')
      .expect(401);

    expect(response.body.error).toBe('Google ID token is required.');
  });

  it('lists decks for an authenticated user', async () => {
    const verifyGoogleIdToken = vi.fn().mockResolvedValue({ id: 'user-123', email: 'user@test.dev' });
    const listDeckCollection = vi.fn().mockResolvedValue([
      {
        id: '999',
        name: 'Test Deck',
        url: 'https://archidekt.com/decks/999/test',
        format: 'commander',
        commanderNames: ['Test Commander'],
        colorIdentity: ['W', 'B'],
        source: 'archidekt',
        addedAt: '2025-01-01T00:00:00.000Z'
      }
    ]);
    const upsertUser = vi.fn().mockResolvedValue(undefined);
    const app = createApp({ verifyGoogleIdToken, listDeckCollection, upsertUser });

    const response = await request(app)
      .get('/api/decks')
      .set('authorization', 'Bearer token-123')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.user.email).toBe('user@test.dev');
    expect(response.body.decks[0]?.name).toBe('Test Deck');
    expect(listDeckCollection).toHaveBeenCalledWith('user-123');
  });

  it('adds a deck to the collection', async () => {
    const verifyGoogleIdToken = vi.fn().mockResolvedValue({ id: 'user-456' });
    const fetchArchidektDeckSummary = vi.fn().mockResolvedValue({
      id: '123',
      name: 'Added Deck',
      url: 'https://archidekt.com/decks/123/added',
      format: 'commander',
      commanderNames: ['Edgar Markov'],
      colorIdentity: ['W', 'B', 'R']
    });
    const upsertDeckInCollection = vi.fn().mockResolvedValue([
      {
        id: '123',
        name: 'Added Deck',
        url: 'https://archidekt.com/decks/123/added',
        format: 'commander',
        commanderNames: ['Edgar Markov'],
        colorIdentity: ['W', 'B', 'R'],
        source: 'archidekt',
        addedAt: '2025-01-02T00:00:00.000Z'
      }
    ]);
    const upsertUser = vi.fn().mockResolvedValue(undefined);
    const app = createApp({
      verifyGoogleIdToken,
      fetchArchidektDeckSummary,
      upsertDeckInCollection,
      upsertUser
    });

    const response = await request(app)
      .post('/api/decks')
      .set('authorization', 'Bearer token-456')
      .send({ deckUrl: 'https://archidekt.com/decks/123/added' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(fetchArchidektDeckSummary).toHaveBeenCalledWith('https://archidekt.com/decks/123/added');
    expect(upsertDeckInCollection).toHaveBeenCalledWith('user-456', {
      id: '123',
      name: 'Added Deck',
      url: 'https://archidekt.com/decks/123/added',
      format: 'commander',
      commanderNames: ['Edgar Markov'],
      colorIdentity: ['W', 'B', 'R'],
      source: 'archidekt'
    });
  });

  it('adds a manual deck to the collection', async () => {
    const verifyGoogleIdToken = vi.fn().mockResolvedValue({ id: 'user-789' });
    const upsertDeckInCollection = vi.fn().mockResolvedValue([
      {
        id: 'manual-abc',
        name: 'Manual Deck',
        url: null,
        format: null,
        commanderNames: ['Commander One'],
        colorIdentity: ['G'],
        source: 'manual',
        addedAt: '2025-01-03T00:00:00.000Z'
      }
    ]);
    const upsertUser = vi.fn().mockResolvedValue(undefined);
    const app = createApp({
      verifyGoogleIdToken,
      upsertDeckInCollection,
      upsertUser
    });

    const response = await request(app)
      .post('/api/decks/manual')
      .set('authorization', 'Bearer token-789')
      .send({ name: 'Manual Deck', commanderNames: 'Commander One', colorIdentity: 'G' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(upsertDeckInCollection).toHaveBeenCalledWith('user-789', expect.objectContaining({
      name: 'Manual Deck',
      commanderNames: ['Commander One'],
      colorIdentity: ['G'],
      source: 'manual'
    }));
  });

  it('allows manual decks without a color identity', async () => {
    const verifyGoogleIdToken = vi.fn().mockResolvedValue({ id: 'user-101' });
    const upsertDeckInCollection = vi.fn().mockResolvedValue([
      {
        id: 'manual-empty',
        name: 'No Color Deck',
        url: null,
        format: null,
        commanderNames: [],
        colorIdentity: null,
        source: 'manual',
        addedAt: '2025-01-04T00:00:00.000Z'
      }
    ]);
    const upsertUser = vi.fn().mockResolvedValue(undefined);
    const app = createApp({
      verifyGoogleIdToken,
      upsertDeckInCollection,
      upsertUser
    });

    const response = await request(app)
      .post('/api/decks/manual')
      .set('authorization', 'Bearer token-101')
      .send({ name: 'No Color Deck' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(upsertDeckInCollection).toHaveBeenCalledWith('user-101', expect.objectContaining({
      name: 'No Color Deck',
      colorIdentity: null,
      source: 'manual'
    }));
  });
});
