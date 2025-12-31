import { useState } from 'react';
import axios from 'axios';
import { useDevMode } from '../contexts/DevModeContext';
import { RichMTGText } from './RichMTGText';
import { DeveloperInfo } from './DeveloperInfo';

function createConversationId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `conv_${crypto.randomUUID()}`;
  }
  return `conv_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function CardOracle() {
  const [query, setQuery] = useState('');
  const [deckUrl, setDeckUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(createConversationId);
  const { isDevMode, setAgentMetadata } = useDevMode();
  const [messages, setMessages] = useState<
    Array<{ id: string; role: 'user' | 'agent' | 'error'; content: string }>
  >([]);

  const submitQuery = async (text: string, options?: { hideUserMessage?: boolean }) => {
    if (!text.trim()) return;

    setLoading(true);
    if (!options?.hideUserMessage) {
      setMessages((prev) => [
        ...prev,
        { id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`, role: 'user', content: text }
      ]);
    }

    try {
      const result = await axios.post('http://localhost:3001/api/agent/query', {
        query: text,
        devMode: isDevMode,
        conversationId
      });

      if (result.data.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            role: 'agent',
            content: result.data.response
          }
        ]);
        if (result.data.conversationId) {
          setConversationId(result.data.conversationId);
        }

        if (isDevMode && result.data.metadata) {
          setAgentMetadata(result.data.metadata);
        }
      } else {
        const errorMessage = result.data.error || 'Unknown error occurred';
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            role: 'error',
            content: errorMessage
          }
        ]);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to connect to server';
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          role: 'error',
          content: errorMessage
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = query;
    setQuery('');
    await submitQuery(text);
  };

  const handleLoadDeck = async () => {
    if (!deckUrl.trim()) return;
    const prompt = `Load this Commander deck and summarize it for me: ${deckUrl}`;
    await submitQuery(prompt, { hideUserMessage: true });
  };

  const handleRestartConversation = async () => {
    try {
      await axios.post('http://localhost:3001/api/agent/reset', {
        conversationId
      });
    } catch (resetError) {
      console.warn('Failed to reset conversation on server:', resetError);
    }

    setConversationId(createConversationId());
    setMessages([]);
    setAgentMetadata(null);
  };

  return (
    <div className="w-[50vw] max-w-none mx-auto p-4 flex-none flex flex-col min-h-0 h-full">
      <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 shadow-xl flex flex-col flex-1 min-h-0 h-full overflow-hidden">
        <h2 className="text-2xl font-bold mb-4 flex items-center">
          <i className="ms ms-planeswalker mr-2"></i>
          Card Oracle
        </h2>

        <div className="mb-6">
          <label className="block text-gray-300 mb-2">Load a deck list URL</label>
          <div className="flex gap-2">
            <input
              type="url"
              value={deckUrl}
              onChange={(e) => setDeckUrl(e.target.value)}
              placeholder="https://archidekt.com/decks/..."
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              disabled={loading}
            />
            <button
              type="button"
              onClick={handleLoadDeck}
              disabled={loading || !deckUrl.trim()}
              className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Load Deck
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Supports public decks from Archidekt.
          </div>
        </div>

        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={handleRestartConversation}
            className="text-sm text-gray-400 hover:text-gray-200 border border-gray-600 hover:border-gray-500 rounded px-3 py-1 transition-colors"
          >
            Restart conversation
          </button>
        </div>

        <div className="flex flex-col flex-1 min-h-0 bg-gray-900/40 rounded-lg border border-gray-700 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-gray-500 text-sm">
                Start the conversation by asking about a card or loading a deck.
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.role === 'error'
                        ? 'bg-red-900/70 text-red-200 border border-red-700'
                        : 'bg-gray-700/70 text-gray-100'
                  }`}
                >
                  {message.role === 'agent' ? (
                    <RichMTGText text={message.content} />
                  ) : (
                    message.content
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm bg-gray-700/70 text-gray-200">
                  <div className="flex items-center gap-2">
                    <span>Thinking</span>
                    <span className="flex gap-1">
                      <span
                        className="inline-block w-2 h-2 rounded-full bg-cyan-300 animate-bounce"
                        style={{ animationDelay: '0s', animationDuration: '0.6s' }}
                      />
                      <span
                        className="inline-block w-2 h-2 rounded-full bg-cyan-300 animate-bounce"
                        style={{ animationDelay: '0.1s', animationDuration: '0.6s' }}
                      />
                      <span
                        className="inline-block w-2 h-2 rounded-full bg-cyan-300 animate-bounce"
                        style={{ animationDelay: '0.2s', animationDuration: '0.6s' }}
                      />
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-gray-700 p-3 bg-gray-900/70">
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a question to the Oracle..."
                className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Send
              </button>
            </div>
          </form>
        </div>

        {messages.length > 0 && <div className="mt-4"><DeveloperInfo /></div>}
      </div>
    </div>
  );
}
