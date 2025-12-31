import { useState } from 'react';
import axios from 'axios';
import { useDevMode } from '../contexts/DevModeContext';
import { RichMTGText } from './RichMTGText';
import { DeveloperInfo } from './DeveloperInfo';

export function CardOracle() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isDevMode, setAgentMetadata } = useDevMode();

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

    try {
      const result = await axios.post('http://localhost:3001/api/agent/query', {
        query: query,
        devMode: isDevMode
      });

      if (result.data.success) {
        setResponse(result.data.response);

        if (isDevMode && result.data.metadata) {
          setAgentMetadata(result.data.metadata);
        }
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
        <h2 className="text-2xl font-bold mb-4 flex items-center">
          <i className="ms ms-planeswalker mr-2"></i>
          Card Oracle
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
              <div className="mb-3">
                <h3 className="font-semibold text-white mb-3">
                  <i className="ms ms-planeswalker ms-cost mr-2"></i>
                  Oracle's Response
                </h3>
                <RichMTGText text={response} />
              </div>
            </div>
            <DeveloperInfo />
          </div>
        )}
      </div>
    </div>
  );
}
