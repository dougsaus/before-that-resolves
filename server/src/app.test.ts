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
    const resetDeckCache = vi.fn();
    const app = createApp({ resetConversation, resetDeckCache });

    const response = await request(app)
      .post('/api/agent/reset')
      .send({ conversationId: 'conv-123' })
      .expect(200);

    expect(response.body.cleared).toBe(true);
    expect(resetConversation).toHaveBeenCalledWith('conv-123');
    expect(resetDeckCache).toHaveBeenCalledWith('conv-123');
  });

  it('caches decks', async () => {
    const cacheDeckFromUrl = vi.fn().mockResolvedValue({ name: 'Raw Deck' });
    const app = createApp({ cacheDeckFromUrl });

    const response = await request(app)
      .post('/api/deck/cache')
      .send({ deckUrl: 'https://archidekt.com/decks/12345/test', conversationId: 'conv-123' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(cacheDeckFromUrl).toHaveBeenCalledWith(
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
        commanderLinks: [],
        colorIdentity: ['W', 'B'],
        source: 'archidekt',
        addedAt: '2025-01-01T00:00:00.000Z'
      }
    ]);
    const upsertUser = vi.fn().mockResolvedValue(undefined);
    const getDeckStats = vi.fn().mockResolvedValue(new Map());
    const app = createApp({ verifyGoogleIdToken, listDeckCollection, upsertUser, getDeckStats });

    const response = await request(app)
      .get('/api/decks')
      .set('authorization', 'Bearer token-123')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.user.email).toBe('user@test.dev');
    expect(response.body.decks[0]?.name).toBe('Test Deck');
    expect(response.body.decks[0]?.stats).toBe(null);
    expect(listDeckCollection).toHaveBeenCalledWith('user-123');
    expect(getDeckStats).toHaveBeenCalledWith('user-123');
  });

  it('includes deck stats when available', async () => {
    const verifyGoogleIdToken = vi.fn().mockResolvedValue({ id: 'user-123', email: 'user@test.dev' });
    const listDeckCollection = vi.fn().mockResolvedValue([
      {
        id: 'deck-with-stats',
        name: 'Active Deck',
        url: null,
        format: 'commander',
        commanderNames: ['Test Commander'],
        commanderLinks: [],
        colorIdentity: ['U', 'R'],
        source: 'manual',
        addedAt: '2025-01-01T00:00:00.000Z'
      },
      {
        id: 'deck-no-stats',
        name: 'New Deck',
        url: null,
        format: null,
        commanderNames: [],
        commanderLinks: [],
        colorIdentity: null,
        source: 'manual',
        addedAt: '2025-01-02T00:00:00.000Z'
      }
    ]);
    const upsertUser = vi.fn().mockResolvedValue(undefined);
    const getDeckStats = vi.fn().mockResolvedValue(
      new Map([
        [
          'deck-with-stats',
          {
            deckId: 'deck-with-stats',
            totalGames: 10,
            wins: 6,
            losses: 4,
            winRate: 0.6,
            lastPlayed: '2025-06-15'
          }
        ]
      ])
    );
    const app = createApp({ verifyGoogleIdToken, listDeckCollection, upsertUser, getDeckStats });

    const response = await request(app)
      .get('/api/decks')
      .set('authorization', 'Bearer token-123')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.decks).toHaveLength(2);

    const deckWithStats = response.body.decks.find((d: { id: string }) => d.id === 'deck-with-stats');
    expect(deckWithStats.stats).toEqual({
      totalGames: 10,
      wins: 6,
      losses: 4,
      winRate: 0.6,
      lastPlayed: '2025-06-15'
    });

    const deckNoStats = response.body.decks.find((d: { id: string }) => d.id === 'deck-no-stats');
    expect(deckNoStats.stats).toBe(null);
  });

  it('adds a deck to the collection', async () => {
    const verifyGoogleIdToken = vi.fn().mockResolvedValue({ id: 'user-456' });
    const fetchDeckSummary = vi.fn().mockResolvedValue({
      id: '123',
      name: 'Added Deck',
      url: 'https://archidekt.com/decks/123/added',
      format: 'commander',
      commanderNames: ['Edgar Markov'],
      colorIdentity: ['W', 'B', 'R'],
      source: 'archidekt'
    });
    const upsertDeckInCollection = vi.fn().mockResolvedValue([
      {
        id: '123',
        name: 'Added Deck',
        url: 'https://archidekt.com/decks/123/added',
        format: 'commander',
        commanderNames: ['Edgar Markov'],
        commanderLinks: [],
        colorIdentity: ['W', 'B', 'R'],
        source: 'archidekt',
        addedAt: '2025-01-02T00:00:00.000Z'
      }
    ]);
    const searchScryfallCardByName = vi.fn().mockResolvedValue({
      id: 'markov',
      name: 'Edgar Markov',
      type_line: 'Legendary Creature',
      color_identity: ['W', 'B', 'R'],
      scryfall_uri: 'https://scryfall.com/card/markov/edgar-markov'
    });
    const upsertUser = vi.fn().mockResolvedValue(undefined);
    const getDeckStats = vi.fn().mockResolvedValue(
      new Map([
        [
          '123',
          {
            deckId: '123',
            totalGames: 5,
            wins: 3,
            losses: 2,
            winRate: 60,
            lastPlayed: '2025-06-01'
          }
        ]
      ])
    );
    const app = createApp({
      verifyGoogleIdToken,
      fetchDeckSummary,
      searchScryfallCardByName,
      upsertDeckInCollection,
      upsertUser,
      getDeckStats
    });

    const response = await request(app)
      .post('/api/decks')
      .set('authorization', 'Bearer token-456')
      .send({ deckUrl: 'https://archidekt.com/decks/123/added' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(fetchDeckSummary).toHaveBeenCalledWith('https://archidekt.com/decks/123/added');
    expect(searchScryfallCardByName).toHaveBeenCalledWith('Edgar Markov');
    expect(upsertDeckInCollection).toHaveBeenCalledWith('user-456', {
      id: '123',
      name: 'Added Deck',
      url: 'https://archidekt.com/decks/123/added',
      format: 'commander',
      commanderNames: ['Edgar Markov'],
      commanderLinks: ['https://scryfall.com/card/markov/edgar-markov'],
      colorIdentity: ['W', 'B', 'R'],
      source: 'archidekt'
    });
    expect(getDeckStats).toHaveBeenCalledWith('user-456');
    expect(response.body.decks[0].stats).toEqual({
      totalGames: 5,
      wins: 3,
      losses: 2,
      winRate: 60,
      lastPlayed: '2025-06-01'
    });
  });

  it('previews a deck before saving', async () => {
    const verifyGoogleIdToken = vi.fn().mockResolvedValue({ id: 'user-321' });
    const fetchDeckSummary = vi.fn().mockResolvedValue({
      id: '42',
      name: 'Preview Deck',
      url: 'https://archidekt.com/decks/42/preview',
      format: 'commander',
      commanderNames: ['Teysa Karlov'],
      colorIdentity: ['W', 'B'],
      source: 'archidekt'
    });
    const upsertUser = vi.fn().mockResolvedValue(undefined);
    const app = createApp({
      verifyGoogleIdToken,
      fetchDeckSummary,
      upsertUser
    });

    const response = await request(app)
      .post('/api/decks/preview')
      .set('authorization', 'Bearer token-321')
      .send({ deckUrl: 'https://archidekt.com/decks/42/preview' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(fetchDeckSummary).toHaveBeenCalledWith('https://archidekt.com/decks/42/preview');
    expect(response.body.deck).toEqual({
      id: '42',
      name: 'Preview Deck',
      url: 'https://archidekt.com/decks/42/preview',
      format: 'commander',
      commanderNames: ['Teysa Karlov'],
      colorIdentity: ['W', 'B'],
      source: 'archidekt'
    });
  });

  it('looks up a commander card by name', async () => {
    const verifyGoogleIdToken = vi.fn().mockResolvedValue({ id: 'user-555' });
    const searchScryfallCardByName = vi.fn().mockResolvedValue({
      id: 'kiora',
      name: 'Kiora, Sovereign of the Deep',
      type_line: 'Legendary Creature',
      color_identity: ['U', 'G'],
      scryfall_uri: 'https://scryfall.com/card/kiora/kiora-sovereign-of-the-deep'
    });
    const upsertUser = vi.fn().mockResolvedValue(undefined);
    const app = createApp({ verifyGoogleIdToken, searchScryfallCardByName, upsertUser });

    const response = await request(app)
      .post('/api/scryfall/lookup')
      .set('authorization', 'Bearer token-555')
      .send({ name: 'Kiora' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(searchScryfallCardByName).toHaveBeenCalledWith('Kiora');
    expect(response.body.card).toEqual({
      name: 'Kiora, Sovereign of the Deep',
      scryfallUrl: 'https://scryfall.com/card/kiora/kiora-sovereign-of-the-deep'
    });
  });

  it('adds a manual deck to the collection', async () => {
    const verifyGoogleIdToken = vi.fn().mockResolvedValue({ id: 'user-789' });
    const upsertDeckInCollection = vi.fn().mockResolvedValue([
      {
        id: 'manual-abc',
        name: 'Manual Deck',
        format: null,
        url: 'https://example.com/decklist',
        commanderNames: ['Commander One'],
        commanderLinks: ['https://scryfall.com/card/abc/commander-one'],
        colorIdentity: ['G'],
        source: 'manual',
        addedAt: '2025-01-03T00:00:00.000Z'
      }
    ]);
    const searchScryfallCardByName = vi.fn().mockResolvedValue({
      id: 'abc',
      name: 'Commander One',
      type_line: 'Legendary Creature',
      color_identity: ['G'],
      scryfall_uri: 'https://scryfall.com/card/abc/commander-one'
    });
    const upsertUser = vi.fn().mockResolvedValue(undefined);
    const getDeckStats = vi.fn().mockResolvedValue(new Map());
    const app = createApp({
      verifyGoogleIdToken,
      searchScryfallCardByName,
      upsertDeckInCollection,
      upsertUser,
      getDeckStats
    });

    const response = await request(app)
      .post('/api/decks/manual')
      .set('authorization', 'Bearer token-789')
      .send({
        name: 'Manual Deck',
        commanderNames: 'Commander One',
        colorIdentity: 'G',
        url: 'https://example.com/decklist'
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(searchScryfallCardByName).toHaveBeenCalledWith('Commander One');
    expect(upsertDeckInCollection).toHaveBeenCalledWith('user-789', expect.objectContaining({
      name: 'Manual Deck',
      url: 'https://example.com/decklist',
      format: null,
      commanderNames: ['Commander One'],
      commanderLinks: ['https://scryfall.com/card/abc/commander-one'],
      colorIdentity: ['G'],
      source: 'manual'
    }));
    expect(getDeckStats).toHaveBeenCalledWith('user-789');
    expect(response.body.decks[0].stats).toBe(null);
  });

  it('updates a deck in the collection', async () => {
    const verifyGoogleIdToken = vi.fn().mockResolvedValue({ id: 'user-202' });
    const upsertDeckInCollection = vi.fn().mockResolvedValue([
      {
        id: 'deck-202',
        name: 'Updated Deck',
        format: null,
        url: 'https://archidekt.com/decks/202/updated',
        commanderNames: ['Tymna the Weaver', 'Kraum'],
        commanderLinks: [],
        colorIdentity: ['W', 'U', 'B', 'R'],
        source: 'archidekt',
        addedAt: '2025-01-05T00:00:00.000Z'
      }
    ]);
    const searchScryfallCardByName = vi.fn()
      .mockResolvedValueOnce({
        id: 'tymna',
        name: 'Tymna the Weaver',
        type_line: 'Legendary Creature',
        color_identity: ['W', 'B'],
        scryfall_uri: 'https://scryfall.com/card/tymna/tymna-the-weaver'
      })
      .mockResolvedValueOnce({
        id: 'kraum',
        name: 'Kraum',
        type_line: 'Legendary Creature',
        color_identity: ['U', 'R'],
        scryfall_uri: 'https://scryfall.com/card/kraum/kraum'
      });
    const upsertUser = vi.fn().mockResolvedValue(undefined);
    const getDeckStats = vi.fn().mockResolvedValue(
      new Map([
        [
          'deck-202',
          {
            deckId: 'deck-202',
            totalGames: 10,
            wins: 7,
            losses: 3,
            winRate: 70,
            lastPlayed: '2025-07-01'
          }
        ]
      ])
    );
    const app = createApp({
      verifyGoogleIdToken,
      searchScryfallCardByName,
      upsertDeckInCollection,
      upsertUser,
      getDeckStats
    });

    const response = await request(app)
      .put('/api/decks/deck-202')
      .set('authorization', 'Bearer token-202')
      .send({
        name: 'Updated Deck',
        url: 'https://archidekt.com/decks/202/updated',
        commanderNames: 'Tymna the Weaver, Kraum',
        colorIdentity: 'WUBR'
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(searchScryfallCardByName).toHaveBeenCalledWith('Tymna the Weaver');
    expect(searchScryfallCardByName).toHaveBeenCalledWith('Kraum');
    expect(upsertDeckInCollection).toHaveBeenCalledWith('user-202', {
      id: 'deck-202',
      name: 'Updated Deck',
      url: 'https://archidekt.com/decks/202/updated',
      format: null,
      commanderNames: ['Tymna the Weaver', 'Kraum'],
      commanderLinks: [
        'https://scryfall.com/card/tymna/tymna-the-weaver',
        'https://scryfall.com/card/kraum/kraum'
      ],
      colorIdentity: ['W', 'U', 'B', 'R'],
      source: 'archidekt'
    });
    expect(getDeckStats).toHaveBeenCalledWith('user-202');
    expect(response.body.decks[0].stats).toEqual({
      totalGames: 10,
      wins: 7,
      losses: 3,
      winRate: 70,
      lastPlayed: '2025-07-01'
    });
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
        commanderLinks: [],
        colorIdentity: null,
        source: 'manual',
        addedAt: '2025-01-04T00:00:00.000Z'
      }
    ]);
    const upsertUser = vi.fn().mockResolvedValue(undefined);
    const getDeckStats = vi.fn().mockResolvedValue(new Map());
    const app = createApp({
      verifyGoogleIdToken,
      upsertDeckInCollection,
      upsertUser,
      getDeckStats
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
    expect(getDeckStats).toHaveBeenCalledWith('user-101');
  });

  it('removes a deck from the collection and includes stats', async () => {
    const verifyGoogleIdToken = vi.fn().mockResolvedValue({ id: 'user-303' });
    const removeDeckFromCollection = vi.fn().mockResolvedValue([
      {
        id: 'remaining-deck',
        name: 'Remaining Deck',
        url: null,
        format: null,
        commanderNames: ['Sol Ring'],
        commanderLinks: [],
        colorIdentity: [],
        source: 'manual',
        addedAt: '2025-01-01T00:00:00.000Z'
      }
    ]);
    const upsertUser = vi.fn().mockResolvedValue(undefined);
    const getDeckStats = vi.fn().mockResolvedValue(
      new Map([
        [
          'remaining-deck',
          {
            deckId: 'remaining-deck',
            totalGames: 3,
            wins: 2,
            losses: 1,
            winRate: 66.67,
            lastPlayed: '2025-05-15'
          }
        ]
      ])
    );
    const app = createApp({
      verifyGoogleIdToken,
      removeDeckFromCollection,
      upsertUser,
      getDeckStats
    });

    const response = await request(app)
      .delete('/api/decks/deck-to-remove')
      .set('authorization', 'Bearer token-303')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(removeDeckFromCollection).toHaveBeenCalledWith('user-303', 'deck-to-remove');
    expect(getDeckStats).toHaveBeenCalledWith('user-303');
    expect(response.body.decks[0].stats).toEqual({
      totalGames: 3,
      wins: 2,
      losses: 1,
      winRate: 66.67,
      lastPlayed: '2025-05-15'
    });
  });

  it('requires a Google token to access game logs', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/game-logs')
      .expect(401);

    expect(response.body.error).toBe('Google ID token is required.');
  });

  it('lists game logs for a user', async () => {
    const verifyGoogleIdToken = vi.fn().mockResolvedValue({ id: 'user-777' });
    const upsertUser = vi.fn().mockResolvedValue(undefined);
    const listGameLogs = vi.fn().mockResolvedValue([
      {
        id: 'log-1',
        deckId: 'deck-1',
        deckName: 'Esper Knights',
        playedAt: '2025-02-14',
        opponentsCount: 2,
        opponents: [],
        result: null,
        createdAt: '2025-02-14T00:00:00.000Z'
      }
    ]);
    const app = createApp({ verifyGoogleIdToken, upsertUser, listGameLogs });

    const response = await request(app)
      .get('/api/game-logs')
      .set('authorization', 'Bearer token-777')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(listGameLogs).toHaveBeenCalledWith('user-777');
    expect(response.body.logs).toHaveLength(1);
  });

  it('searches users by name or email', async () => {
    const verifyGoogleIdToken = vi.fn().mockResolvedValue({ id: 'user-111' });
    const upsertUser = vi.fn().mockResolvedValue(undefined);
    const searchOpponentUsers = vi.fn().mockResolvedValue([
      { id: 'user-a', name: 'Alpha User', email: 'alpha@test.dev' }
    ]);
    const app = createApp({ verifyGoogleIdToken, upsertUser, searchOpponentUsers });

    const response = await request(app)
      .get('/api/users/search?query=alpha')
      .set('authorization', 'Bearer token-111')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(searchOpponentUsers).toHaveBeenCalledWith('alpha', 10);
    expect(response.body.users).toHaveLength(1);
  });

  it('lists recent opponents for a user', async () => {
    const verifyGoogleIdToken = vi.fn().mockResolvedValue({ id: 'user-222' });
    const upsertUser = vi.fn().mockResolvedValue(undefined);
    const listRecentOpponents = vi.fn().mockResolvedValue([
      { id: 'user-b', name: 'Bravo User', email: 'bravo@test.dev' }
    ]);
    const app = createApp({ verifyGoogleIdToken, upsertUser, listRecentOpponents });

    const response = await request(app)
      .get('/api/opponents/recent')
      .set('authorization', 'Bearer token-222')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(listRecentOpponents).toHaveBeenCalledWith('user-222', 10);
    expect(response.body.opponents).toHaveLength(1);
  });

  it('creates a game log for a deck in the collection', async () => {
    const verifyGoogleIdToken = vi.fn().mockResolvedValue({ id: 'user-888' });
    const upsertUser = vi.fn().mockResolvedValue(undefined);
    const listDeckCollection = vi.fn().mockResolvedValue([
      {
        id: 'deck-1',
        name: 'Esper Knights',
        url: 'https://archidekt.com/decks/1/test',
        format: 'commander',
        commanderNames: ['Sidar Jabari'],
        commanderLinks: [],
        colorIdentity: ['W', 'U', 'B'],
        source: 'archidekt',
        addedAt: '2025-01-01T00:00:00.000Z'
      }
    ]);
    const createGameLog = vi.fn().mockResolvedValue([
      {
        id: 'log-1',
        deckId: 'deck-1',
        deckName: 'Esper Knights',
        playedAt: '2025-02-14',
        opponentsCount: 2,
        opponents: [
          {
            userId: 'user-42',
            name: null,
            commanderNames: ['Ghave, Guru of Spores'],
            commanderLinks: [null],
            colorIdentity: ['W', 'B', 'G']
          }
        ],
        result: null,
        createdAt: '2025-02-14T00:00:00.000Z'
      }
    ]);
    const recordRecentOpponents = vi.fn().mockResolvedValue(undefined);
    const app = createApp({
      verifyGoogleIdToken,
      upsertUser,
      listDeckCollection,
      createGameLog,
      recordRecentOpponents
    });

    const response = await request(app)
      .post('/api/game-logs')
      .set('authorization', 'Bearer token-888')
      .send({
        deckId: 'deck-1',
        datePlayed: '2025-02-14',
        opponentsCount: 2,
        opponents: [
          {
            userId: 'user-42',
            commanderNames: ['Ghave, Guru of Spores'],
            colorIdentity: 'WBG'
          }
        ],
        result: null
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(recordRecentOpponents).toHaveBeenCalledWith('user-888', ['user-42']);
    expect(createGameLog).toHaveBeenCalledWith('user-888', expect.objectContaining({
      deckId: 'deck-1',
      deckName: 'Esper Knights',
      playedAt: '2025-02-14',
      opponentsCount: 2,
      opponents: [
        {
          userId: 'user-42',
          name: null,
          commanderNames: ['Ghave, Guru of Spores'],
          commanderLinks: [null],
          colorIdentity: ['W', 'B', 'G']
        }
      ],
      result: null
    }));
  });

  it('updates a game log', async () => {
    const verifyGoogleIdToken = vi.fn().mockResolvedValue({ id: 'user-999' });
    const upsertUser = vi.fn().mockResolvedValue(undefined);
    const updateGameLog = vi.fn().mockResolvedValue([
      {
        id: 'log-5',
        deckId: 'deck-1',
        deckName: 'Esper Knights',
        playedAt: '2025-02-15',
        opponentsCount: 3,
        opponents: [],
        result: 'win',
        createdAt: '2025-02-14T00:00:00.000Z'
      }
    ]);
    const recordRecentOpponents = vi.fn().mockResolvedValue(undefined);
    const app = createApp({
      verifyGoogleIdToken,
      upsertUser,
      updateGameLog,
      recordRecentOpponents
    });

    const response = await request(app)
      .patch('/api/game-logs/log-5')
      .set('authorization', 'Bearer token-999')
      .send({
        datePlayed: '2025-02-15',
        opponentsCount: 3,
        opponents: [{ userId: 'user-77', name: 'Opponent', commanderNames: [], colorIdentity: null }],
        result: 'win'
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(recordRecentOpponents).toHaveBeenCalledWith('user-999', ['user-77']);
    expect(updateGameLog).toHaveBeenCalledWith('user-999', 'log-5', expect.objectContaining({
      playedAt: '2025-02-15',
      opponentsCount: 3,
      result: 'win'
    }));
  });
});
