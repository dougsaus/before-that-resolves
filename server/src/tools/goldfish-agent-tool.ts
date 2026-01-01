import { createGoldfishAgent } from '../agents/goldfish';

export function createGoldfishAgentTool(
  model?: string,
  reasoningEffort?: 'low' | 'medium' | 'high',
  verbosity?: 'low' | 'medium' | 'high'
) {
  const agent = createGoldfishAgent(model, reasoningEffort, verbosity);
  return agent.asTool({
    toolName: 'commander_goldfish_expert',
    toolDescription: 'Goldfish a Commander deck using the goldfish simulator tools',
    runOptions: { maxTurns: 500 }
  });
}
