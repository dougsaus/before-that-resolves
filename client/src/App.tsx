import { CardOracle } from './components/CardOracle';
import { DevModeProvider } from './contexts/DevModeContext';
import { DevPanel } from './components/DevPanel';
import { useEffect, useMemo, useState } from 'react';

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
  const reasoningOptions = {
    'gpt-5': ['low', 'medium', 'high'],
    'gpt-5.1': ['low', 'medium', 'high'],
    'gpt-5.2': ['low', 'medium', 'high']
  } as const;
  const [selectedModel, setSelectedModel] = useState('gpt-5.2');
  const [reasoningEffort, setReasoningEffort] = useState<'low' | 'medium' | 'high'>('medium');
  const [verbosity, setVerbosity] = useState<'low' | 'medium' | 'high'>('medium');
  const supportsReasoning = models.find((model) => model.id === selectedModel)?.reasoning ?? false;
  const supportsVerbosity = models.find((model) => model.id === selectedModel)?.verbosity ?? false;
  const effortOptions = supportsReasoning
    ? Array.from(reasoningOptions[selectedModel as keyof typeof reasoningOptions] || [])
    : [];

  useEffect(() => {
    if (!supportsReasoning) {
      return;
    }
    if (!effortOptions.includes(reasoningEffort)) {
      setReasoningEffort('medium');
    }
  }, [supportsReasoning, reasoningEffort, effortOptions]);

  useEffect(() => {
    if (!supportsVerbosity && verbosity !== 'medium') {
      setVerbosity('medium');
    }
  }, [supportsVerbosity, verbosity]);

  return (
    <DevModeProvider>
      <div className="h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white flex flex-col overflow-hidden">
        <div className="w-full max-w-none px-6 py-6 flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-300">Reasoning</label>
              <select
                value={reasoningEffort}
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
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-300">Verbosity</label>
              <select
                value={verbosity}
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
          <header className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4 flex items-center justify-center gap-3">
              <span className="ms ms-planeswalker text-3xl"></span>
              Before That Resolves
              <span className="ms ms-planeswalker text-3xl"></span>
            </h1>
            <p className="text-xl text-gray-300">
              Commander Deck Analyzer & Strategy Assistant
            </p>
          </header>

          <main className="flex justify-center flex-1 min-h-0 overflow-hidden">
            <CardOracle
              model={selectedModel}
              reasoningEffort={supportsReasoning ? reasoningEffort : undefined}
              verbosity={supportsVerbosity ? verbosity : undefined}
            />
          </main>
        </div>
        <DevPanel />
      </div>
    </DevModeProvider>
  );
}

export default App;
