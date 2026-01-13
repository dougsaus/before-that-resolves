import { describe, expect, it } from 'vitest';
import { run } from '@openai/agents';
import { executeCardOracle } from '../agents/card-oracle';
import { createGoldfishAgent } from '../agents/goldfish';
import { buildArchidektDeckData, cacheDeckFromUrl } from '../services/deck';
import { countToolCalls, extractResponseText } from '../utils/agent-helpers';
import { getOrCreateConversationId } from '../utils/conversation-store';

const liveEnabled = process.env.RUN_LIVE_TESTS === '1';
const openAiKey = process.env.OPENAI_API_KEY;
const hasOpenAIKey = Boolean(openAiKey);

const describeLive = liveEnabled && hasOpenAIKey ? describe : describe.skip;

describeLive('live integrations', () => {
  it(
    'loads an Archidekt deck from the live API',
    async () => {
      const conversationId = getOrCreateConversationId();
      const raw = await cacheDeckFromUrl(
        'https://archidekt.com/decks/17352990/the_world_is_a_vampire',
        conversationId
      );
      const deck = buildArchidektDeckData(
        raw,
        'https://archidekt.com/decks/17352990/the_world_is_a_vampire'
      );
      expect(deck.source).toBe('archidekt');
      expect(deck.cards.length).toBeGreaterThan(0);
    },
    30000
  );

  it(
    'runs the agent with OpenAI conversation memory',
    async () => {
      const conversationId = getOrCreateConversationId();
      const first = await executeCardOracle('What is Sol Ring?', false, conversationId, undefined, undefined, undefined, openAiKey);
      expect(first.success).toBe(true);

      const followUp = await executeCardOracle(
        'Summarize the previous answer in one sentence.',
        false,
        conversationId,
        undefined,
        undefined,
        undefined,
        openAiKey
      );
      expect(followUp.success).toBe(true);
      expect(followUp.response).toBeTypeOf('string');
      expect(followUp.response?.length).toBeGreaterThan(0);
    },
    60000
  );

  it(
    'runs the goldfish agent tool chain against a live model',
    async () => {
      const conversationId = getOrCreateConversationId();
      const agent = createGoldfishAgent(undefined, undefined, undefined, conversationId);
      const prompt = [
        'Goldfish this Commander deck using the goldfish tools only:',
        'https://archidekt.com/decks/17352990/the_world_is_a_vampire',
        'Steps: load the deck, reset with seed 1, draw 7.',
        'Reply with a short summary of the zones.'
      ].join(' ');

      const result = await run(agent, [{ role: 'user', content: prompt }]);
      expect(countToolCalls(result)).toBeGreaterThan(0);

      const response = extractResponseText(result) || '';
      expect(response.length).toBeGreaterThan(0);
    },
    60000
  );
});
