import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { executeCardOracle, exampleQueries } from './agents/card-oracle';
import {
  cacheDeckFromUrl,
  fetchDeckImportCandidates as fetchDeckImportCandidatesService,
  fetchDeckSummary as fetchDeckSummaryService,
  getDeckSourceFromUrl,
  resetDeckCache as resetDeckCacheService
} from './services/deck';
import type { DeckCollectionInput } from './services/deck-collection';
import {
  getUserById,
  listDeckCollection,
  removeDeckFromCollection,
  upsertDeckInCollection,
  upsertUser
} from './services/deck-collection';
import type { DeckStats, GameLogEntry, GameLogInput, GameLogUpdate } from './services/game-logs';
import {
  createGameLog,
  getDeckStats,
  getGameLogById,
  listGameLogs,
  removeGameLog,
  updateGameLog
} from './services/game-logs';
import type { SharedGameLogEntry, SharedGameLogUpdate } from './services/shared-game-logs';
import {
  createSharedGameLog,
  getSharedGameLogById,
  listSharedGameLogs,
  listSharedLogStatuses,
  reopenSharedGameLog,
  setSharedGameLogStatus,
  updateSharedGameLog
} from './services/shared-game-logs';
import type { OpponentUser } from './services/opponents';
import { listRecentOpponents, recordRecentOpponents, searchOpponentUsers } from './services/opponents';
import { verifyGoogleIdToken, type GoogleUser } from './services/google-auth';
import {
  createSession as createSessionService,
  deleteSession as deleteSessionService,
  getSession as getSessionService,
  touchSession as touchSessionService,
  SESSION_COOKIE_NAME
} from './services/session';
import { getOrCreateConversationId, resetConversation } from './utils/conversation-store';
import { normalizeDateInput } from './utils/date';
import { generateChatPdf } from './services/pdf';
import { scryfallService } from './services/scryfall';
import type { Card } from './types/shared';

dotenv.config();

type AppDeps = {
  executeCardOracle?: typeof executeCardOracle;
  exampleQueries?: string[];
  getOrCreateConversationId?: () => string;
  resetConversation?: (conversationId: string) => boolean;
  cacheDeckFromUrl?: (deckUrl: string, conversationId: string) => Promise<unknown>;
  resetDeckCache?: (conversationId: string) => void;
  generateChatPdf?: (input: { title?: string; subtitle?: string; messages: Array<{ role: string; content: string }> }) => Promise<Buffer>;
  verifyGoogleIdToken?: (token: string) => Promise<GoogleUser>;
  fetchDeckSummary?: (deckUrl: string) => Promise<{
    id: string;
    name: string;
    format: string | null;
    url: string;
    commanderNames: string[];
    colorIdentity: string[];
    source: 'archidekt' | 'moxfield';
  }>;
  fetchDeckImportCandidates?: (profileUrl: string) => Promise<Array<{
    id: string;
    name: string;
    format: string | null;
    url: string;
    source: 'archidekt' | 'moxfield';
  }>>;
  searchScryfallCardByName?: (name: string) => Promise<Card | null>;
  listDeckCollection?: (userId: string) => Promise<Array<{
    id: string;
    name: string;
    format: string | null;
    url: string | null;
    commanderNames: string[];
    commanderLinks: Array<string | null>;
    colorIdentity: string[] | null;
    source: 'archidekt' | 'moxfield' | 'manual';
    addedAt: string;
  }>>;
  listOpponentDecks?: (userId: string) => Promise<Array<{
    id: string;
    name: string;
    url: string | null;
    commanderNames: string[];
    commanderLinks: Array<string | null>;
    colorIdentity: string[] | null;
  }>>;
  upsertDeckInCollection?: (userId: string, deck: DeckCollectionInput) => Promise<Array<{
    id: string;
    name: string;
    format: string | null;
    url: string | null;
    commanderNames: string[];
    commanderLinks: Array<string | null>;
    colorIdentity: string[] | null;
    source: 'archidekt' | 'moxfield' | 'manual';
    addedAt: string;
  }>>;
  removeDeckFromCollection?: (userId: string, deckId: string) => Promise<Array<{
    id: string;
    name: string;
    format: string | null;
    url: string | null;
    commanderNames: string[];
    commanderLinks: Array<string | null>;
    colorIdentity: string[] | null;
    source: 'archidekt' | 'moxfield' | 'manual';
    addedAt: string;
  }>>;
  upsertUser?: (user: GoogleUser) => Promise<void>;
  getUserById?: (userId: string) => Promise<GoogleUser | null>;
  createSession?: (userId: string) => Promise<{ sessionId: string; expiresAt: Date }>;
  getSession?: (sessionId: string) => Promise<{ userId: string; expiresAt: Date; lastSeenAt: Date } | null>;
  touchSession?: (sessionId: string) => Promise<Date | null>;
  deleteSession?: (sessionId: string) => Promise<void>;
  listGameLogs?: (userId: string) => Promise<GameLogEntry[]>;
  getGameLogById?: (userId: string, logId: string) => Promise<GameLogEntry | null>;
  createGameLog?: (userId: string, log: GameLogInput) => Promise<GameLogEntry[]>;
  updateGameLog?: (userId: string, logId: string, log: GameLogUpdate) => Promise<GameLogEntry[]>;
  removeGameLog?: (userId: string, logId: string) => Promise<GameLogEntry[]>;
  listSharedGameLogs?: (userId: string) => Promise<SharedGameLogEntry[]>;
  getSharedGameLogById?: (userId: string, logId: string) => Promise<SharedGameLogEntry | null>;
  createSharedGameLog?: (input: {
    recipientUserId: string;
    sharedByUserId: string;
    sourceLogId: string;
    deckId: string | null;
    deckName: string | null;
    deckUrl: string | null;
    playedAt: string;
    turns: number | null;
    durationMinutes: number | null;
    opponentsCount: number;
    opponents: Array<{
      userId: string | null;
      name: string | null;
      email: string | null;
      deckId: string | null;
      deckName: string | null;
      deckUrl: string | null;
      commanderNames: string[];
      commanderLinks: Array<string | null>;
      colorIdentity: string[] | null;
    }>;
    result: 'win' | 'loss' | null;
    tags: string[];
  }) => Promise<boolean>;
  listSharedLogStatuses?: (recipientUserIds: string[], sourceLogId: string) => Promise<Map<string, 'pending' | 'accepted' | 'rejected'>>;
  reopenSharedGameLog?: (input: {
    recipientUserId: string;
    sharedByUserId: string;
    sourceLogId: string;
    deckId: string | null;
    deckName: string | null;
    deckUrl: string | null;
    playedAt: string;
    turns: number | null;
    durationMinutes: number | null;
    opponentsCount: number;
    opponents: Array<{
      userId: string | null;
      name: string | null;
      email: string | null;
      deckId: string | null;
      deckName: string | null;
      deckUrl: string | null;
      commanderNames: string[];
      commanderLinks: Array<string | null>;
      colorIdentity: string[] | null;
    }>;
    result: 'win' | 'loss' | null;
    tags: string[];
  }) => Promise<boolean>;
  updateSharedGameLog?: (
    userId: string,
    logId: string,
    log: SharedGameLogUpdate
  ) => Promise<SharedGameLogEntry | null>;
  setSharedGameLogStatus?: (
    userId: string,
    logId: string,
    status: 'pending' | 'accepted' | 'rejected'
  ) => Promise<boolean>;
  getDeckStats?: (userId: string) => Promise<Map<string, DeckStats>>;
  searchOpponentUsers?: (query: string, limit?: number) => Promise<OpponentUser[]>;
  listRecentOpponents?: (userId: string, limit?: number) => Promise<OpponentUser[]>;
  recordRecentOpponents?: (userId: string, opponentUserIds: string[]) => Promise<void>;
};

