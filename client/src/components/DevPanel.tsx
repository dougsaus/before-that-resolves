import { useState } from 'react';
import { useDevMode } from '../contexts/DevModeContext';

export function DevPanel() {
  const { isDevMode, toggleDevMode, agentMetadata } = useDevMode();
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!isDevMode) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-cyan-500/30 shadow-2xl z-50">
      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-cyan-900/20 to-purple-900/20 cursor-pointer"
           onClick={() => setIsCollapsed(!isCollapsed)}>
        <div className="flex items-center gap-3">
          <span className="text-cyan-400 font-mono text-sm">🔧 Developer Mode</span>
          <span className="text-xs text-gray-500">Press Ctrl+Shift+D to toggle</span>
        </div>
        <button className="text-gray-400 hover:text-white">
          {isCollapsed ? '▲' : '▼'}
        </button>
      </div>

      {!isCollapsed && (
        <div className="max-h-64 overflow-auto p-4">
          {agentMetadata ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-cyan-400 font-mono">Tool Calls:</span>
                  <span className="ml-2 text-white">{agentMetadata.toolCalls.length}</span>
                </div>
                <div>
                  <span className="text-cyan-400 font-mono">Total Duration:</span>
                  <span className="ml-2 text-white">
                    {agentMetadata.totalDuration ? `${agentMetadata.totalDuration}ms` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-cyan-400 font-mono">Model Responses:</span>
                  <span className="ml-2 text-white">
                    {agentMetadata.modelResponses || 'N/A'}
                  </span>
                </div>
              </div>

              {agentMetadata.toolCalls.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-cyan-400 font-mono text-sm mb-2">Tool Execution Details:</h4>
                  <div className="space-y-2">
                    {agentMetadata.toolCalls.map((call, index) => (
                      <div key={index} className="bg-gray-900 rounded p-3 border border-gray-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-purple-400 font-mono text-sm">{call.name}</span>
                          {call.duration && (
                            <span className="text-xs text-gray-500">{call.duration}ms</span>
                          )}
                        </div>
                        <div className="text-xs">
                          <div className="mb-1">
                            <span className="text-gray-500">Arguments:</span>
                            <pre className="text-gray-300 mt-1 overflow-x-auto">
                              {JSON.stringify(call.arguments, null, 2)}
                            </pre>
                          </div>
                          {call.result !== undefined && (
                            <div className="mt-2">
                              <span className="text-gray-500">Result:</span>
                              <pre className="text-green-400 mt-1 overflow-x-auto max-h-20 overflow-y-auto">
                                {typeof call.result === 'object'
                                  ? JSON.stringify(call.result, null, 2)
                                  : String(call.result).substring(0, 200) + (String(call.result).length > 200 ? '...' : '')
                                }
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500 text-center py-8">
              <p className="font-mono text-sm">No agent activity yet</p>
              <p className="text-xs mt-2">Submit a query to see agent metadata</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}