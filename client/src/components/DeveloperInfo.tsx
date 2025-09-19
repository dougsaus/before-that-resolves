import { useDevMode } from '../contexts/DevModeContext';

interface ToolSummary {
  name: string;
  count: number;
  totalTime: number;
}

export function DeveloperInfo() {
  const { isDevMode, agentMetadata } = useDevMode();

  if (!isDevMode || !agentMetadata || agentMetadata.toolCalls.length === 0) {
    return null;
  }

  // Aggregate tool calls by name
  const toolSummary = agentMetadata.toolCalls.reduce((acc, tool) => {
    if (!acc[tool.name]) {
      acc[tool.name] = { name: tool.name, count: 0, totalTime: 0 };
    }
    acc[tool.name].count++;
    // Add duration if available (we might add this later)
    if (tool.duration) {
      acc[tool.name].totalTime += tool.duration;
    }
    return acc;
  }, {} as Record<string, ToolSummary>);

  const tools = Object.values(toolSummary);

  return (
    <div className="mt-4 p-4 bg-gray-800/40 border border-gray-700 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-cyan-400 text-sm font-mono">🔧 Developer Info</span>
        <span className="text-xs text-gray-500">
          (Visible in dev mode)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <h4 className="text-gray-400 text-xs uppercase tracking-wider mb-2">
            Tools Used
          </h4>
          <div className="space-y-1">
            {tools.map((tool) => (
              <div key={tool.name} className="flex items-center justify-between">
                <span className="text-gray-200 font-mono">
                  {formatToolName(tool.name)}
                </span>
                <span className="text-gray-400">
                  ×{tool.count}
                  {tool.totalTime > 0 && (
                    <span className="ml-2 text-xs">
                      ({tool.totalTime}ms)
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-gray-400 text-xs uppercase tracking-wider mb-2">
            Performance
          </h4>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Calls:</span>
              <span className="text-gray-200 font-mono">
                {agentMetadata.toolCalls.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total Time:</span>
              <span className="text-gray-200 font-mono">
                {agentMetadata.totalDuration}ms
              </span>
            </div>
            {agentMetadata.modelResponses && (
              <div className="flex justify-between">
                <span className="text-gray-400">Model Calls:</span>
                <span className="text-gray-200 font-mono">
                  {agentMetadata.modelResponses}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Show detailed tool results in a collapsible section if needed */}
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-gray-500 hover:text-gray-400">
          View detailed tool calls
        </summary>
        <div className="mt-2 space-y-2 max-h-40 overflow-auto">
          {agentMetadata.toolCalls.map((call, index) => (
            <div key={index} className="p-2 bg-gray-900/50 rounded">
              <div className="flex items-center justify-between mb-1">
                <span className="text-purple-400 font-mono">
                  {call.name}
                </span>
                <span className="text-gray-500">
                  {call.status || 'completed'}
                </span>
              </div>
              <div className="text-gray-400">
                <span>Args: </span>
                <code className="text-xs">
                  {JSON.stringify(call.arguments, null, 2)}
                </code>
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

// Format tool names to be more readable
function formatToolName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}