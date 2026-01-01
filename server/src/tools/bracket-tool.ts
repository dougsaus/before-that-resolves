import { z } from 'zod';
import { run, tool } from '@openai/agents';
import { createCommanderBracketAgent } from '../agents/commander-bracket-agent';
import { extractResponseText } from '../utils/agent-helpers';

export const commanderBracketTool = tool({
  name: 'commander_bracket_expert',
  description: 'Answer questions about the Magic: The Gathering Commander bracket system',
  parameters: z.object({
    question: z.string().describe('The bracket system question to answer')
  }),
  execute: async ({ question }, runContext) => {
    const context = runContext?.context as {
      model?: string;
      reasoningEffort?: 'low' | 'medium' | 'high';
      verbosity?: 'low' | 'medium' | 'high';
    } | undefined;
    const agent = createCommanderBracketAgent(
      context?.model,
      context?.reasoningEffort,
      context?.verbosity
    );
    const result = await run(agent, [{ role: 'user', content: question }]);

    return {
      success: true,
      response: extractResponseText(result) || 'No response generated.'
    };
  }
});
