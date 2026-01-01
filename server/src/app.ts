import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { executeCardOracle, exampleQueries } from './agents/card-oracle';
import { cacheArchidektDeckFromUrl } from './services/deck';
import { getOrCreateConversationId, resetConversation } from './utils/conversation-store';

dotenv.config();

type AppDeps = {
  executeCardOracle?: typeof executeCardOracle;
  exampleQueries?: string[];
  getOrCreateConversationId?: () => string;
  resetConversation?: (conversationId: string) => boolean;
  cacheArchidektDeckFromUrl?: (deckUrl: string) => Promise<any>;
};

export function createApp(deps: AppDeps = {}) {
  const app = express();
  const execute = deps.executeCardOracle ?? executeCardOracle;
  const examples = deps.exampleQueries ?? exampleQueries;
  const getConversationId = deps.getOrCreateConversationId ?? getOrCreateConversationId;
  const reset = deps.resetConversation ?? resetConversation;
  const cacheDeck = deps.cacheArchidektDeckFromUrl ?? cacheArchidektDeckFromUrl;

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
  });

  app.post('/api/agent/query', async (req, res) => {
    const { query, devMode, conversationId, model, reasoningEffort, verbosity } = req.body;

    if (!query) {
      res.status(400).json({
        success: false,
        error: 'Query is required'
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
        verbosity
      );

      res.json({ ...result, conversationId: activeConversationId });
    } catch (error: any) {
      console.error('Server error:', error);
      res.status(500).json({
        success: false,
        error: error.message
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

  app.get('/api/examples', (_req, res) => {
    res.json({
      examples,
      description: 'Try these example queries to test the Card Oracle Agent!'
    });
  });

  return app;
}
