import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { executeCardOracle, exampleQueries } from './agents/card-oracle';
import { getEnvOpenAIKey } from './config/openai';
import { cacheArchidektDeckFromUrl } from './services/deck';
import { getOrCreateConversationId, resetConversation } from './utils/conversation-store';
import { generateChatPdf } from './services/pdf';

dotenv.config();

type AppDeps = {
  executeCardOracle?: typeof executeCardOracle;
  exampleQueries?: string[];
  getOrCreateConversationId?: () => string;
  resetConversation?: (conversationId: string) => boolean;
  cacheArchidektDeckFromUrl?: (deckUrl: string) => Promise<any>;
  generateChatPdf?: (input: { title?: string; subtitle?: string; messages: Array<{ role: string; content: string }> }) => Promise<Buffer>;
};

export function createApp(deps: AppDeps = {}) {
  const app = express();
  const execute = deps.executeCardOracle ?? executeCardOracle;
  const examples = deps.exampleQueries ?? exampleQueries;
  const getConversationId = deps.getOrCreateConversationId ?? getOrCreateConversationId;
  const reset = deps.resetConversation ?? resetConversation;
  const cacheDeck = deps.cacheArchidektDeckFromUrl ?? cacheArchidektDeckFromUrl;
  const exportChatPdf = deps.generateChatPdf ?? generateChatPdf;

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
  });

  app.post('/api/agent/query', async (req, res) => {
    const { query, devMode, conversationId, model, reasoningEffort, verbosity } = req.body;
    const headerKey = req.header('x-openai-key');
    const authorization = req.header('authorization');
    const bearerKey = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : undefined;
    const requestApiKey = headerKey || bearerKey;
    const envApiKey = getEnvOpenAIKey();

    if (!query) {
      res.status(400).json({
        success: false,
        error: 'Query is required'
      });
      return;
    }
    if (!requestApiKey && !envApiKey) {
      res.status(401).json({
        success: false,
        error: 'OpenAI API key is required. Provide one in the UI or set OPENAI_API_KEY.'
      });
      return;
    }

    try {
      console.log(`\n📨 Received query: "${query}" ${devMode ? '(Dev Mode)' : ''}`);
      const activeConversationId = conversationId || getConversationId();

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
    } catch (error: any) {
      console.error('Server error:', error?.message || 'Unknown error');
      res.status(500).json({
        success: false,
        error: error?.message || 'Server error'
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
    res.json({ success: true, cleared });
  });

  app.post('/api/deck/cache', async (req, res) => {
    const { deckUrl } = req.body;

    if (!deckUrl) {
      res.status(400).json({
        success: false,
        error: 'deckUrl is required'
      });
      return;
    }

    try {
      await cacheDeck(deckUrl);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
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
    } catch (error: any) {
      console.error('PDF export error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate PDF'
      });
    }
  });

  app.get('/api/examples', (_req, res) => {
    res.json({
      examples,
      description: 'Try these example queries to test the Card Oracle Agent!'
    });
  });

  return app;
}
