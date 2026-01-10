import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { executeCardOracle, exampleQueries } from './agents/card-oracle';
import { cacheArchidektDeckFromUrl, fetchArchidektDeckSummary, resetArchidektDeckCache } from './services/deck';
import type { DeckCollectionInput } from './services/deck-collection';
import { listDeckCollection, removeDeckFromCollection, upsertDeckInCollection } from './services/deck-collection';
import { verifyGoogleIdToken, type GoogleUser } from './services/google-auth';
import { getOrCreateConversationId, resetConversation } from './utils/conversation-store';
import { generateChatPdf } from './services/pdf';

dotenv.config();

type AppDeps = {
  executeCardOracle?: typeof executeCardOracle;
  exampleQueries?: string[];
  getOrCreateConversationId?: () => string;
  resetConversation?: (conversationId: string) => boolean;
  cacheArchidektDeckFromUrl?: (deckUrl: string, conversationId: string) => Promise<unknown>;
  resetArchidektDeckCache?: (conversationId: string) => void;
  generateChatPdf?: (input: { title?: string; subtitle?: string; messages: Array<{ role: string; content: string }> }) => Promise<Buffer>;
  verifyGoogleIdToken?: (token: string) => Promise<GoogleUser>;
  fetchArchidektDeckSummary?: (deckUrl: string) => Promise<{ id: string; name: string; format: string | null; url: string; commanderNames: string[]; colorIdentity: string[] }>;
  listDeckCollection?: (userId: string) => Array<{
    id: string;
    name: string;
    format: string | null;
    url: string | null;
    commanderNames: string[];
    colorIdentity: string[] | null;
    source: 'archidekt' | 'manual';
    addedAt: string;
  }>;
  upsertDeckInCollection?: (userId: string, deck: DeckCollectionInput) => Array<{
    id: string;
    name: string;
    format: string | null;
    url: string | null;
    commanderNames: string[];
    colorIdentity: string[] | null;
    source: 'archidekt' | 'manual';
    addedAt: string;
  }>;
  removeDeckFromCollection?: (userId: string, deckId: string) => Array<{
    id: string;
    name: string;
    format: string | null;
    url: string | null;
    commanderNames: string[];
    colorIdentity: string[] | null;
    source: 'archidekt' | 'manual';
    addedAt: string;
  }>;
};

export function createApp(deps: AppDeps = {}) {
  const app = express();
  const execute = deps.executeCardOracle ?? executeCardOracle;
  const examples = deps.exampleQueries ?? exampleQueries;
  const getConversationId = deps.getOrCreateConversationId ?? getOrCreateConversationId;
  const reset = deps.resetConversation ?? resetConversation;
  const cacheDeck = deps.cacheArchidektDeckFromUrl ?? cacheArchidektDeckFromUrl;
  const resetDeckCache = deps.resetArchidektDeckCache ?? resetArchidektDeckCache;
  const exportChatPdf = deps.generateChatPdf ?? generateChatPdf;
  const verifyGoogleToken = deps.verifyGoogleIdToken ?? verifyGoogleIdToken;
  const fetchDeckSummary = deps.fetchArchidektDeckSummary ?? fetchArchidektDeckSummary;
  const listUserDecks = deps.listDeckCollection ?? listDeckCollection;
  const addDeckToCollection = deps.upsertDeckInCollection ?? upsertDeckInCollection;
  const removeDeckFromUser = deps.removeDeckFromCollection ?? removeDeckFromCollection;
  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallback;
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
      return await verifyGoogleToken(token);
    } catch (error: unknown) {
      res.status(401).json({
        success: false,
        error: getErrorMessage(error, 'Invalid Google ID token')
      });
      return null;
    }
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

    const decks = listUserDecks(user.id);
    res.json({ success: true, user, decks });
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
      const decks = addDeckToCollection(user.id, {
        ...summary,
        url: summary.url,
        format: summary.format,
        commanderNames: summary.commanderNames,
        colorIdentity: summary.colorIdentity,
        source: 'archidekt'
      });
      res.json({ success: true, user, decks });
    } catch (error: unknown) {
      res.status(400).json({
        success: false,
        error: getErrorMessage(error, 'Failed to add deck')
      });
    }
  });

  app.post('/api/decks/manual', async (req, res) => {
    const user = await requireGoogleUser(req, res);
    if (!user) return;

    const { name, commanderNames, colorIdentity } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({
        success: false,
        error: 'name is required'
      });
      return;
    }

    const deck: DeckCollectionInput = {
      id: `manual-${crypto.randomUUID()}`,
      name: name.trim(),
      url: null,
      format: null,
      commanderNames: parseCommanderNames(commanderNames),
      colorIdentity: parseColorIdentityInput(colorIdentity),
      source: 'manual'
    };

    const decks = addDeckToCollection(user.id, deck);
    res.json({ success: true, user, decks });
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

    const decks = removeDeckFromUser(user.id, deckId);
    res.json({ success: true, user, decks });
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
