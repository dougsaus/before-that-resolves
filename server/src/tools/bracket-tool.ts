import { createCommanderBracketAgent } from '../agents/commander-bracket';

export function createCommanderBracketTool(
  model?: string,
  reasoningEffort?: 'low' | 'medium' | 'high',
  verbosity?: 'low' | 'medium' | 'high'
) {
  const agent = createCommanderBracketAgent(model, reasoningEffort, verbosity);
  return agent.asTool({
    toolName: 'commander_bracket_expert',
    toolDescription: 'Answer questions about the Magic: The Gathering Commander bracket system'
  });
}
