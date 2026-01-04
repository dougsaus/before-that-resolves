import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { executeCardOracle, exampleQueries } from './agents/card-oracle';
import { cacheArchidektDeckFromUrl, resetArchidektDeckCache } from './services/deck';
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
  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallback;
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
