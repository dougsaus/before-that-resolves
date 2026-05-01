import { type RunConfig, type Model } from '@openai/agents';
import type { OracleModelSelection } from '../types/provider';
import { createGoldfishAgent } from '../agents/goldfish';

export function createGoldfishAgentTool(
  resolvedModel: string | Model,
  selection: OracleModelSelection,
  runConfig?: Partial<RunConfig>,
  conversationId?: string
) {
  const agent = createGoldfishAgent(resolvedModel, selection, conversationId);
  return agent.asTool({
    toolName: 'commander_goldfish_expert',
    toolDescription: 'Goldfish a Commander deck using the goldfish simulator tools',
    runOptions: { maxTurns: 500 },
    runConfig
  });
}
