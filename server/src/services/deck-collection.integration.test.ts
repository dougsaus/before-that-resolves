import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { closePool, initializeDatabase, resetPool } from './db';
import { listDeckCollection, removeDeckFromCollection, upsertDeckInCollection, upsertUser } from './deck-collection';

const runIntegration = process.env.RUN_INTEGRATION_TESTS === '1';
const integration = runIntegration ? describe : describe.skip;

integration('deck collection persistence (integration)', () => {
  let container: StartedPostgreSqlContainer;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    process.env.DATABASE_URL = container.getConnectionUri();
    await initializeDatabase();
  });

  afterAll(async () => {
    await closePool();
    resetPool();
    await container.stop();
    delete process.env.DATABASE_URL;
  });

  it('stores decks per user and supports removal', async () => {
    await upsertUser({ id: 'user-1', email: 'user@test.dev', name: 'Test User' });

    await upsertDeckInCollection('user-1', {
      id: 'deck-1',
      name: 'Deck One',
      url: 'https://archidekt.com/decks/1/test',
      format: 'commander',
      commanderNames: ['Commander One'],
      colorIdentity: ['G'],
      source: 'archidekt'
    });

    await upsertDeckInCollection('user-1', {
      id: 'deck-2',
      name: 'Deck Two',
      url: null,
      format: null,
      commanderNames: [],
      colorIdentity: null,
      source: 'manual'
    });

    const decks = await listDeckCollection('user-1');
    expect(decks).toHaveLength(2);

    await removeDeckFromCollection('user-1', 'deck-1');
    const remaining = await listDeckCollection('user-1');
    expect(remaining.map((deck) => deck.id)).toEqual(['deck-2']);
  });
});
