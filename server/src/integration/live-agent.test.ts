import { describe, expect, it } from 'vitest';
import { executeCardOracle } from '../agents/card-oracle-agent';
import { fetchArchidektDeck } from '../services/deck';
import { getOrCreateConversationId } from '../utils/conversation-store';

const liveEnabled = process.env.RUN_LIVE_TESTS === '1';
const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);

const describeLive = liveEnabled && hasOpenAIKey ? describe : describe.skip;

describeLive('live integrations', () => {
  it(
    'loads an Archidekt deck from the live API',
    async () => {
      const deck = await fetchArchidektDeck(
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
      const first = await executeCardOracle('What is Sol Ring?', false, conversationId);
      expect(first.success).toBe(true);

      const followUp = await executeCardOracle(
        'Summarize the previous answer in one sentence.',
        false,
        conversationId
      );
      expect(followUp.success).toBe(true);
      expect(followUp.response).toBeTypeOf('string');
      expect(followUp.response?.length).toBeGreaterThan(0);
    },
    60000
  );
});
