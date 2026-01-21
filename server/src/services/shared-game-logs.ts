import crypto from 'node:crypto';
import { getPool } from './db';
import { normalizeDateInput } from '../utils/date';
import type { GameLogOpponent } from './game-logs';
import { normalizeOpponents, normalizeTags } from './game-logs';

export type SharedGameLogStatus = 'pending' | 'accepted' | 'rejected';

export type SharedGameLogEntry = {
  id: string;
  recipientUserId: string;
  sharedByUserId: string;
  sourceLogId: string;
  deckId: string | null;
  deckName: string | null;
  deckUrl: string | null;
  commanderNames: string[];
  commanderLinks: Array<string | null>;
  playedAt: string;
  turns: number | null;
  durationMinutes: number | null;
  opponentsCount: number;
  opponents: GameLogOpponent[];
  result: 'win' | 'loss' | null;
  tags: string[];
  status: SharedGameLogStatus;
  createdAt: string;
  updatedAt: string;
};

export type SharedGameLogInput = {
  recipientUserId: string;
  sharedByUserId: string;
  sourceLogId: string;
  deckId: string | null;
  deckName: string | null;
  deckUrl: string | null;
  commanderNames: string[];
  commanderLinks: Array<string | null>;
  playedAt: string;
  turns: number | null;
  durationMinutes: number | null;
  opponentsCount: number;
  opponents: GameLogOpponent[];
  result: 'win' | 'loss' | null;
  tags: string[];
};

export type SharedGameLogUpdate = Omit<SharedGameLogInput, 'recipientUserId' | 'sharedByUserId' | 'sourceLogId'>;

type SharedGameLogRow = {
  id: string;
  recipient_user_id: string;
  shared_by_user_id: string;
  source_log_id: string;
  deck_id: string | null;
  deck_name: string | null;
  deck_url: string | null;
  commander_names: unknown;
  commander_links: unknown;
  played_at: string | Date;
  turns: number | null;
  duration_minutes: number | null;
  opponents_count: number;
  opponents: unknown;
  result: 'win' | 'loss' | null;
  tags: unknown;
  status: SharedGameLogStatus;
  created_at: string | Date;
  updated_at: string | Date;
};

function normalizeCommanderSnapshot(
  names: unknown,
  links: unknown
): { commanderNames: string[]; commanderLinks: Array<string | null> } {
  const commanderNames = Array.isArray(names)
    ? names
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim())
        .slice(0, 2)
    : [];
  let commanderLinks: Array<string | null> = [];
  if (Array.isArray(links)) {
    commanderLinks = links
      .slice(0, commanderNames.length)
      .map((value) => (typeof value === 'string' && value.trim() ? value.trim() : null));
  }
  while (commanderLinks.length < commanderNames.length) {
    commanderLinks.push(null);
  }
  return { commanderNames, commanderLinks };
}

function mapSharedGameLogRow(row: SharedGameLogRow): SharedGameLogEntry {
  const playedAt = normalizeDateInput(row.played_at);
  const createdAt = row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at;
  const updatedAt = row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at;
  const { commanderNames, commanderLinks } = normalizeCommanderSnapshot(
    row.commander_names,
    row.commander_links
  );
  return {
    id: row.id,
    recipientUserId: row.recipient_user_id,
    sharedByUserId: row.shared_by_user_id,
    sourceLogId: row.source_log_id,
    deckId: row.deck_id ?? null,
    deckName: row.deck_name ?? null,
    deckUrl: row.deck_url ?? null,
    commanderNames,
    commanderLinks,
    playedAt,
    turns: row.turns ?? null,
    durationMinutes: row.duration_minutes ?? null,
    opponentsCount: row.opponents_count,
    opponents: normalizeOpponents(row.opponents),
    result: row.result,
    tags: normalizeTags(row.tags),
    status: row.status,
    createdAt,
    updatedAt
  };
}

export async function listSharedGameLogs(
  recipientUserId: string,
  status: SharedGameLogStatus = 'pending'
): Promise<SharedGameLogEntry[]> {
  const db = getPool();
  const result = await db.query<SharedGameLogRow>(
    `SELECT id, recipient_user_id, shared_by_user_id, source_log_id, deck_id, deck_name, deck_url,
            commander_names, commander_links, played_at, turns, duration_minutes, opponents_count, opponents,
            result, tags, status, created_at, updated_at
     FROM shared_game_logs
     WHERE recipient_user_id = $1 AND status = $2
     ORDER BY created_at DESC`,
    [recipientUserId, status]
  );
  return result.rows.map(mapSharedGameLogRow);
}

export async function getSharedGameLogById(
  recipientUserId: string,
  sharedLogId: string
): Promise<SharedGameLogEntry | null> {
  const db = getPool();
  const result = await db.query<SharedGameLogRow>(
    `SELECT id, recipient_user_id, shared_by_user_id, source_log_id, deck_id, deck_name, deck_url,
            commander_names, commander_links, played_at, turns, duration_minutes, opponents_count, opponents,
            result, tags, status, created_at, updated_at
     FROM shared_game_logs
     WHERE recipient_user_id = $1 AND id = $2`,
    [recipientUserId, sharedLogId]
  );
  if (result.rows.length === 0) return null;
  return mapSharedGameLogRow(result.rows[0]);
}

