import { getPool } from './db';

export type OpponentUser = {
  id: string;
  name: string | null;
  email: string | null;
};

export async function searchOpponentUsers(query: string, limit = 10): Promise<OpponentUser[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const db = getPool();
  const result = await db.query<OpponentUser>(
    `SELECT id, name, email
     FROM users
     WHERE name ILIKE $1 OR email ILIKE $1
     ORDER BY name NULLS LAST, email NULLS LAST
     LIMIT $2`,
    [`%${trimmed}%`, limit]
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name ?? null,
    email: row.email ?? null
  }));
}

export async function listRecentOpponents(userId: string, limit = 10): Promise<OpponentUser[]> {
  const db = getPool();
  const result = await db.query<OpponentUser>(
    `SELECT users.id, users.name, users.email
     FROM recent_opponents
     JOIN users ON users.id = recent_opponents.opponent_user_id
     WHERE recent_opponents.user_id = $1
     ORDER BY recent_opponents.last_selected_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name ?? null,
    email: row.email ?? null
  }));
}

export async function recordRecentOpponents(userId: string, opponentUserIds: string[]): Promise<void> {
  const uniqueOpponentIds = Array.from(new Set(opponentUserIds.filter(Boolean)));
  if (uniqueOpponentIds.length === 0) return;
  const db = getPool();
  await db.query(
    `INSERT INTO recent_opponents (user_id, opponent_user_id, last_selected_at)
     SELECT $1, UNNEST($2::text[]), NOW()
     ON CONFLICT (user_id, opponent_user_id)
     DO UPDATE SET last_selected_at = NOW()`,
    [userId, uniqueOpponentIds]
  );
}
