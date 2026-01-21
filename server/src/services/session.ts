import crypto from 'node:crypto';
import { getPool } from './db';

export const SESSION_TTL_MS = 8 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE_NAME = 'btr_session';

export type SessionRecord = {
  userId: string;
  expiresAt: Date;
  lastSeenAt: Date;
};

const hashSessionId = (sessionId: string) =>
  crypto.createHash('sha256').update(sessionId).digest('hex');

export async function createSession(userId: string): Promise<{ sessionId: string; expiresAt: Date }> {
  const db = getPool();
  const sessionId = crypto.randomUUID();
  const sessionIdHash = hashSessionId(sessionId);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.query(
    `INSERT INTO user_sessions (session_id_hash, user_id, expires_at, last_seen_at)
     VALUES ($1, $2, $3, NOW())`,
    [sessionIdHash, userId, expiresAt]
  );
  return { sessionId, expiresAt };
}

export async function getSession(sessionId: string): Promise<SessionRecord | null> {
  const db = getPool();
  const sessionIdHash = hashSessionId(sessionId);
  const result = await db.query<{
    user_id: string;
    expires_at: Date;
    last_seen_at: Date;
  }>(
    `SELECT user_id, expires_at, last_seen_at
     FROM user_sessions
     WHERE session_id_hash = $1`,
    [sessionIdHash]
  );
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows[0];
  return {
    userId: row.user_id,
    expiresAt: row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at),
    lastSeenAt: row.last_seen_at instanceof Date ? row.last_seen_at : new Date(row.last_seen_at)
  };
}

export async function touchSession(sessionId: string): Promise<Date | null> {
  const db = getPool();
  const sessionIdHash = hashSessionId(sessionId);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const result = await db.query<{ expires_at: Date }>(
    `UPDATE user_sessions
     SET expires_at = $2, last_seen_at = NOW()
     WHERE session_id_hash = $1
     RETURNING expires_at`,
    [sessionIdHash, expiresAt]
  );
  if (result.rows.length === 0) {
    return null;
  }
  const updated = result.rows[0].expires_at;
  return updated instanceof Date ? updated : new Date(updated);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = getPool();
  const sessionIdHash = hashSessionId(sessionId);
  await db.query(
    `DELETE FROM user_sessions WHERE session_id_hash = $1`,
    [sessionIdHash]
  );
}
