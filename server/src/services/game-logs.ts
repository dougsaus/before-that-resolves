import crypto from 'node:crypto';
import { getPool } from './db';

export type GameLogOpponent = {
  name: string | null;
  commander: string | null;
  colorIdentity: string[] | null;
};

export type GameLogEntry = {
  id: string;
  deckId: string;
  deckName: string;
  playedAt: string;
  opponentsCount: number;
  opponents: GameLogOpponent[];
  result: 'win' | 'loss' | null;
  goodGame: boolean;
  createdAt: string;
};

export type GameLogInput = {
  deckId: string;
  deckName: string;
  playedAt: string;
  opponentsCount: number;
  opponents: GameLogOpponent[];
  result: 'win' | 'loss' | null;
  goodGame: boolean;
};

export type GameLogUpdate = Omit<GameLogInput, 'deckId' | 'deckName'>;

type GameLogRow = {
  id: string;
  deck_id: string;
  deck_name: string;
  played_at: string | Date;
  opponents_count: number;
  opponents: unknown;
  result: 'win' | 'loss' | null;
  good_game: boolean;
  created_at: string | Date;
};

function normalizeOpponent(entry: unknown): GameLogOpponent | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const record = entry as Record<string, unknown>;
  const name =
    typeof record.name === 'string' && record.name.trim()
      ? record.name.trim()
      : null;
  const commander =
    typeof record.commander === 'string' && record.commander.trim()
      ? record.commander.trim()
      : null;
  const colorIdentity = Array.isArray(record.colorIdentity)
    ? record.colorIdentity.filter((value): value is string => typeof value === 'string')
    : null;
  if (!name && !commander && (!colorIdentity || colorIdentity.length === 0)) {
    return null;
  }
  return {
    name,
    commander,
    colorIdentity: colorIdentity && colorIdentity.length > 0 ? colorIdentity : null
  };
}

function normalizeOpponents(input: unknown): GameLogOpponent[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => normalizeOpponent(entry))
    .filter((entry): entry is GameLogOpponent => Boolean(entry));
}

function normalizeDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function mapGameLogRow(row: GameLogRow): GameLogEntry {
  const playedAt = normalizeDate(row.played_at);
  const createdAt =
    row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at;
  return {
    id: row.id,
    deckId: row.deck_id,
    deckName: row.deck_name,
    playedAt,
    opponentsCount: row.opponents_count,
    opponents: normalizeOpponents(row.opponents),
    result: row.result,
    goodGame: row.good_game,
    createdAt
  };
}

export async function listGameLogs(userId: string): Promise<GameLogEntry[]> {
  const db = getPool();
  const result = await db.query<GameLogRow>(
    `SELECT id, deck_id, deck_name, played_at, opponents_count, opponents, result, good_game, created_at
     FROM game_logs
     WHERE user_id = $1
     ORDER BY played_at DESC, created_at DESC`,
    [userId]
  );
  return result.rows.map(mapGameLogRow);
}

export async function createGameLog(userId: string, input: GameLogInput): Promise<GameLogEntry[]> {
  const db = getPool();
  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO game_logs (
      id,
      user_id,
      deck_id,
      deck_name,
      played_at,
      opponents_count,
      opponents,
      result,
      good_game,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5::date, $6, $7::jsonb, $8, $9, NOW())`,
    [
      id,
      userId,
      input.deckId,
      input.deckName,
      input.playedAt,
      input.opponentsCount,
      JSON.stringify(input.opponents ?? []),
      input.result,
      input.goodGame
    ]
  );
  return listGameLogs(userId);
}

export async function updateGameLog(
  userId: string,
  logId: string,
  input: GameLogUpdate
): Promise<GameLogEntry[]> {
  const db = getPool();
  await db.query(
    `UPDATE game_logs
     SET played_at = $1::date,
         opponents_count = $2,
         opponents = $3::jsonb,
         result = $4,
         good_game = $5
     WHERE user_id = $6 AND id = $7`,
    [
      input.playedAt,
      input.opponentsCount,
      JSON.stringify(input.opponents ?? []),
      input.result,
      input.goodGame,
      userId,
      logId
    ]
  );
  return listGameLogs(userId);
}

export async function removeGameLog(userId: string, logId: string): Promise<GameLogEntry[]> {
  const db = getPool();
  await db.query(
    `DELETE FROM game_logs
     WHERE user_id = $1 AND id = $2`,
    [userId, logId]
  );
  return listGameLogs(userId);
}

export type DeckStats = {
  deckId: string;
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number | null;
  lastPlayed: string | null;
};

type DeckStatsRow = {
  deck_id: string;
  total_games: string;
  wins: string;
  losses: string;
  last_played: string | Date | null;
};

export async function getDeckStats(userId: string): Promise<Map<string, DeckStats>> {
  const db = getPool();
  const result = await db.query<DeckStatsRow>(
    `SELECT
       deck_id,
       COUNT(*) AS total_games,
       COUNT(*) FILTER (WHERE result = 'win') AS wins,
       COUNT(*) FILTER (WHERE result = 'loss') AS losses,
       MAX(played_at) AS last_played
     FROM game_logs
     WHERE user_id = $1
     GROUP BY deck_id`,
    [userId]
  );

  const statsMap = new Map<string, DeckStats>();
  for (const row of result.rows) {
    const totalGames = Number.parseInt(row.total_games, 10);
    const wins = Number.parseInt(row.wins, 10);
    const losses = Number.parseInt(row.losses, 10);
    const gamesWithResult = wins + losses;
    const winRate = gamesWithResult > 0 ? wins / gamesWithResult : null;
    const lastPlayed = row.last_played
      ? (row.last_played instanceof Date
          ? row.last_played.toISOString().slice(0, 10)
          : new Date(row.last_played).toISOString().slice(0, 10))
      : null;

    statsMap.set(row.deck_id, {
      deckId: row.deck_id,
      totalGames,
      wins,
      losses,
      winRate,
      lastPlayed
    });
  }

  return statsMap;
}
