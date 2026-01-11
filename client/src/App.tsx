import { useEffect, useMemo, useRef, useState } from 'react';
import { CardOracle } from './components/CardOracle';
import { DeckCollection } from './components/DeckCollection';
import { DeckAuthPanel } from './components/DeckAuthPanel';
import { GameLogs } from './components/GameLogs';
import { DevModeProvider } from './contexts/DevModeContext';
import { DevPanel } from './components/DevPanel';
import { useDeckCollection } from './hooks/useDeckCollection';

const reasoningOptions = {
  'gpt-5': ['low', 'medium', 'high'],
  'gpt-5.1': ['low', 'medium', 'high'],
  'gpt-5.2': ['low', 'medium', 'high']
} as const;

type AppView = 'oracle' | 'decks' | 'logs' | 'profile';

type NavItem = {
  id: 'oracle' | 'decks' | 'logs';
  label: string;
  shortLabel: string;
  description: string;
};

function getInitials(label?: string | null) {
  if (!label) return 'PR';
  const parts = label.split(' ').filter(Boolean);
  if (parts.length === 0) return 'PR';
  return parts
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);
}

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
  const [view, setView] = useState<AppView>('oracle');
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [pendingDeckUrl, setPendingDeckUrl] = useState<string | undefined>(undefined);
  const deckCollection = useDeckCollection();
  const mainRef = useRef<HTMLElement | null>(null);
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
  const navItems: NavItem[] = [
    {
      id: 'oracle',
      label: 'Oracle',
      shortLabel: 'Oracle',
      description: 'Analyze, goldfish, and chat about Commander decks.'
    },
    {
      id: 'decks',
      label: 'Decks',
      shortLabel: 'Decks',
      description: 'Save Archidekt lists to revisit later.'
    },
    {
      id: 'logs',
      label: 'Game Logs',
      shortLabel: 'Logs',
      description: 'Track results for decks in your collection.'
    }
  ];
  const decksEnabled = Boolean(deckCollection.googleClientId);
  const profileLabel =
    deckCollection.user?.name || deckCollection.user?.email || 'Profile';
  const profileInitials = getInitials(deckCollection.user?.name || deckCollection.user?.email);
  const handleNavSelect = (nextView: AppView) => {
    setView(nextView);
    setNavOpen(false);
  };

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  }, [view]);

  return (
    <DevModeProvider>
      <div className="min-h-[100svh] bg-gradient-to-br from-gray-900 to-gray-800 text-white">
        <div className="relative flex min-h-[100svh]">
          {navOpen && (
            <button
              type="button"
              aria-label="Close navigation"
              className="fixed inset-0 z-30 bg-black/60 lg:hidden"
              onClick={() => setNavOpen(false)}
            />
          )}
          <aside
            className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-gray-800 bg-gray-950/95 backdrop-blur transition-transform duration-200 lg:static lg:translate-x-0 ${
              navOpen ? 'translate-x-0' : '-translate-x-full'
            } ${navCollapsed ? 'lg:w-20' : 'lg:w-64'}`}
          >
            <div
              className={`flex flex-1 min-h-0 flex-col gap-6 overflow-y-auto px-4 py-4 sm:px-6 lg:py-6 ${
                navCollapsed ? 'lg:px-3' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNavOpen(false)}
                  className="inline-flex items-center rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-800 lg:hidden"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => setNavCollapsed((prev) => !prev)}
                  aria-label={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
                  className={`hidden lg:inline-flex items-center rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-800 ${
                    navCollapsed ? 'lg:mx-auto' : 'lg:ml-auto'
                  }`}
                >
                  <svg
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {navCollapsed ? (
                      <>
                        <path d="M7 5l4 5-4 5" />
                        <path d="M11 5l4 5-4 5" />
                      </>
                    ) : (
                      <>
                        <path d="M13 5l-4 5 4 5" />
                        <path d="M9 5l-4 5 4 5" />
                      </>
                    )}
                  </svg>
                </button>
              </div>

              <div className={`flex items-center gap-3 ${navCollapsed ? 'lg:justify-center' : ''}`}>
                <span className="ms ms-planeswalker text-base leading-none"></span>
                <span className={`text-base font-semibold ${navCollapsed ? 'lg:hidden' : ''}`}>
                  Before That Resolves
                </span>
              </div>

              <nav className="flex flex-col gap-3">
                {navItems.map((item) => {
                  const isActive = view === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavSelect(item.id)}
                      className={`rounded-xl border px-3 py-2 text-left transition ${
                        isActive
                          ? 'border-cyan-400 bg-cyan-500/10 text-cyan-100'
                          : 'border-gray-800 bg-gray-900/60 text-gray-200 hover:border-gray-600'
                      } ${navCollapsed ? 'lg:px-2 lg:py-3 lg:text-center' : ''}`}
                    >
                      <div className={`text-sm font-semibold ${navCollapsed ? 'lg:text-xs' : ''}`}>
                        {navCollapsed ? item.shortLabel.slice(0, 1) : item.label}
                      </div>
                      <div className={`text-xs text-gray-400 ${navCollapsed ? 'lg:hidden' : ''}`}>
                        {item.description}
                      </div>
                    </button>
                  );
                })}
              </nav>

              <button
                type="button"
                onClick={() => handleNavSelect('profile')}
                className={`mt-auto flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                  view === 'profile'
                    ? 'border-cyan-400 bg-cyan-500/10 text-cyan-100'
                    : 'border-gray-800 bg-gray-900/60 text-gray-200 hover:border-gray-600'
                } ${navCollapsed ? 'lg:justify-center' : ''}`}
              >
                {deckCollection.user?.picture ? (
                  <img
                    src={deckCollection.user.picture}
                    alt={deckCollection.user.name || 'Profile'}
                    className="h-8 w-8 rounded-full border border-gray-700"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-xs font-semibold">
                    {profileInitials}
                  </span>
                )}
                <span className={`${navCollapsed ? 'lg:hidden' : ''}`}>{profileLabel}</span>
              </button>
            </div>
          </aside>

          <div className="flex min-h-[100svh] flex-1 flex-col">
            <main
              ref={mainRef}
              className={`flex-1 min-h-0 px-4 pb-6 pt-6 sm:px-6 ${
                view === 'oracle' ? 'overflow-hidden' : 'overflow-auto'
              }`}
            >
              <div className="mb-4 flex items-center justify-between lg:hidden">
                <button
                  type="button"
                  onClick={() => setNavOpen(true)}
                  className="inline-flex items-center rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
                >
                  Menu
                </button>
                <div className="flex items-center gap-2 text-lg font-semibold text-gray-100">
                  <span className="ms ms-planeswalker text-xl leading-none"></span>
                  <span>Before That Resolves</span>
                  <span className="ms ms-planeswalker text-xl leading-none"></span>
                </div>
                <span className="w-[3.5rem]" aria-hidden="true"></span>
              </div>
              {view === 'oracle' && (
                <CardOracle
                  model={selectedModel}
                  reasoningEffort={supportsReasoning ? reasoningEffort : undefined}
                  verbosity={supportsVerbosity ? verbosity : undefined}
                  modelControls={modelControls}
                  initialDeckUrl={pendingDeckUrl}
                  onInitialDeckUrlConsumed={() => setPendingDeckUrl(undefined)}
                />
              )}
              {view === 'decks' && (
                <DeckCollection
                  enabled={decksEnabled}
                  idToken={deckCollection.idToken}
                  decks={deckCollection.decks}
                  loading={deckCollection.loading}
                  deckError={deckCollection.deckError}
                  onCreateDeck={deckCollection.createDeck}
                  onUpdateDeck={deckCollection.updateDeck}
                  onPreviewDeck={deckCollection.previewDeck}
                  onRemoveDeck={deckCollection.removeDeck}
                  onOpenInOracle={(deckUrl) => {
                    setPendingDeckUrl(deckUrl);
                    setView('oracle');
                  }}
                  onRefreshDecks={deckCollection.refreshDecks}
                />
              )}
              {view === 'logs' && (
                <GameLogs
                  enabled={decksEnabled}
                  idToken={deckCollection.idToken}
                />
              )}
              {view === 'profile' && (
                <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
                  <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
                    <h2 className="text-2xl font-semibold mb-2">Profile</h2>
                    <p className="text-gray-300">
                      Sign in with Google to save decks to your collection. Oracle tools work without login.
                    </p>
                  </div>
                  <DeckAuthPanel
                    enabled={decksEnabled}
                    idToken={deckCollection.idToken}
                    user={deckCollection.user}
                    authError={deckCollection.authError}
                    loading={deckCollection.loading}
                    buttonRef={deckCollection.buttonRef}
                    onSignOut={deckCollection.signOut}
                  />
                </div>
              )}
            </main>
          </div>
        </div>
        <DevPanel />
      </div>
    </DevModeProvider>
  );
}

export default App;
