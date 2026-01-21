import { Pool, type PoolConfig } from 'pg';

let pool: Pool | null = null;

const schemaQueries = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    name TEXT,
    picture TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE TABLE IF NOT EXISTS user_sessions (
    session_id_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions (user_id);`,
  `CREATE INDEX IF NOT EXISTS user_sessions_expires_at_idx ON user_sessions (expires_at);`,
  `CREATE TABLE IF NOT EXISTS decks (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deck_id TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT,
    format TEXT,
    commander_name_primary TEXT,
    commander_name_secondary TEXT,
    commander_scryfall_url_primary TEXT,
    commander_scryfall_url_secondary TEXT,
    color_identity TEXT[],
    source TEXT NOT NULL CHECK (source IN ('archidekt', 'moxfield', 'manual')),
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, deck_id)
  );`,
  `ALTER TABLE decks ADD COLUMN IF NOT EXISTS commander_name_primary TEXT;`,
  `ALTER TABLE decks ADD COLUMN IF NOT EXISTS commander_name_secondary TEXT;`,
  `ALTER TABLE decks ADD COLUMN IF NOT EXISTS commander_scryfall_url_primary TEXT;`,
  `ALTER TABLE decks ADD COLUMN IF NOT EXISTS commander_scryfall_url_secondary TEXT;`,
  `ALTER TABLE decks DROP CONSTRAINT IF EXISTS decks_source_check;`,
  `ALTER TABLE decks ADD CONSTRAINT decks_source_check CHECK (source IN ('archidekt', 'moxfield', 'manual'));`,
  `DO $$
   BEGIN
     IF EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_name = 'decks' AND column_name = 'commander_names'
     ) THEN
       UPDATE decks
       SET commander_name_primary = COALESCE(commander_name_primary, commander_names[1]),
           commander_name_secondary = COALESCE(commander_name_secondary, commander_names[2])
       WHERE (commander_name_primary IS NULL AND commander_name_secondary IS NULL)
         AND commander_names IS NOT NULL
         AND array_length(commander_names, 1) > 0;
     END IF;
   END $$;`,
  `CREATE INDEX IF NOT EXISTS decks_user_added_at_idx ON decks (user_id, added_at DESC);`,
  `CREATE TABLE IF NOT EXISTS game_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deck_id TEXT NOT NULL,
    deck_name TEXT NOT NULL,
    played_at DATE NOT NULL,
    turns INTEGER,
    duration_minutes INTEGER,
    opponents_count INTEGER NOT NULL DEFAULT 0,
    opponents JSONB NOT NULL DEFAULT '[]'::jsonb,
    result TEXT CHECK (result IN ('win', 'loss')),
    good_game BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (user_id, deck_id) REFERENCES decks(user_id, deck_id) ON DELETE CASCADE
  );`,
  `DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'game_logs') THEN
       ALTER TABLE game_logs ALTER COLUMN result DROP NOT NULL;
       ALTER TABLE game_logs DROP CONSTRAINT IF EXISTS game_logs_result_check;
       ALTER TABLE game_logs ADD CONSTRAINT game_logs_result_check CHECK (result IN ('win', 'loss'));
       ALTER TABLE game_logs ADD COLUMN IF NOT EXISTS turns INTEGER;
       ALTER TABLE game_logs ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
       ALTER TABLE game_logs ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
       ALTER TABLE game_logs ADD COLUMN IF NOT EXISTS commander_names JSONB NOT NULL DEFAULT '[]'::jsonb;
       ALTER TABLE game_logs ADD COLUMN IF NOT EXISTS commander_links JSONB NOT NULL DEFAULT '[]'::jsonb;
     END IF;
   END $$;`,
  `CREATE INDEX IF NOT EXISTS game_logs_user_played_at_idx
    ON game_logs (user_id, played_at DESC, created_at DESC);`,
  `CREATE TABLE IF NOT EXISTS shared_game_logs (
    id TEXT PRIMARY KEY,
    recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_log_id TEXT NOT NULL,
    deck_id TEXT,
    deck_name TEXT,
    deck_url TEXT,
    played_at DATE NOT NULL,
    turns INTEGER,
    duration_minutes INTEGER,
    opponents_count INTEGER NOT NULL DEFAULT 0,
    opponents JSONB NOT NULL DEFAULT '[]'::jsonb,
    result TEXT CHECK (result IN ('win', 'loss')),
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS shared_game_logs_recipient_source_idx
    ON shared_game_logs (recipient_user_id, source_log_id);`,
  `CREATE INDEX IF NOT EXISTS shared_game_logs_recipient_status_idx
    ON shared_game_logs (recipient_user_id, status, created_at DESC);`,
  `CREATE TABLE IF NOT EXISTS recent_opponents (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opponent_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, opponent_user_id)
  );`,
  `CREATE INDEX IF NOT EXISTS recent_opponents_user_idx
    ON recent_opponents (user_id, last_selected_at DESC);`
];

function getPoolConfig(): PoolConfig {
  const connectionString = (process.env.DATABASE_URL || '').trim();
  if (connectionString) {
    const sslEnabled = process.env.DB_SSL === 'true';
    return sslEnabled
      ? { connectionString, ssl: { rejectUnauthorized: false } }
      : { connectionString };
  }

  let host = (process.env.DB_HOST || '').trim();
  const cloudSqlInstance = (process.env.CLOUD_SQL_INSTANCE || '').trim();
  if (!host && cloudSqlInstance) {
    host = `/cloudsql/${cloudSqlInstance}`;
  }
  if (!host) {
    throw new Error('Database not configured. Set DATABASE_URL or DB_HOST.');
  }

  const port = Number.parseInt(process.env.DB_PORT || '5432', 10);
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';
  const database = process.env.DB_NAME || 'before_that_resolves';
  const sslEnabled = process.env.DB_SSL === 'true';

  return {
    host,
    port,
    user,
    password,
    database,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
  };
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(getPoolConfig());
  }
  return pool;
}

export async function initializeDatabase(): Promise<void> {
  const db = getPool();
  for (const query of schemaQueries) {
    await db.query(query);
  }
}

export async function closePool(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = null;
}

export function resetPool(): void {
  pool = null;
}