export function createApp(deps: AppDeps = {}) {
  const app = express();
  const execute = deps.executeCardOracle ?? executeCardOracle;
  const examples = deps.exampleQueries ?? exampleQueries;
  const getConversationId = deps.getOrCreateConversationId ?? getOrCreateConversationId;
  const reset = deps.resetConversation ?? resetConversation;
  const cacheDeck = deps.cacheDeckFromUrl ?? cacheDeckFromUrl;
  const resetDeckCache = deps.resetDeckCache ?? resetDeckCacheService;
  const exportChatPdf = deps.generateChatPdf ?? generateChatPdf;
  const verifyGoogleToken = deps.verifyGoogleIdToken ?? verifyGoogleIdToken;
  const fetchDeckSummary = deps.fetchDeckSummary ?? fetchDeckSummaryService;
  const fetchDeckImportCandidates = deps.fetchDeckImportCandidates ?? fetchDeckImportCandidatesService;
  const listUserDecks = deps.listDeckCollection ?? listDeckCollection;
  const listOpponentDecks = deps.listOpponentDecks ?? listDeckCollection;
  const addDeckToCollection = deps.upsertDeckInCollection ?? upsertDeckInCollection;
  const removeDeckFromUser = deps.removeDeckFromCollection ?? removeDeckFromCollection;
  const saveUser = deps.upsertUser ?? upsertUser;
  const loadUser = deps.getUserById ?? getUserById;
  const createSession = deps.createSession ?? createSessionService;
  const getSession = deps.getSession ?? getSessionService;
  const touchSession = deps.touchSession ?? touchSessionService;
  const deleteSession = deps.deleteSession ?? deleteSessionService;
  const listLogs = deps.listGameLogs ?? listGameLogs;
  const getLogById = deps.getGameLogById ?? getGameLogById;
  const createLog = deps.createGameLog ?? createGameLog;
  const updateLog = deps.updateGameLog ?? updateGameLog;
  const deleteLog = deps.removeGameLog ?? removeGameLog;
  const listSharedLogs = deps.listSharedGameLogs ?? listSharedGameLogs;
  const getSharedLogById = deps.getSharedGameLogById ?? getSharedGameLogById;
  const createSharedLog = deps.createSharedGameLog ?? createSharedGameLog;
  const listSharedStatuses = deps.listSharedLogStatuses ?? listSharedLogStatuses;
  const reopenSharedLog = deps.reopenSharedGameLog ?? reopenSharedGameLog;
  const updateSharedLog = deps.updateSharedGameLog ?? updateSharedGameLog;
  const setSharedStatus = deps.setSharedGameLogStatus ?? setSharedGameLogStatus;
  const fetchDeckStats = deps.getDeckStats ?? getDeckStats;
  const searchUsers = deps.searchOpponentUsers ?? searchOpponentUsers;
  const listRecent = deps.listRecentOpponents ?? listRecentOpponents;
  const recordRecent = deps.recordRecentOpponents ?? recordRecentOpponents;
  const searchScryfallCardByName =
    deps.searchScryfallCardByName ?? ((name: string) => scryfallService.searchCardByName(name));
  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallback;
  };
  const isProd = process.env.NODE_ENV === 'production';
  const sessionCookieOptions = (expiresAt?: Date) => ({
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
    ...(expiresAt ? { expires: expiresAt } : {})
  });
  const setSessionCookie = (res: express.Response, sessionId: string, expiresAt: Date) => {
    res.cookie(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions(expiresAt));
  };
  const clearSessionCookie = (res: express.Response) => {
    res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
  };
  const parseCookieHeader = (header?: string | null): Record<string, string> => {
    if (!header) return {};
    return header.split(';').reduce<Record<string, string>>((acc, part) => {
      const [rawKey, ...rest] = part.trim().split('=');
      if (!rawKey) return acc;
      const rawValue = rest.join('=');
      if (!rawValue) {
        acc[rawKey] = '';
        return acc;
      }
      try {
        acc[rawKey] = decodeURIComponent(rawValue);
      } catch {
        acc[rawKey] = rawValue;
      }
      return acc;
    }, {});
  };
  const getCookieValue = (req: express.Request, name: string): string | null => {
    const cookies = parseCookieHeader(req.header('cookie'));
    return cookies[name] ?? null;
  };
  const sendAuthError = (res: express.Response, code: 'auth_required' | 'auth_expired' | 'auth_invalid', message: string) => {
    res.status(401).json({ success: false, error: message, code });
  };
  const normalizeDeckUrl = (input: unknown): string | null => {
    if (typeof input !== 'string') return null;
    const trimmed = input.trim();
    return trimmed ? trimmed : null;
  };
  const resolveDeckSource = (input: string | null): 'archidekt' | 'moxfield' | null => {
    return getDeckSourceFromUrl(input);
  };
  const parseCommanderNames = (input: unknown): string[] => {
    if (Array.isArray(input)) {
      return input
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean);
    }
    if (typeof input === 'string') {
      const trimmed = input.trim();
      return trimmed ? [trimmed] : [];
    }
    return [];
  };
  const resolveCommanderEntries = async (
    input: unknown,
    shouldLookup: boolean
  ): Promise<{ commanderNames: string[]; commanderLinks: Array<string | null> }> => {
    const names = parseCommanderNames(input).slice(0, 2);
    if (!shouldLookup || names.length === 0) {
      return { commanderNames: names, commanderLinks: [] };
    }
    const resolved = await Promise.all(
      names.map(async (name) => {
        try {
          const card = await searchScryfallCardByName(name);
          if (card) {
            return { name: card.name || name, link: card.scryfall_uri ?? null };
          }
        } catch (error) {
          console.warn('Scryfall lookup failed for commander:', name, error);
        }
        return { name, link: null };
      })
    );
    return {
      commanderNames: resolved.map((entry) => entry.name),
      commanderLinks: resolved.map((entry) => entry.link)
    };
  };
  const parseColorIdentityInput = (input: unknown): string[] | null => {
    const order = ['W', 'U', 'B', 'R', 'G'];
    if (input === undefined || input === null) {
      return null;
    }
    if (Array.isArray(input)) {
      const colors = input
        .map((value) => (typeof value === 'string' ? value.trim().toUpperCase() : ''))
        .filter((value) => ['W', 'U', 'B', 'R', 'G'].includes(value));
      return Array.from(new Set(colors)).sort((a, b) => order.indexOf(a) - order.indexOf(b));
    }
    if (typeof input === 'string') {
      const normalized = input.trim().toUpperCase();
      if (!normalized) {
        return null;
      }
      if (normalized === 'C' || normalized === 'COLORLESS') {
        return [];
      }
      const colors = normalized
        .split('')
        .filter((value) => ['W', 'U', 'B', 'R', 'G'].includes(value));
      return Array.from(new Set(colors)).sort((a, b) => order.indexOf(a) - order.indexOf(b));
    }
    return [];
  };
  const parseResultInput = (input: unknown): 'win' | 'loss' | null => {
    if (input === undefined || input === null || input === '') {
      return null;
    }
    if (typeof input === 'string') {
      const normalized = input.trim().toLowerCase();
      if (!normalized) {
        return null;
      }
      return normalized === 'win' ? 'win' : normalized === 'loss' ? 'loss' : null;
    }
    return input === true ? 'win' : input === false ? 'loss' : null;
  };
  const parseTagsInput = (input: unknown): string[] => {
    if (!Array.isArray(input)) return [];
    return input
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim());
  };
  const parseDeckIdInput = (input: unknown): string | null => {
    if (typeof input !== 'string') return null;
    const trimmed = input.trim();
    return trimmed ? trimmed : null;
  };
  const parseOptionalNumber = (input: unknown): number | null => {
    if (input === undefined || input === null || input === '') {
      return null;
    }
    const value =
      typeof input === 'number'
        ? input
        : typeof input === 'string'
          ? Number.parseInt(input, 10)
          : Number.NaN;
    if (!Number.isFinite(value)) {
      return null;
    }
    const normalized = Math.floor(value);
    if (normalized <= 0) {
      return null;
    }
    return normalized;
  };
  const parseOpponentEntry = (
    input: unknown
  ): { userId: string | null; email: string | null; deckId: string | null; deckName: string | null; deckUrl: string | null; name: string | null; commanderNames: string[]; commanderLinks: Array<string | null>; colorIdentity: string[] | null } | null => {
    if (!input || typeof input !== 'object') {
      return null;
    }
    const record = input as Record<string, unknown>;
    const userId =
      typeof record.userId === 'string' && record.userId.trim() ? record.userId.trim() : null;
    const email =
      typeof record.email === 'string' && record.email.trim() ? record.email.trim() : null;
    const deckId =
      typeof record.deckId === 'string' && record.deckId.trim() ? record.deckId.trim() : null;
    const deckName =
      typeof record.deckName === 'string' && record.deckName.trim() ? record.deckName.trim() : null;
    const deckUrl =
      typeof record.deckUrl === 'string' && record.deckUrl.trim() ? record.deckUrl.trim() : null;
    const name =
      typeof record.name === 'string' && record.name.trim()
        ? record.name.trim()
        : null;

    // Parse commander names (supports array or comma-separated string)
    let commanderNames: string[] = [];
    if (Array.isArray(record.commanderNames)) {
      commanderNames = record.commanderNames
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim())
        .slice(0, 2);
    } else if (typeof record.commanderNames === 'string' && record.commanderNames.trim()) {
      commanderNames = record.commanderNames
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 2);
    }

    // Parse commander links (parallel array)
    let commanderLinks: Array<string | null> = [];
    if (Array.isArray(record.commanderLinks)) {
      commanderLinks = record.commanderLinks
        .slice(0, commanderNames.length)
        .map((value) => (typeof value === 'string' && value.trim() ? value.trim() : null));
    }
    // Ensure commanderLinks has same length as commanderNames
    while (commanderLinks.length < commanderNames.length) {
      commanderLinks.push(null);
    }

    const rawColorIdentity = record.colorIdentity;
    const hasColorInput =
      typeof rawColorIdentity === 'string'
        ? rawColorIdentity.trim().length > 0
        : Array.isArray(rawColorIdentity)
          ? rawColorIdentity.length > 0
          : false;
    const parsedColorIdentity = hasColorInput ? parseColorIdentityInput(rawColorIdentity) : null;
    if (!userId && !email && !deckId && !deckName && !name && commanderNames.length === 0 && (!parsedColorIdentity || parsedColorIdentity.length === 0)) {
      return null;
    }
    return {
      userId,
      email,
      deckId,
      deckName,
      deckUrl,
      name,
      commanderNames,
      commanderLinks,
      colorIdentity: parsedColorIdentity
    };
  };
  const parseOpponentEntries = (input: unknown) => {
    if (!Array.isArray(input)) {
      return [];
    }
    return input
      .map((entry) => parseOpponentEntry(entry))
      .filter((entry): entry is { userId: string | null; email: string | null; deckId: string | null; deckName: string | null; deckUrl: string | null; name: string | null; commanderNames: string[]; commanderLinks: Array<string | null>; colorIdentity: string[] | null } => Boolean(entry));
  };
  const parseOpponentsCount = (input: unknown, opponents: Array<{ commanderNames: string[] }>) => {
    if (typeof input === 'number' && Number.isFinite(input)) {
      return Math.max(0, Math.floor(input));
    }
    if (typeof input === 'string' && input.trim()) {
      const parsed = Number.parseInt(input, 10);
      if (!Number.isNaN(parsed)) {
        return Math.max(0, parsed);
      }
    }
    return opponents.length;
  };
  const getBearerToken = (authorization?: string | null): string | null => {
    if (!authorization) return null;
    if (!authorization.startsWith('Bearer ')) return null;
    return authorization.slice('Bearer '.length).trim() || null;
  };
  const requireGoogleUser = async (req: express.Request, res: express.Response) => {
    const sessionId = getCookieValue(req, SESSION_COOKIE_NAME);
    if (sessionId) {
      const session = await getSession(sessionId);
      if (!session) {
        clearSessionCookie(res);
        sendAuthError(res, 'auth_required', 'Authentication required.');
        return null;
      }
      if (session.expiresAt.getTime() <= Date.now()) {
        await deleteSession(sessionId);
        clearSessionCookie(res);
        sendAuthError(res, 'auth_expired', 'Session expired. Please sign in again.');
        return null;
      }
      const user = await loadUser(session.userId);
      if (!user) {
        await deleteSession(sessionId);
        clearSessionCookie(res);
        sendAuthError(res, 'auth_required', 'Authentication required.');
        return null;
      }
      const refreshedExpiresAt = await touchSession(sessionId);
      if (refreshedExpiresAt) {
        setSessionCookie(res, sessionId, refreshedExpiresAt);
      }
      return user;
    }

    const token =
      req.header('x-google-id-token') ||
      getBearerToken(req.header('authorization')) ||
      '';
    if (!token) {
      sendAuthError(res, 'auth_required', 'Authentication required.');
      return null;
    }
    try {
      const user = await verifyGoogleToken(token);
      try {
        await saveUser(user);
      } catch (error: unknown) {
        res.status(500).json({
          success: false,
          error: getErrorMessage(error, 'Failed to save user')
        });
        return null;
      }
      try {
        const session = await createSession(user.id);
        setSessionCookie(res, session.sessionId, session.expiresAt);
      } catch (error) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn('Failed to create session from bearer token', error);
        }
      }
      return user;
    } catch (error: unknown) {
      sendAuthError(res, 'auth_invalid', getErrorMessage(error, 'Invalid Google ID token'));
      return null;
    }
  };

  const attachDeckStats = async (
    userId: string,
    decks: Array<{
      id: string;
      name: string;
      format: string | null;
      url: string | null;
      commanderNames: string[];
      commanderLinks: Array<string | null>;
      colorIdentity: string[] | null;
      source: 'archidekt' | 'moxfield' | 'manual';
      addedAt: string;
    }>
  ) => {
    const statsMap = await fetchDeckStats(userId);
    return decks.map((deck) => {
      const stats = statsMap.get(deck.id);
      return {
        ...deck,
        stats: stats
          ? {
              totalGames: stats.totalGames,
              wins: stats.wins,
              losses: stats.losses,
              winRate: stats.winRate,
              lastPlayed: stats.lastPlayed
            }
          : null
      };
    });
  };

  const allowedOrigins = (process.env.CORS_ORIGIN || process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
  });

  app.post('/api/agent/query', async (req, res) => {
    const { query, devMode, conversationId, model, reasoningEffort, verbosity, deckUrl } = req.body;
    const headerKey = req.header('x-openai-key');
    const authorization = req.header('authorization');
    const bearerKey = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : undefined;
    const requestApiKey = headerKey || bearerKey;

    if (!query) {
      res.status(400).json({
        success: false,
        error: 'Query is required'
      });
      return;
    }
    if (!requestApiKey) {
      res.status(401).json({
        success: false,
        error: 'OpenAI API key is required. Provide one in the UI.'
      });
      return;
    }

    try {
      const activeConversationId = conversationId || getConversationId();
      if (deckUrl) {
        try {
          await cacheDeck(deckUrl, activeConversationId);
        } catch (error: unknown) {
          res.status(400).json({
            success: false,
            error: getErrorMessage(error, 'Failed to load deck')
          });
          return;
        }
      }

      console.log(`\n📨 Received query: "${query}" ${devMode ? '(Dev Mode)' : ''}`);

      const result = await execute(
        query,
        devMode || false,
        activeConversationId,
        model,
        reasoningEffort,
        verbosity,
        requestApiKey
      );

      res.json({ ...result, conversationId: activeConversationId });
    } catch (error: unknown) {
      console.error('Server error:', getErrorMessage(error, 'Unknown error'));
      res.status(500).json({
        success: false,
        error: getErrorMessage(error, 'Server error')
      });
    }
  });

  app.post('/api/agent/reset', (req, res) => {
    const { conversationId } = req.body;

    if (!conversationId) {
      res.status(400).json({
        success: false,
        error: 'conversationId is required'
      });
      return;
    }

    const cleared = reset(conversationId);
    resetDeckCache(conversationId);
    res.json({ success: true, cleared });
  });

  app.post('/api/auth/google', async (req, res) => {
    const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken.trim() : '';
    if (!idToken) {
      res.status(400).json({ success: false, error: 'idToken is required' });
      return;
    }
    try {
      const user = await verifyGoogleToken(idToken);
      try {
        await saveUser(user);
      } catch (error: unknown) {
        res.status(500).json({
          success: false,
          error: getErrorMessage(error, 'Failed to save user')
        });
        return;
      }
      try {
        const session = await createSession(user.id);
        setSessionCookie(res, session.sessionId, session.expiresAt);
        res.json({ success: true, user });
      } catch (error: unknown) {
        res.status(500).json({
          success: false,
          error: getErrorMessage(error, 'Failed to create session')
        });
      }
    } catch (error: unknown) {
      res.status(401).json({
        success: false,
        error: getErrorMessage(error, 'Invalid Google ID token'),
        code: 'auth_invalid'
      });
    }
  });

  app.get('/api/auth/me', async (req, res) => {
    const user = await requireGoogleUser(req, res);
    if (!user) return;
    res.json({ success: true, user });
  });

  app.post('/api/auth/logout', async (req, res) => {
    const sessionId = getCookieValue(req, SESSION_COOKIE_NAME);
    if (sessionId) {
      await deleteSession(sessionId);
    }
    clearSessionCookie(res);
    res.json({ success: true });
  });

  app.post('/api/deck/cache', async (req, res) => {
    const { deckUrl, conversationId } = req.body;

    if (!deckUrl) {
      res.status(400).json({
        success: false,
        error: 'deckUrl is required'
      });
      return;
    }

    if (!conversationId) {
      res.status(400).json({
        success: false,
        error: 'conversationId is required'
      });
      return;
    }

    try {
      await cacheDeck(deckUrl, conversationId);
      res.json({ success: true });
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: getErrorMessage(error, 'Failed to cache deck')
      });
    }
  });

  app.get('/api/decks', async (req, res) => {
    const user = await requireGoogleUser(req, res);
    if (!user) return;

    const [decks, statsMap] = await Promise.all([
      listUserDecks(user.id),
      fetchDeckStats(user.id)
    ]);

    const decksWithStats = decks.map((deck) => {
      const stats = statsMap.get(deck.id);
      return {
        ...deck,
        stats: stats
          ? {
              totalGames: stats.totalGames,
              wins: stats.wins,
              losses: stats.losses,
              winRate: stats.winRate,
              lastPlayed: stats.lastPlayed
            }
          : null
      };
    });

    res.json({ success: true, user, decks: decksWithStats });
  });

  app.post('/api/decks', async (req, res) => {
    const user = await requireGoogleUser(req, res);
    if (!user) return;

    const { deckUrl } = req.body;
    if (!deckUrl) {
      res.status(400).json({
        success: false,
        error: 'deckUrl is required'
      });
      return;
    }

    try {
      const summary = await fetchDeckSummary(deckUrl);
      const { commanderNames: resolvedCommanderNames, commanderLinks } = await resolveCommanderEntries(
        summary.commanderNames,
        true
      );
      const decks = await addDeckToCollection(user.id, {
        ...summary,
        url: summary.url,
        format: summary.format,
        commanderNames: resolvedCommanderNames,
        commanderLinks,
        colorIdentity: summary.colorIdentity,
        source: summary.source
      });
      const decksWithStats = await attachDeckStats(user.id, decks);
      res.json({ success: true, user, decks: decksWithStats });
    } catch (error: unknown) {
      res.status(400).json({
        success: false,
        error: getErrorMessage(error, 'Failed to add deck')
      });
    }
  });

  app.post('/api/decks/preview', async (req, res) => {
    const user = await requireGoogleUser(req, res);
    if (!user) return;

    const { deckUrl } = req.body;
    if (!deckUrl) {
      res.status(400).json({
        success: false,
        error: 'deckUrl is required'
      });
      return;
    }

    try {
      const summary = await fetchDeckSummary(deckUrl);
      res.json({ success: true, deck: summary });
    } catch (error: unknown) {
      res.status(400).json({
        success: false,
        error: getErrorMessage(error, 'Failed to load deck')
      });
    }
  });

  app.post('/api/decks/bulk/preview', async (req, res) => {
    const user = await requireGoogleUser(req, res);
    if (!user) return;

    const { profileUrl } = req.body;
    if (!profileUrl || typeof profileUrl !== 'string' || !profileUrl.trim()) {
      res.status(400).json({
        success: false,
        error: 'profileUrl is required'
      });
      return;
    }

    try {
      const decks = await fetchDeckImportCandidates(profileUrl);
      res.json({ success: true, decks });
    } catch (error: unknown) {
      res.status(400).json({
        success: false,
        error: getErrorMessage(error, 'Failed to load decks')
      });
    }
  });

  app.post('/api/decks/bulk', async (req, res) => {
    const user = await requireGoogleUser(req, res);
    if (!user) return;

    const { deckUrls } = req.body;
    if (!Array.isArray(deckUrls) || deckUrls.length === 0) {
      res.status(400).json({
        success: false,
        error: 'deckUrls is required'
      });
      return;
    }

    const normalizedUrls = deckUrls
      .filter((value) => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean);
    if (normalizedUrls.length === 0) {
      res.status(400).json({
        success: false,
        error: 'deckUrls is required'
      });
      return;
    }

    const failures: Array<{ deckUrl: string; error: string }> = [];
    for (const deckUrl of normalizedUrls) {
      try {
        const summary = await fetchDeckSummary(deckUrl);
        const { commanderNames: resolvedCommanderNames, commanderLinks } = await resolveCommanderEntries(
          summary.commanderNames,
          true
        );
        await addDeckToCollection(user.id, {
          ...summary,
          url: summary.url,
          format: summary.format,
          commanderNames: resolvedCommanderNames,
          commanderLinks,
          colorIdentity: summary.colorIdentity,
          source: summary.source
        });
      } catch (error: unknown) {
        failures.push({
          deckUrl,
          error: getErrorMessage(error, 'Failed to import deck')
        });
      }
    }

    const decks = await listUserDecks(user.id);
    const decksWithStats = await attachDeckStats(user.id, decks);
    res.json({ success: true, decks: decksWithStats, failures });
  });

  app.post('/api/scryfall/lookup', async (req, res) => {
    const user = await requireGoogleUser(req, res);
    if (!user) return;

    const { name } = req.body ?? {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({
        success: false,
        error: 'name is required'
      });
      return;
    }

    try {
      const card = await searchScryfallCardByName(name.trim());
      res.json({
        success: true,
        card: card
          ? {
              name: card.name,
              scryfallUrl: card.scryfall_uri ?? null
            }
          : null
      });
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: getErrorMessage(error, 'Failed to lookup card')
      });
    }
  });

  app.post('/api/decks/manual', async (req, res) => {
    const user = await requireGoogleUser(req, res);
    if (!user) return;

    const { deckId, name, commanderNames, colorIdentity, url } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({
        success: false,
        error: 'name is required'
      });
      return;
    }

    const normalizedUrl = normalizeDeckUrl(url);
    const source = resolveDeckSource(normalizedUrl) ?? 'manual';
    const { commanderNames: resolvedCommanderNames, commanderLinks } = await resolveCommanderEntries(
      commanderNames,
      true
    );
    const deck: DeckCollectionInput = {
      id: typeof deckId === 'string' && deckId.trim() ? deckId.trim() : `manual-${crypto.randomUUID()}`,
      name: name.trim(),
      url: normalizedUrl,
      format: null,
      commanderNames: resolvedCommanderNames,
      commanderLinks,
      colorIdentity: parseColorIdentityInput(colorIdentity),
      source
    };

    const decks = await addDeckToCollection(user.id, deck);
    const decksWithStats = await attachDeckStats(user.id, decks);
    res.json({ success: true, user, decks: decksWithStats });
  });

  app.put('/api/decks/:deckId', async (req, res) => {
    const user = await requireGoogleUser(req, res);
    if (!user) return;

    const { deckId } = req.params;
    if (!deckId) {
      res.status(400).json({
        success: false,
        error: 'deckId is required'
      });
      return;
    }

    const { name, commanderNames, colorIdentity, url } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({
        success: false,
        error: 'name is required'
      });
      return;
    }

    const normalizedUrl = normalizeDeckUrl(url);
    const source = resolveDeckSource(normalizedUrl) ?? 'manual';
    const { commanderNames: resolvedCommanderNames, commanderLinks } = await resolveCommanderEntries(
      commanderNames,
      true
    );
    const deck: DeckCollectionInput = {
      id: deckId,
      name: name.trim(),
      url: normalizedUrl,
      format: null,
      commanderNames: resolvedCommanderNames,
      commanderLinks,
      colorIdentity: parseColorIdentityInput(colorIdentity),
      source
    };

    const decks = await addDeckToCollection(user.id, deck);
    const decksWithStats = await attachDeckStats(user.id, decks);
    res.json({ success: true, user, decks: decksWithStats });
  });

  app.delete('/api/decks/:deckId', async (req, res) => {
    const user = await requireGoogleUser(req, res);
    if (!user) return;

    const { deckId } = req.params;
    if (!deckId) {
      res.status(400).json({
        success: false,
        error: 'deckId is required'
      });
      return;
    }

    const decks = await removeDeckFromUser(user.id, deckId);
    const decksWithStats = await attachDeckStats(user.id, decks);
    res.json({ success: true, user, decks: decksWithStats });
  });

  app.get('/api/game-logs', async (req, res) => {
    const user = await requireGoogleUser(req, res);
    if (!user) return;

    const logs = await listLogs(user.id);
    res.json({ success: true, logs });
  });

  app.get('/api/game-logs/shared', async (req, res) => {
    const user = await requireGoogleUser(req, res);
    if (!user) return;

    const sharedLogs = await listSharedLogs(user.id);
    res.json({ success: true, sharedLogs });
  });

  app.get('/api/users/search', async (req, res) => {
    const user = await requireGoogleUser(req, res);
    if (!user) return;

    const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    if (!query) {
      res.status(400).json({
        success: false,
        error: 'query is required'
      });
      return;
    }

    const results = await searchUsers(query, 10);
    res.json({ success: true, users: results });
  });

  app.get('/api/opponents/recent', async (req, res) => {
    const user = await requireGoogleUser(req, res);
    if (!user) return;

    const opponents = await listRecent(user.id, 10);
    res.json({ success: true, opponents });
  });

  app.get('/api/opponents/:userId/decks', async (req, res) => {
    const user = await requireGoogleUser(req, res);
    if (!user) return;

    const { userId } = req.params;
    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'userId is required'
      });
      return;
    }

    const decks = await listOpponentDecks(userId);
    const opponentDecks = decks.map((deck) => ({
      id: deck.id,
      name: deck.name,
      url: deck.url ?? null,
      commanderNames: deck.commanderNames,
      commanderLinks: deck.commanderLinks,
      colorIdentity: deck.colorIdentity ?? null
    }));
    res.json({ success: true, decks: opponentDecks });
  });

  app.post('/api/game-logs/:logId/share', async (req, res) => {
    const user = await requireGoogleUser(req, res);
    if (!user) return;

    const { logId } = req.params;
    if (!logId) {
      res.status(400).json({
        success: false,
        error: 'logId is required'
      });
      return;
    }

    const log = await getLogById(user.id, logId);
    if (!log) {
      res.status(404).json({
        success: false,
        error: 'Game log not found'
      });
      return;
    }

    const recipientIds = Array.from(
      new Set(
        log.opponents
          .map((opponent) => opponent.userId)
          .filter((value): value is string => Boolean(value))
      )
    );
    if (recipientIds.length === 0) {
      res.json({
        success: true,
        sharedCount: 0,
        skippedCount: 0,
        acceptedCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        nonUserCount: log.opponents.filter((opponent) => !opponent.userId).length,
        opponents: []
      });
      return;
    }

    const decks = await listUserDecks(user.id);
    const deck = decks.find((entry) => entry.id === log.deckId) ?? null;
    const sharingOpponent = {
      userId: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
      deckId: deck?.id ?? log.deckId,
      deckName: deck?.name ?? log.deckName,
      deckUrl: deck?.url ?? null,
      commanderNames: deck?.commanderNames ?? [],
      commanderLinks: deck?.commanderLinks ?? [],
      colorIdentity: deck?.colorIdentity ?? null
    };
    const sharedResult: 'win' | 'loss' | null = log.result === 'win' ? 'loss' : null;

    const confirmReshare =
      typeof req.body?.confirmReshare === 'boolean' ? req.body.confirmReshare : false;
    const reshareRecipientIds = Array.isArray(req.body?.reshareRecipientIds)
      ? req.body.reshareRecipientIds.filter((value: unknown): value is string => typeof value === 'string')
      : null;
    const statusByRecipient = await listSharedStatuses(recipientIds, log.id);
    const rejectedRecipients = recipientIds.filter(
      (recipientId) => statusByRecipient.get(recipientId) === 'rejected'
    );
    const acceptedCount = recipientIds.filter(
      (recipientId) => statusByRecipient.get(recipientId) === 'accepted'
    ).length;
    const pendingCount = recipientIds.filter(
      (recipientId) => statusByRecipient.get(recipientId) === 'pending'
    ).length;
    const nonUserCount = log.opponents.filter((opponent) => !opponent.userId).length;
    let sharedCount = 0;
    let reopenedCount = 0;
    let skippedCount = 0;
    for (const recipientId of recipientIds) {
      const status = statusByRecipient.get(recipientId);
      if (status === 'accepted' || status === 'pending') {
        skippedCount += 1;
        continue;
      }
      if (status === 'rejected' && !confirmReshare) {
        skippedCount += 1;
        continue;
      }
      if (status === 'rejected' && confirmReshare && reshareRecipientIds && !reshareRecipientIds.includes(recipientId)) {
        skippedCount += 1;
        continue;
      }
      const recipientOpponent = log.opponents.find((opponent) => opponent.userId === recipientId);
      const sharedOpponents = log.opponents.filter((opponent) => opponent.userId !== recipientId);
      sharedOpponents.push(sharingOpponent);

      const input = {
        recipientUserId: recipientId,
        sharedByUserId: user.id,
        sourceLogId: log.id,
        deckId: recipientOpponent?.deckId ?? null,
        deckName: recipientOpponent?.deckName ?? null,
        deckUrl: recipientOpponent?.deckUrl ?? null,
        playedAt: log.playedAt,
        turns: log.turns,
        durationMinutes: log.durationMinutes,
        opponentsCount: sharedOpponents.length,
        opponents: sharedOpponents,
        result: sharedResult,
        tags: [] as string[]
      };
      if (status === 'rejected') {
        const reopened = await reopenSharedLog(input);
        if (reopened) {
          reopenedCount += 1;
        } else {
          skippedCount += 1;
        }
        continue;
      }
      const inserted = await createSharedLog(input);
      if (inserted) {
        sharedCount += 1;
      } else {
        skippedCount += 1;
      }
    }

    const finalPendingCount = pendingCount + sharedCount + reopenedCount;
    const finalRejectedCount = Math.max(0, rejectedRecipients.length - reopenedCount);
    res.json({
      success: true,
      sharedCount,
      reopenedCount,
      skippedCount,
      needsConfirm: rejectedRecipients.length > 0 && !confirmReshare,
      rejectedCount: finalRejectedCount,
      acceptedCount,
      pendingCount: finalPendingCount,
      nonUserCount,
      opponents: log.opponents
        .filter((opponent) => opponent.userId)
        .map((opponent) => ({
          userId: opponent.userId as string,
          name: opponent.name ?? null,
          status: statusByRecipient.get(opponent.userId as string) ?? null
        }))
    });
  });

  app.post('/api/game-logs', async (req, res) => {
    const user = await requireGoogleUser(req, res);
    if (!user) return;

    const {
      deckId,
      datePlayed,
      opponentsCount,
      opponents,
      result,
      turns,
      durationMinutes,
      tags
    } = req.body ?? {};
    if (!deckId || typeof deckId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'deckId is required'
      });
      return;
    }

    const decks = await listUserDecks(user.id);
    const deck = decks.find((entry) => entry.id === deckId);
    if (!deck) {
      res.status(400).json({
        success: false,
        error: 'Deck not found in your collection'
      });
      return;
    }

    const parsedOpponents = parseOpponentEntries(opponents);
    const normalizedOpponentsCount = parseOpponentsCount(opponentsCount, parsedOpponents);
    const logInput: GameLogInput = {
      deckId: deck.id,
      deckName: deck.name,
      playedAt: normalizeDateInput(datePlayed),
      turns: parseOptionalNumber(turns),
      durationMinutes: parseOptionalNumber(durationMinutes),
      opponentsCount: normalizedOpponentsCount,
      opponents: parsedOpponents,
      result: parseResultInput(result),
      tags: parseTagsInput(tags)
    };

    const logs = await createLog(user.id, logInput);
    const opponentUserIds = parsedOpponents
      .map((opponent) => opponent.userId)
      .filter((value): value is string => Boolean(value));
    if (opponentUserIds.length > 0) {
      await recordRecent(user.id, opponentUserIds);
    }
    res.json({ success: true, logs });
  });

  app.patch('/api/game-logs/:logId', async (req, res) => {
    const user = await requireGoogleUser(req, res);
    if (!user) return;

    const { logId } = req.params;
    if (!logId) {
      res.status(400).json({
        success: false,
        error: 'logId is required'
      });
      return;
    }

    const { datePlayed, opponentsCount, opponents, result, turns, durationMinutes, tags } =
      req.body ?? {};
    const parsedOpponents = parseOpponentEntries(opponents);
    const normalizedOpponentsCount = parseOpponentsCount(opponentsCount, parsedOpponents);
    const logUpdate: GameLogUpdate = {
      playedAt: normalizeDateInput(datePlayed),
      turns: parseOptionalNumber(turns),
      durationMinutes: parseOptionalNumber(durationMinutes),
      opponentsCount: normalizedOpponentsCount,
      opponents: parsedOpponents,
      result: parseResultInput(result),
      tags: parseTagsInput(tags)
    };

    const logs = await updateLog(user.id, logId, logUpdate);
    const opponentUserIds = parsedOpponents
      .map((opponent) => opponent.userId)
      .filter((value): value is string => Boolean(value));
    if (opponentUserIds.length > 0) {
      await recordRecent(user.id, opponentUserIds);
    }
    res.json({ success: true, logs });
  });

  app.delete('/api/game-logs/:logId', async (req, res) => {
    const user = await requireGoogleUser(req, res);
    if (!user) return;

    const { logId } = req.params;
    if (!logId) {
      res.status(400).json({
        success: false,
        error: 'logId is required'
      });
      return;
    }

    const logs = await deleteLog(user.id, logId);
    res.json({ success: true, logs });
  });

  app.patch('/api/game-logs/shared/:logId', async (req, res) => {
    const user = await requireGoogleUser(req, res);
    if (!user) return;

    const { logId } = req.params;
    if (!logId) {
      res.status(400).json({
        success: false,
        error: 'logId is required'
      });
      return;
    }

    const {
      deckId,
      datePlayed,
      opponentsCount,
      opponents,
      result,
      turns,
      durationMinutes,
      tags
    } = req.body ?? {};
    const parsedDeckId = parseDeckIdInput(deckId);
    const decks = parsedDeckId ? await listUserDecks(user.id) : [];
    const selectedDeck = parsedDeckId ? decks.find((deck) => deck.id === parsedDeckId) ?? null : null;
    if (parsedDeckId && !selectedDeck) {
      res.status(400).json({
        success: false,
        error: 'Deck not found in your collection'
      });
      return;
    }

    const parsedOpponents = parseOpponentEntries(opponents);
    const normalizedOpponentsCount = parseOpponentsCount(opponentsCount, parsedOpponents);
    const logUpdate: SharedGameLogUpdate = {
      deckId: parsedDeckId,
      deckName: selectedDeck?.name ?? null,
      deckUrl: selectedDeck?.url ?? null,
      playedAt: normalizeDateInput(datePlayed),
      turns: parseOptionalNumber(turns),
      durationMinutes: parseOptionalNumber(durationMinutes),
      opponentsCount: normalizedOpponentsCount,
      opponents: parsedOpponents,
      result: parseResultInput(result),
      tags: parseTagsInput(tags)
    };

    const updated = await updateSharedLog(user.id, logId, logUpdate);
    if (!updated) {
      res.status(404).json({
        success: false,
        error: 'Shared game log not found'
      });
      return;
    }

    const opponentUserIds = parsedOpponents
      .map((opponent) => opponent.userId)
      .filter((value): value is string => Boolean(value));
    if (opponentUserIds.length > 0) {
      await recordRecent(user.id, opponentUserIds);
    }

    const sharedLogs = await listSharedLogs(user.id);
    res.json({ success: true, sharedLogs });
  });

  app.post('/api/game-logs/shared/:logId/accept', async (req, res) => {
    const user = await requireGoogleUser(req, res);
    if (!user) return;

    const { logId } = req.params;
    if (!logId) {
      res.status(400).json({
        success: false,
        error: 'logId is required'
      });
      return;
    }

    const sharedLog = await getSharedLogById(user.id, logId);
    if (!sharedLog || sharedLog.status !== 'pending') {
      res.status(404).json({
        success: false,
        error: 'Shared game log not found'
      });
      return;
    }

    if (!sharedLog.deckId) {
      res.status(400).json({
        success: false,
        error: 'Select a deck before accepting this shared log'
      });
      return;
    }

    const decks = await listUserDecks(user.id);
    const deck = decks.find((entry) => entry.id === sharedLog.deckId);
    if (!deck) {
      res.status(400).json({
        success: false,
        error: 'Deck not found in your collection'
      });
      return;
    }

    await createLog(user.id, {
      deckId: deck.id,
      deckName: deck.name,
      playedAt: sharedLog.playedAt,
      turns: sharedLog.turns,
      durationMinutes: sharedLog.durationMinutes,
      opponentsCount: sharedLog.opponentsCount,
      opponents: sharedLog.opponents,
      result: sharedLog.result,
      tags: sharedLog.tags
    });

    const opponentUserIds = sharedLog.opponents
      .map((opponent) => opponent.userId)
      .filter((value): value is string => Boolean(value));
    if (opponentUserIds.length > 0) {
      await recordRecent(user.id, opponentUserIds);
    }

    await setSharedStatus(user.id, logId, 'accepted');
    const sharedLogs = await listSharedLogs(user.id);
    res.json({ success: true, sharedLogs });
  });

  app.post('/api/game-logs/shared/:logId/reject', async (req, res) => {
    const user = await requireGoogleUser(req, res);
    if (!user) return;

    const { logId } = req.params;
    if (!logId) {
      res.status(400).json({
        success: false,
        error: 'logId is required'
      });
      return;
    }

    const updated = await setSharedStatus(user.id, logId, 'rejected');
    if (!updated) {
      res.status(404).json({
        success: false,
        error: 'Shared game log not found'
      });
      return;
    }

    const sharedLogs = await listSharedLogs(user.id);
    res.json({ success: true, sharedLogs });
  });

  app.post('/api/chat/export-pdf', async (req, res) => {
    const { messages, title, subtitle, deckUrl } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({
        success: false,
        error: 'messages are required'
      });
      return;
    }

    const normalizedMessages = messages
      .filter((message) => message && typeof message.content === 'string')
      .map((message) => {
        const role = message.role;
        const normalizedRole =
          role === 'user' || role === 'agent' || role === 'error' ? role : 'agent';
        return {
          role: normalizedRole,
          content: message.content
        };
      });

    if (normalizedMessages.length === 0) {
      res.status(400).json({
        success: false,
        error: 'messages are required'
      });
      return;
    }

    try {
      const pdfBuffer = await exportChatPdf({
        title,
        subtitle,
        deckUrl,
        messages: normalizedMessages
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="before-that-resolves-chat.pdf"');
      res.send(pdfBuffer);
    } catch (error: unknown) {
      console.error('PDF export error:', getErrorMessage(error, 'Unknown error'));
      res.status(500).json({
        success: false,
        error: getErrorMessage(error, 'Failed to generate PDF')
      });
    }
  });

  app.get('/api/examples', (_req, res) => {
    res.json({
      examples,
      description: 'Try these example queries to test the Card Oracle Agent!'
    });
  });

  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  const clientIndexPath = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(clientIndexPath)) {
    app.use(express.static(clientDistPath));
    app.get(/^\/(?!api(?:\/|$))(?!health(?:\/|$)).*/, (_req, res) => {
      res.sendFile(clientIndexPath);
    });
  }

  return app;
}
