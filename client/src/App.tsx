import { CardOracle } from './components/CardOracle';
import { DeckCollection } from './components/DeckCollection';
import { DevModeProvider } from './contexts/DevModeContext';
import { DevPanel } from './components/DevPanel';
import { useMemo, useState } from 'react';

const reasoningOptions = {
  'gpt-5': ['low', 'medium', 'high'],
  'gpt-5.1': ['low', 'medium', 'high'],
  'gpt-5.2': ['low', 'medium', 'high']
} as const;

function App() {
  const models = useMemo(
    () => [
      { id: 'gpt-5', label: 'gpt-5', reasoning: true, verbosity: true },
      { id: 'gpt-5.1', label: 'gpt-5.1', reasoning: true, verbosity: true },
      { id: 'gpt-5.2', label: 'gpt-5.2', reasoning: true, verbosity: true },
      { id: 'gpt-4.1', label: 'gpt-4.1', reasoning: false, verbosity: false },
      { id: 'gpt-4o', label: 'gpt-4o', reasoning: false, verbosity: false },
      { id: 'gpt-4o-mini', label: 'gpt-4o-mini', reasoning: false, verbosity: false }
    ],
    []
  );
  const [selectedModel, setSelectedModel] = useState('gpt-5.2');
  const [reasoningEffort, setReasoningEffort] = useState<'low' | 'medium' | 'high'>('medium');
  const [verbosity, setVerbosity] = useState<'low' | 'medium' | 'high'>('medium');
  const [view, setView] = useState<'home' | 'oracle' | 'decks'>('home');
  const supportsReasoning = models.find((model) => model.id === selectedModel)?.reasoning ?? false;
  const supportsVerbosity = models.find((model) => model.id === selectedModel)?.verbosity ?? false;
  const effortOptions = useMemo(() => {
    if (!supportsReasoning) {
      return [];
    }
    return Array.from(reasoningOptions[selectedModel as keyof typeof reasoningOptions] || []);
  }, [supportsReasoning, selectedModel]);
  const normalizedReasoningEffort =
    supportsReasoning && effortOptions.includes(reasoningEffort)
      ? reasoningEffort
      : 'medium';
  const normalizedVerbosity = supportsVerbosity ? verbosity : 'medium';
  const modelControls = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm text-gray-300">Model</label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm text-gray-300">Reasoning</label>
        <select
          value={normalizedReasoningEffort}
          onChange={(e) => setReasoningEffort(e.target.value as 'low' | 'medium' | 'high')}
          disabled={!supportsReasoning}
          className="bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
        >
          {effortOptions.map((effort) => (
            <option key={effort} value={effort}>
              {effort}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm text-gray-300">Verbosity</label>
        <select
          value={normalizedVerbosity}
          onChange={(e) => setVerbosity(e.target.value as 'low' | 'medium' | 'high')}
          disabled={!supportsVerbosity}
          className="bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
        >
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>
      </div>
    </div>
  );

  const goHome = () => setView('home');

  return (
    <DevModeProvider>
      <div className="min-h-[100svh] bg-gradient-to-br from-gray-900 to-gray-800 text-white flex flex-col overflow-hidden lg:h-screen">
        <div className="w-full max-w-none py-4 px-4 flex-1 flex flex-col min-h-0 overflow-hidden sm:py-6 sm:px-6">
          <header className="text-center mb-4 px-2 sm:mb-6 sm:px-6">
            {view !== 'home' && (
              <div className="flex justify-start mb-4">
                <button
                  type="button"
                  onClick={goHome}
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
                >
                  Back
                </button>
              </div>
            )}
            <h1 className="text-3xl font-bold mb-3 flex flex-wrap items-center justify-center gap-3 leading-tight sm:text-4xl lg:text-5xl">
              <span className="ms ms-planeswalker text-2xl sm:text-3xl"></span>
              Before That Resolves
              <span className="ms ms-planeswalker text-2xl sm:text-3xl"></span>
            </h1>
            <p className="text-base text-gray-300 sm:text-lg lg:text-xl">
              Commander Deck Analyzer & Strategy Assistant
            </p>
          </header>

          <main
            className={`flex w-full flex-1 min-h-0 ${
              view === 'oracle' ? 'overflow-hidden' : 'overflow-auto'
            }`}
          >
            {view === 'home' && (
              <div className="w-full max-w-4xl mx-auto grid gap-6 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setView('decks')}
                  className="rounded-2xl border border-gray-700 bg-gray-900/70 p-6 text-left transition hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-500/10"
                >
                  <h2 className="text-2xl font-semibold mb-2">Your Decks</h2>
                  <p className="text-gray-300">
                    Build a personal collection of Archidekt decks to revisit and analyze.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setView('oracle')}
                  className="rounded-2xl border border-gray-700 bg-gray-900/70 p-6 text-left transition hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-500/10"
                >
                  <h2 className="text-2xl font-semibold mb-2">Go to the Oracle</h2>
                  <p className="text-gray-300">
                    Jump straight into analysis, goldfishing, and deck insights.
                  </p>
                </button>
              </div>
            )}
            {view === 'oracle' && (
              <CardOracle
                model={selectedModel}
                reasoningEffort={supportsReasoning ? reasoningEffort : undefined}
                verbosity={supportsVerbosity ? verbosity : undefined}
                modelControls={modelControls}
              />
            )}
            {view === 'decks' && <DeckCollection onBack={goHome} />}
          </main>
        </div>
        <DevPanel />
      </div>
    </DevModeProvider>
  );
}

export default App;
