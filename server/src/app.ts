import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { executeCardOracle, exampleQueries } from './agents/card-oracle';
import { cacheDeckFromUrl, fetchDeckSummary as fetchDeckSummaryService, getDeckSourceFromUrl, resetDeckCache as resetDeckCacheService } from './services/deck';
import type { DeckCollectionInput } from './services/deck-collection';
import {
  listDeckCollection,
  removeDeckFromCollection,
  upsertDeckInCollection,
  upsertUser
} from './services/deck-collection';
import type { DeckStats, GameLogEntry, GameLogInput, GameLogUpdate } from './services/game-logs';
import { createGameLog, getDeckStats, listGameLogs, removeGameLog, updateGameLog } from './services/game-logs';
import { verifyGoogleIdToken, type GoogleUser } from './services/google-auth';
import { getOrCreateConversationId, resetConversation } from './utils/conversation-store';
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
  listGameLogs?: (userId: string) => Promise<GameLogEntry[]>;
  createGameLog?: (userId: string, log: GameLogInput) => Promise<GameLogEntry[]>;
  updateGameLog?: (userId: string, logId: string, log: GameLogUpdate) => Promise<GameLogEntry[]>;
  removeGameLog?: (userId: string, logId: string) => Promise<GameLogEntry[]>;
  getDeckStats?: (userId: string) => Promise<Map<string, DeckStats>>;
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
  const listUserDecks = deps.listDeckCollection ?? listDeckCollection;
  const addDeckToCollection = deps.upsertDeckInCollection ?? upsertDeckInCollection;
  const removeDeckFromUser = deps.removeDeckFromCollection ?? removeDeckFromCollection;
  const saveUser = deps.upsertUser ?? upsertUser;
  const listLogs = deps.listGameLogs ?? listGameLogs;
  const createLog = deps.createGameLog ?? createGameLog;
  const updateLog = deps.updateGameLog ?? updateGameLog;
  const deleteLog = deps.removeGameLog ?? removeGameLog;
  const fetchDeckStats = deps.getDeckStats ?? getDeckStats;
  const searchScryfallCardByName =
    deps.searchScryfallCardByName ?? ((name: string) => scryfallService.searchCardByName(name));
  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallback;
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
      return input
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
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
  const normalizeDateInput = (input: unknown): string => {
    if (input instanceof Date) {
      return input.toISOString().slice(0, 10);
    }
    if (typeof input === 'string') {
      const parsed = new Date(input);
      if (!Number.isNaN(parsed.valueOf())) {
        return parsed.toISOString().slice(0, 10);
      }
    }
    return new Date().toISOString().slice(0, 10);
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
  ): { name: string | null; commander: string | null; colorIdentity: string[] | null } | null => {
    if (!input || typeof input !== 'object') {
      return null;
    }
    const record = input as Record<string, unknown>;
    const name =
      typeof record.name === 'string' && record.name.trim()
        ? record.name.trim()
        : null;
    const commander =
      typeof record.commander === 'string' && record.commander.trim()
        ? record.commander.trim()
        : null;
    const rawColorIdentity = record.colorIdentity;
    const hasColorInput =
      typeof rawColorIdentity === 'string'
        ? rawColorIdentity.trim().length > 0
        : Array.isArray(rawColorIdentity)
          ? rawColorIdentity.length > 0
          : false;
    const parsedColorIdentity = hasColorInput ? parseColorIdentityInput(rawColorIdentity) : null;
    if (!name && !commander && (!parsedColorIdentity || parsedColorIdentity.length === 0)) {
      return null;
    }
    return {
      name,
      commander,
      colorIdentity: parsedColorIdentity
    };
  };
  const parseOpponentEntries = (input: unknown) => {
    if (!Array.isArray(input)) {
      return [];
    }
    return input
      .map((entry) => parseOpponentEntry(entry))
      .filter((entry): entry is { name: string | null; commander: string | null; colorIdentity: string[] | null } => Boolean(entry));
  };
  const parseOpponentsCount = (input: unknown, opponents: Array<{ commander: string | null }>) => {
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
    const token =
      req.header('x-google-id-token') ||
      getBearerToken(req.header('authorization')) ||
      '';
    if (!token) {
      res.status(401).json({ success: false, error: 'Google ID token is required.' });
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
      return user;
    } catch (error: unknown) {
      res.status(401).json({
        success: false,
        error: getErrorMessage(error, 'Invalid Google ID token')
      });
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

  app.use(cors());
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
      durationMinutes
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
      result: parseResultInput(result)
    };

    const logs = await createLog(user.id, logInput);
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

    const { datePlayed, opponentsCount, opponents, result, turns, durationMinutes } =
      req.body ?? {};
    const parsedOpponents = parseOpponentEntries(opponents);
    const normalizedOpponentsCount = parseOpponentsCount(opponentsCount, parsedOpponents);
    const logUpdate: GameLogUpdate = {
      playedAt: normalizeDateInput(datePlayed),
      turns: parseOptionalNumber(turns),
      durationMinutes: parseOptionalNumber(durationMinutes),
      opponentsCount: normalizedOpponentsCount,
      opponents: parsedOpponents,
      result: parseResultInput(result)
    };

    const logs = await updateLog(user.id, logId, logUpdate);
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
