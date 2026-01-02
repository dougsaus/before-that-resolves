import { useEffect, useRef, useState } from 'react';
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

type CardOracleProps = {
  model?: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
  modelControls?: React.ReactNode;
};

export function CardOracle({ model, reasoningEffort, verbosity, modelControls }: CardOracleProps) {
  const defaultDeckAnalysisOptions = {
    summary: true,
    winCons: true,
    bracket: true,
    weaknesses: true
  };
  const [query, setQuery] = useState('');
  const [deckUrl, setDeckUrl] = useState('');
  const [deckAnalysisOptions, setDeckAnalysisOptions] = useState(defaultDeckAnalysisOptions);
  const [deckLoaded, setDeckLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState<'query' | 'analyze' | 'goldfish' | null>(null);
  const [exporting, setExporting] = useState(false);
  const [goldfishGames, setGoldfishGames] = useState(1);
  const [goldfishTurns, setGoldfishTurns] = useState(7);
  const [goldfishMetrics, setGoldfishMetrics] = useState({
    mana: true,
    commanderCast: true,
    damage: true,
    cardsDrawn: true
  });
  const [conversationId, setConversationId] = useState(createConversationId);
  const { isDevMode, setAgentMetadata } = useDevMode();
  const [messages, setMessages] = useState<
    Array<{ id: string; role: 'user' | 'agent' | 'error'; content: string }>
  >([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  const submitQuery = async (
    text: string,
    options?: { hideUserMessage?: boolean; mode?: 'query' | 'analyze' | 'goldfish' }
  ) => {
    if (!text.trim()) return;

    setLoading(true);
    setLoadingMode(options?.mode ?? 'query');
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
        conversationId,
        model,
        reasoningEffort: reasoningEffort || undefined,
        verbosity
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
      setLoadingMode(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = query;
    setQuery('');
    await submitQuery(text, { mode: 'query' });
  };

  const resetConversationState = async (options?: { preserveDeckUrl?: boolean }) => {
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
    setDeckAnalysisOptions(defaultDeckAnalysisOptions);
    setGoldfishGames(1);
    setGoldfishTurns(7);
    setGoldfishMetrics({
      mana: true,
      commanderCast: true,
      damage: true,
      cardsDrawn: true
    });
    setDeckLoaded(false);
    if (!options?.preserveDeckUrl) {
      setDeckUrl('');
    }
  };

  const handleLoadDeck = async () => {
    if (!deckUrl.trim()) return;
    setLoading(true);

    await resetConversationState({ preserveDeckUrl: true });

    try {
      await axios.post('http://localhost:3001/api/deck/cache', { deckUrl });
      setDeckLoaded(true);
    } catch (cacheError) {
      const errorMessage =
        (cacheError as any)?.response?.data?.error ||
        (cacheError as any)?.message ||
        'Failed to cache deck';
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

  const handleAnalyzeDeck = async () => {
    if (!deckUrl.trim() || !deckLoaded) return;
    const analysisSections = [
      deckAnalysisOptions.summary
        ? 'Summarize the deck providing insights like color identity, overall theme and archetypes of the deck, and how the deck should be played without getting too deep on the specifics of individual cards.'
        : null,
      deckAnalysisOptions.winCons
        ? 'Summarize the Win Conditions present in the deck and a detailed summary of the cards that enable them.'
        : null,
      deckAnalysisOptions.bracket
        ? 'Provide an assessment of what bracket the deck is likely to be along with detailed justification, going into details about specific cards and interactions when necessary.'
        : null,
      deckAnalysisOptions.weaknesses
        ? 'Find potential weaknesses of the deck and suggest ways to fix it citing specific cards to add or to cut when appropriate.'
        : null
    ].filter(Boolean) as string[];

    if (analysisSections.length === 0) return;

    const prompt = `Analyze this Commander deck: ${deckUrl}\n\nPlease provide the following in order:\n${analysisSections
      .map((section, index) => `${index + 1}) ${section}`)
      .join('\n')}`;
    await submitQuery(prompt, { hideUserMessage: true, mode: 'analyze' });
  };

  const handleGoldfishDeck = async () => {
    if (!deckLoaded) return;
    const games = Math.min(10, Math.max(1, goldfishGames));
    const turns = Math.min(10, Math.max(1, goldfishTurns));
    const metrics = [
      goldfishMetrics.mana ? 'mana generation' : null,
      goldfishMetrics.commanderCast ? 'commander cast turn' : null,
      goldfishMetrics.damage ? 'damage generated' : null,
      goldfishMetrics.cardsDrawn ? 'extra cards drawn (do not count upkeep and opening hand)' : null
    ].filter(Boolean) as string[];

    const metricsText =
      metrics.length > 0 ? ` Track the following metrics: ${metrics.join(', ')}.` : '';
    const prompt = `Goldfish this deck. Simulate ${games} games going ${turns} turns.${metricsText} Summarize the results of the simulations.`;
    await submitQuery(prompt, { hideUserMessage: true, mode: 'goldfish' });
  };

  const handleRestartConversation = async () => {
    await resetConversationState();
  };

  const handleExportPdf = async () => {
    if (messages.length === 0 || exporting) return;
    setExporting(true);

    try {
      const deckSlug = deckUrl.trim().split('/').filter(Boolean).pop();
      const filename = deckLoaded && deckSlug
        ? `${deckSlug}.pdf`
        : 'before-that-resolves-conversation.pdf';
      const response = await axios.post(
        'http://localhost:3001/api/chat/export-pdf',
        {
          title: 'Before That Resolves',
          subtitle: 'Commander Deck Analyzer & Strategy Assistant',
          deckUrl: deckLoaded ? deckUrl : undefined,
          messages
        },
        { responseType: 'blob' }
      );

      const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error || error?.message || 'Failed to export PDF';
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          role: 'error',
          content: errorMessage
        }
      ]);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="w-full max-w-none p-4 flex-none flex flex-col min-h-0 h-full">
      <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 shadow-xl flex flex-col flex-1 min-h-0 h-full overflow-hidden">
        <div className="flex flex-1 min-h-0 gap-4 overflow-hidden">
          <aside className="w-1/4 flex flex-col gap-4 min-h-0 overflow-y-auto pr-1">
            <div className="rounded-lg border border-gray-700 bg-gray-900/70 overflow-hidden">
              <div className="p-4 border-b border-gray-700">
                <label className="block text-gray-300 text-sm mb-2">
                  Deck list URL to discuss with The Oracle
                </label>
                <div className="flex flex-col gap-2">
                  <input
                    type="url"
                    value={deckUrl}
                    onChange={(e) => {
                      setDeckUrl(e.target.value);
                      if (deckLoaded) {
                        setDeckLoaded(false);
                      }
                    }}
                    placeholder="https://archidekt.com/decks/..."
                    className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={handleLoadDeck}
                    disabled={loading || !deckUrl.trim()}
                    className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-semibold"
                  >
                    Load Deck
                  </button>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Supports public decks from Archidekt.
                </div>
              </div>
              <div className="p-4 border-b border-gray-700">
                <div className="flex flex-col gap-3 text-sm text-gray-300">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={deckAnalysisOptions.summary}
                      onChange={(e) =>
                        setDeckAnalysisOptions((prev) => ({
                          ...prev,
                          summary: e.target.checked
                        }))
                      }
                      disabled={loading || !deckLoaded}
                      className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                    />
                    Summarize
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={deckAnalysisOptions.winCons}
                      onChange={(e) =>
                        setDeckAnalysisOptions((prev) => ({
                          ...prev,
                          winCons: e.target.checked
                        }))
                      }
                      disabled={loading || !deckLoaded}
                      className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                    />
                    Find win cons
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={deckAnalysisOptions.bracket}
                      onChange={(e) =>
                        setDeckAnalysisOptions((prev) => ({
                          ...prev,
                          bracket: e.target.checked
                        }))
                      }
                      disabled={loading || !deckLoaded}
                      className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                    />
                    Assess bracket
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={deckAnalysisOptions.weaknesses}
                      onChange={(e) =>
                        setDeckAnalysisOptions((prev) => ({
                          ...prev,
                          weaknesses: e.target.checked
                        }))
                      }
                      disabled={loading || !deckLoaded}
                      className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                    />
                    Find weaknesses
                  </label>
                  <button
                    type="button"
                    onClick={handleAnalyzeDeck}
                    disabled={
                      loading ||
                      !deckLoaded ||
                      !deckUrl.trim() ||
                      (!deckAnalysisOptions.summary &&
                        !deckAnalysisOptions.winCons &&
                        !deckAnalysisOptions.bracket &&
                        !deckAnalysisOptions.weaknesses)
                    }
                    className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-semibold"
                  >
                    Analyze Deck
                  </button>
                </div>
              </div>
              <div className="p-4">
                <div className="flex flex-col gap-4 text-sm text-gray-300">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-2">
                      <span>Games</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={goldfishGames}
                        onChange={(e) => setGoldfishGames(Number(e.target.value))}
                        disabled={!deckLoaded || loading}
                        className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span>Turns</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={goldfishTurns}
                        onChange={(e) => setGoldfishTurns(Number(e.target.value))}
                        disabled={!deckLoaded || loading}
                        className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                      />
                    </label>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-xs uppercase tracking-wide text-gray-400">
                      Metrics
                    </span>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={goldfishMetrics.mana}
                        onChange={(e) =>
                          setGoldfishMetrics((prev) => ({ ...prev, mana: e.target.checked }))
                        }
                        disabled={!deckLoaded || loading}
                        className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                      />
                      Mana generation
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={goldfishMetrics.commanderCast}
                        onChange={(e) =>
                          setGoldfishMetrics((prev) => ({
                            ...prev,
                            commanderCast: e.target.checked
                          }))
                        }
                        disabled={!deckLoaded || loading}
                        className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                      />
                      Commander cast turn
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={goldfishMetrics.damage}
                        onChange={(e) =>
                          setGoldfishMetrics((prev) => ({ ...prev, damage: e.target.checked }))
                        }
                        disabled={!deckLoaded || loading}
                        className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                      />
                      Damage generated
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={goldfishMetrics.cardsDrawn}
                        onChange={(e) =>
                          setGoldfishMetrics((prev) => ({ ...prev, cardsDrawn: e.target.checked }))
                        }
                        disabled={!deckLoaded || loading}
                        className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                      />
                      Extra cards drawn
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={handleGoldfishDeck}
                    disabled={!deckLoaded || loading}
                    className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-semibold"
                  >
                    Goldfish Deck
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <div className="flex flex-col w-1/2 min-h-0 bg-gray-900/40 rounded-lg border border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-700 p-4 bg-gray-900/70">
              <h2 className="text-xl font-bold">
                The Oracle - Your Magic:The Gathering AI Agent
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={exporting || messages.length === 0}
                  className="text-sm text-gray-300 hover:text-gray-100 border border-gray-600 hover:border-gray-500 rounded px-3 py-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Export conversation to pdf
                </button>
                <button
                  type="button"
                  onClick={handleRestartConversation}
                  className="text-sm text-gray-300 hover:text-gray-100 border border-gray-600 hover:border-gray-500 rounded px-3 py-1 transition-colors"
                >
                  New Conversation
                </button>
              </div>
            </div>
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

            {loadingMode && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm bg-gray-700/70 text-gray-200">
                  {loadingMode === 'query' ? (
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
                  ) : (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span>
                          {loadingMode === 'analyze' ? 'Analyzing Deck...' : 'Goldfishing Deck...'}
                        </span>
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
                      <span className="text-xs text-gray-400">
                        {loadingMode === 'analyze'
                          ? 'This could take several minutes'
                          : 'This process can take 5 to 60 minutes depending on the options chosen'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

            <form onSubmit={handleSubmit} className="border-t border-gray-700 p-4 bg-gray-900/70">
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
                  className="px-6 py-2 w-[10.5rem] bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  Send
                </button>
              </div>
            </form>
          </div>

          <aside className="w-1/4 flex flex-col gap-4 min-h-0 overflow-y-auto pl-1">
            <div className="rounded-lg border border-gray-700 bg-gray-900/70 p-4">
              {modelControls}
            </div>
          </aside>
        </div>

        {messages.length > 0 && <div className="mt-4"><DeveloperInfo /></div>}
      </div>
    </div>
  );
}
