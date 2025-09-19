import { useState } from 'react';
import axios from 'axios';

/**
 * Test Component for Lesson 1: Card Oracle Agent
 *
 * This component lets you test your first agent!
 */
export function CardOracleTest() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolCalls, setToolCalls] = useState<number | null>(null);

  const exampleQueries = [
    "What is Lightning Bolt?",
    "Can Atraxa be my commander?",
    "Find blue instant spells",
    "What are the rulings for Doubling Season?",
    "Suggest a random commander",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResponse(null);
    setToolCalls(null);

    try {
      const result = await axios.post('http://localhost:3001/api/agent/query', {
        query: query
      });

      if (result.data.success) {
        setResponse(result.data.response);
        setToolCalls(result.data.toolCalls || 0);
      } else {
        setError(result.data.error || 'Unknown error occurred');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6 shadow-xl">
        <h2 className="text-2xl font-bold mb-4">
          🎴 Card Oracle Agent Test
        </h2>

        <div className="mb-4">
          <p className="text-gray-300 mb-2">Try these examples:</p>
          <div className="flex flex-wrap gap-2">
            {exampleQueries.map((example) => (
              <button
                key={example}
                onClick={() => handleExampleClick(example)}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about any Magic card..."
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {loading ? 'Asking...' : 'Ask Oracle'}
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg">
            <p className="text-red-300">Error: {error}</p>
            <p className="text-sm text-red-400 mt-2">
              Make sure the server is running and you've set your OPENAI_API_KEY
            </p>
          </div>
        )}

        {response && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-700/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Oracle's Response:</h3>
                {toolCalls !== null && (
                  <span className="text-sm text-gray-400">
                    Tools used: {toolCalls}
                  </span>
                )}
              </div>
              <div className="prose prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-gray-300">
                  {response}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-gray-800/30 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">
          📚 Lesson 1: What You're Learning
        </h3>
        <ul className="space-y-1 text-sm text-gray-300">
          <li>✓ Creating agents with the Agent class</li>
          <li>✓ Defining tools with Zod schemas</li>
          <li>✓ Wrapping external APIs (Scryfall) as tools</li>
          <li>✓ Running agents with the run() function</li>
          <li>✓ Handling agent responses</li>
        </ul>
      </div>
    </div>
  );
}