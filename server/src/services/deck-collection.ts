import type { GoogleUser } from './google-auth';
import { getPool } from './db';

export type DeckCollectionEntry = {
  id: string;
  name: string;
  url: string | null;
  format: string | null;
  commanderNames: string[];
  commanderLinks: Array<string | null>;
  colorIdentity: string[] | null;
  source: 'archidekt' | 'manual';
  addedAt: string;
};

export type DeckCollectionInput = Omit<DeckCollectionEntry, 'addedAt'>;

type DeckRow = {
  deck_id: string;
  name: string;
  url: string | null;
  format: string | null;
  commander_name_primary: string | null;
  commander_name_secondary: string | null;
  commander_scryfall_url_primary: string | null;
  commander_scryfall_url_secondary: string | null;
  color_identity: string[] | null;
  source: 'archidekt' | 'manual';
  added_at: string | Date;
};

function mapDeckRow(row: DeckRow): DeckCollectionEntry {
  const addedAt = row.added_at instanceof Date ? row.added_at.toISOString() : row.added_at;
  const commanderNames: string[] = [];
  const commanderLinks: Array<string | null> = [];
  if (row.commander_name_primary) {
    commanderNames.push(row.commander_name_primary);
    commanderLinks.push(row.commander_scryfall_url_primary ?? null);
  }
  if (row.commander_name_secondary) {
    commanderNames.push(row.commander_name_secondary);
    commanderLinks.push(row.commander_scryfall_url_secondary ?? null);
  }
  return {
    id: row.deck_id,
    name: row.name,
    url: row.url,
    format: row.format,
    commanderNames,
    commanderLinks,
    colorIdentity: row.color_identity ?? null,
    source: row.source,
    addedAt
  };
}

export async function upsertUser(user: GoogleUser): Promise<void> {
  const db = getPool();
  await db.query(
    `INSERT INTO users (id, email, name, picture, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (id)
     DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, picture = EXCLUDED.picture, updated_at = NOW()`,
    [user.id, user.email ?? null, user.name ?? null, user.picture ?? null]
  );
}

export async function listDeckCollection(userId: string): Promise<DeckCollectionEntry[]> {
  const db = getPool();
  const result = await db.query<DeckRow>(
    `SELECT deck_id,
            name,
            url,
            format,
            commander_name_primary,
            commander_name_secondary,
            commander_scryfall_url_primary,
            commander_scryfall_url_secondary,
            color_identity,
            source,
            added_at
     FROM decks
     WHERE user_id = $1
     ORDER BY added_at DESC`,
    [userId]
  );
  return result.rows.map(mapDeckRow);
}

export async function upsertDeckInCollection(
  userId: string,
  deck: DeckCollectionInput
): Promise<DeckCollectionEntry[]> {
  const db = getPool();
  const commanderNames = deck.commanderNames ?? [];
  const commanderLinks = deck.commanderLinks ?? [];
  await db.query(
    `INSERT INTO decks (
      user_id,
      deck_id,
      name,
      url,
      format,
      commander_name_primary,
      commander_name_secondary,
      commander_scryfall_url_primary,
      commander_scryfall_url_secondary,
      color_identity,
      source,
      added_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    ON CONFLICT (user_id, deck_id)
    DO UPDATE SET
      name = EXCLUDED.name,
      url = EXCLUDED.url,
      format = EXCLUDED.format,
      commander_name_primary = EXCLUDED.commander_name_primary,
      commander_name_secondary = EXCLUDED.commander_name_secondary,
      commander_scryfall_url_primary = EXCLUDED.commander_scryfall_url_primary,
      commander_scryfall_url_secondary = EXCLUDED.commander_scryfall_url_secondary,
      color_identity = EXCLUDED.color_identity,
      source = EXCLUDED.source`,
    [
      userId,
      deck.id,
      deck.name,
      deck.url,
      deck.format,
      commanderNames[0] ?? null,
      commanderNames[1] ?? null,
      commanderLinks[0] ?? null,
      commanderLinks[1] ?? null,
      deck.colorIdentity ?? null,
      deck.source
    ]
  );
  return listDeckCollection(userId);
}

export async function removeDeckFromCollection(userId: string, deckId: string): Promise<DeckCollectionEntry[]> {
  const db = getPool();
  await db.query(
    `DELETE FROM decks
     WHERE user_id = $1 AND deck_id = $2`,
    [userId, deckId]
  );
  return listDeckCollection(userId);
}
