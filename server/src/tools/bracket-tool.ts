import { type RunConfig, type Model } from '@openai/agents';
import type { OracleModelSelection } from '../types/provider';
import { createCommanderBracketAgent } from '../agents/commander-bracket';

export function createCommanderBracketTool(
  resolvedModel: string | Model,
  selection: OracleModelSelection,
  runConfig?: Partial<RunConfig>
) {
  const agent = createCommanderBracketAgent(resolvedModel, selection);
  return agent.asTool({
    toolName: 'commander_bracket_expert',
    toolDescription: 'Answer questions about the Magic: The Gathering Commander bracket system',
    runConfig
  });
}