export async function createSharedGameLog(input: SharedGameLogInput): Promise<boolean> {
  const db = getPool();
  const id = crypto.randomUUID();
  const result = await db.query(
    `INSERT INTO shared_game_logs (
      id,
      recipient_user_id,
      shared_by_user_id,
      source_log_id,
      deck_id,
      deck_name,
      deck_url,
      commander_names,
      commander_links,
      played_at,
      turns,
      duration_minutes,
      opponents_count,
      opponents,
      result,
      tags,
      status,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::date, $11, $12, $13, $14::jsonb, $15, $16::jsonb, 'pending', NOW(), NOW())
    ON CONFLICT (recipient_user_id, source_log_id)
    DO NOTHING`,
    [
      id,
      input.recipientUserId,
      input.sharedByUserId,
      input.sourceLogId,
      input.deckId,
      input.deckName,
      input.deckUrl,
      JSON.stringify(input.commanderNames ?? []),
      JSON.stringify(input.commanderLinks ?? []),
      input.playedAt,
      input.turns,
      input.durationMinutes,
      input.opponentsCount,
      JSON.stringify(input.opponents ?? []),
      input.result,
      JSON.stringify(input.tags ?? [])
    ]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listSharedLogStatuses(
  recipientUserIds: string[],
  sourceLogId: string
): Promise<Map<string, SharedGameLogStatus>> {
  if (recipientUserIds.length === 0) {
    return new Map();
  }
  const db = getPool();
  const result = await db.query<{ recipient_user_id: string; status: SharedGameLogStatus }>(
    `SELECT recipient_user_id, status
     FROM shared_game_logs
     WHERE recipient_user_id = ANY($1) AND source_log_id = $2`,
    [recipientUserIds, sourceLogId]
  );
  const map = new Map<string, SharedGameLogStatus>();
  for (const row of result.rows) {
    map.set(row.recipient_user_id, row.status);
  }
  return map;
}

export async function reopenSharedGameLog(input: SharedGameLogInput): Promise<boolean> {
  const db = getPool();
  const result = await db.query(
    `UPDATE shared_game_logs
     SET deck_id = $1,
         deck_name = $2,
         deck_url = $3,
         commander_names = $4::jsonb,
         commander_links = $5::jsonb,
         played_at = $6::date,
         turns = $7,
         duration_minutes = $8,
         opponents_count = $9,
         opponents = $10::jsonb,
         result = $11,
         tags = $12::jsonb,
         status = 'pending',
         updated_at = NOW()
     WHERE recipient_user_id = $13 AND source_log_id = $14 AND status = 'rejected'`,
    [
      input.deckId,
      input.deckName,
      input.deckUrl,
      JSON.stringify(input.commanderNames ?? []),
      JSON.stringify(input.commanderLinks ?? []),
      input.playedAt,
      input.turns,
      input.durationMinutes,
      input.opponentsCount,
      JSON.stringify(input.opponents ?? []),
      input.result,
      JSON.stringify(input.tags ?? []),
      input.recipientUserId,
      input.sourceLogId
    ]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateSharedGameLog(
  recipientUserId: string,
  sharedLogId: string,
  input: SharedGameLogUpdate
): Promise<SharedGameLogEntry | null> {
  const db = getPool();
  const result = await db.query<SharedGameLogRow>(
    `UPDATE shared_game_logs
     SET deck_id = $1,
         deck_name = $2,
         deck_url = $3,
         commander_names = $4::jsonb,
         commander_links = $5::jsonb,
         played_at = $6::date,
         turns = $7,
         duration_minutes = $8,
         opponents_count = $9,
         opponents = $10::jsonb,
         result = $11,
         tags = $12::jsonb,
         updated_at = NOW()
     WHERE recipient_user_id = $13 AND id = $14 AND status = 'pending'
     RETURNING id, recipient_user_id, shared_by_user_id, source_log_id, deck_id, deck_name, deck_url,
               commander_names, commander_links, played_at, turns, duration_minutes, opponents_count, opponents,
               result, tags, status, created_at, updated_at`,
    [
      input.deckId,
      input.deckName,
      input.deckUrl,
      JSON.stringify(input.commanderNames ?? []),
      JSON.stringify(input.commanderLinks ?? []),
      input.playedAt,
      input.turns,
      input.durationMinutes,
      input.opponentsCount,
      JSON.stringify(input.opponents ?? []),
      input.result,
      JSON.stringify(input.tags ?? []),
      recipientUserId,
      sharedLogId
    ]
  );
  if (result.rows.length === 0) return null;
  return mapSharedGameLogRow(result.rows[0]);
}

export async function setSharedGameLogStatus(
  recipientUserId: string,
  sharedLogId: string,
  status: SharedGameLogStatus
): Promise<boolean> {
  const db = getPool();
  const result = await db.query(
    `UPDATE shared_game_logs
     SET status = $1, updated_at = NOW()
     WHERE recipient_user_id = $2 AND id = $3 AND status = 'pending'`,
    [status, recipientUserId, sharedLogId]
  );
  return (result.rowCount ?? 0) > 0;
}
