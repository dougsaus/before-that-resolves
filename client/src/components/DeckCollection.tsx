import { useMemo, useState } from 'react';
import { ColorIdentityIcons, ColorIdentitySelect } from './ColorIdentitySelect';
import { sortColorsForDisplay } from '../utils/color-identity';
import { useGameLogs } from '../hooks/useGameLogs';

function formatWinRate(winRate: number | null): string {
  if (winRate === null) return '—';
  return `${Math.round(winRate * 100)}%`;
}

function formatLastPlayed(lastPlayed: string | null): string {
  if (!lastPlayed) return '—';
  const date = new Date(lastPlayed);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export type DeckStats = {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number | null;
  lastPlayed: string | null;
};

export type DeckEntry = {
  id: string;
  name: string;
  url: string | null;
  format: string | null;
  commanderNames: string[];
  colorIdentity: string[] | null;
  source: 'archidekt' | 'manual';
  addedAt: string;
  stats: DeckStats | null;
};

export type ManualDeckInput = {
  name: string;
  commanderNames?: string;
  colorIdentity?: string[];
};

type OpponentForm = {
  name: string;
  commander: string;
  colorIdentity: string;
};

type DeckCollectionProps = {
  enabled: boolean;
  idToken: string | null;
  decks: DeckEntry[];
  loading: boolean;
  deckError: string | null;
  onAddArchidektDeck: (deckUrl: string) => Promise<void>;
  onAddManualDeck: (input: ManualDeckInput) => Promise<boolean>;
  onRemoveDeck: (deckId: string) => Promise<void>;
  onOpenInOracle?: (deckUrl: string) => void;
  onRefreshDecks?: () => Promise<void>;
};

export function DeckCollection({
  enabled,
  idToken,
  decks,
  loading,
  deckError,
  onAddArchidektDeck,
  onAddManualDeck,
  onRemoveDeck,
  onOpenInOracle,
  onRefreshDecks
}: DeckCollectionProps) {
  const [deckUrl, setDeckUrl] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualCommander, setManualCommander] = useState('');
  const [manualColor, setManualColor] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeckEntry | null>(null);
  const [logTarget, setLogTarget] = useState<DeckEntry | null>(null);
  const [logDate, setLogDate] = useState('');
  const [logOpponents, setLogOpponents] = useState<OpponentForm[]>([]);
  const [logResult, setLogResult] = useState<'win' | 'loss' | 'pending'>('pending');
  const [logGoodGame, setLogGoodGame] = useState(true);
  const [logFormError, setLogFormError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'name' | 'commander' | 'color'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const {
    addLog,
    error: logError,
    loading: logLoading,
    statusMessage: logStatusMessage
  } = useGameLogs(idToken, { autoLoad: false });
  const sortedDecks = useMemo(() => {
    const sorted = [...decks];
    const direction = sortDir === 'asc' ? 1 : -1;
    const getCommanderValue = (deck: DeckEntry) =>
      deck.commanderNames.length > 0 ? deck.commanderNames.join(', ') : '';
    const getColorValue = (deck: DeckEntry) => {
      if (!deck.colorIdentity) return '';
      return sortColorsForDisplay(deck.colorIdentity).join('');
    };
    sorted.sort((a, b) => {
      let left = '';
      let right = '';
      if (sortKey === 'name') {
        left = a.name;
        right = b.name;
      } else if (sortKey === 'commander') {
        left = getCommanderValue(a);
        right = getCommanderValue(b);
      } else {
        left = getColorValue(a);
        right = getColorValue(b);
      }
      return left.localeCompare(right, undefined, { sensitivity: 'base' }) * direction;
    });
    return sorted;
  }, [decks, sortDir, sortKey]);

  const handleAddArchidektDeck = async () => {
    if (!deckUrl.trim()) return;
    await onAddArchidektDeck(deckUrl.trim());
    setDeckUrl('');
  };

  const handleSort = (key: 'name' | 'commander' | 'color') => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('asc');
  };

  const sortIndicator = (key: 'name' | 'commander' | 'color') =>
    sortKey === key ? (sortDir === 'asc' ? '^' : 'v') : null;

  const resetManualForm = () => {
    setManualName('');
    setManualCommander('');
    setManualColor('');
    setManualError(null);
  };

  const openManualModal = () => {
    setManualError(null);
    setManualModalOpen(true);
  };

  const closeManualModal = () => {
    setManualModalOpen(false);
  };

  const resetLogForm = () => {
    setLogDate(today);
    setLogOpponents([]);
    setLogResult('pending');
    setLogGoodGame(true);
    setLogFormError(null);
  };

  const addLogOpponent = () => {
    setLogOpponents((current) => [...current, { name: '', commander: '', colorIdentity: '' }]);
  };

  const removeLogOpponent = (index: number) => {
    setLogOpponents((current) => current.filter((_, i) => i !== index));
  };

  const openLogModal = (deck: DeckEntry) => {
    resetLogForm();
    setLogTarget(deck);
  };

  const handleAddManualDeck = async () => {
    if (!manualName.trim()) {
      setManualError('Deck name is required.');
      return;
    }
    setManualError(null);
    const input: ManualDeckInput = {
      name: manualName.trim(),
      commanderNames: manualCommander.trim() || undefined
    };
    if (manualColor === 'C') {
      input.colorIdentity = [];
    } else if (manualColor) {
      input.colorIdentity = manualColor.split('');
    }
    const saved = await onAddManualDeck(input);
    if (!saved) return;
    resetManualForm();
    closeManualModal();
  };

  const updateLogOpponent = (index: number, field: keyof OpponentForm, value: string) => {
    setLogOpponents((current) => {
      const next = [...current];
      const target = next[index] ?? { name: '', commander: '', colorIdentity: '' };
      next[index] = { ...target, [field]: value };
      return next;
    });
  };

  const handleSaveLog = async () => {
    if (!logTarget) {
      setLogFormError('Choose a deck to log.');
      return;
    }
    setLogFormError(null);
    const success = await addLog({
      deckId: logTarget.id,
      datePlayed: logDate || today,
      opponentsCount: logOpponents.length,
      opponents: logOpponents.map((opponent) => ({
        name: opponent.name.trim(),
        commander: opponent.commander.trim(),
        colorIdentity: opponent.colorIdentity.trim()
      })),
      result: logResult === 'pending' ? null : logResult,
      goodGame: logGoodGame
    });
    if (success) {
      setLogTarget(null);
      resetLogForm();
      if (onRefreshDecks) {
        await onRefreshDecks();
      }
    }
  };

  if (!enabled) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-gray-900/70 border border-gray-700 rounded-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-semibold mb-3">Your Decks</h2>
        <p className="text-gray-300">
          Google login is not configured. Set `VITE_GOOGLE_CLIENT_ID` to enable deck collections.
        </p>
      </div>
    );
  }

  if (!idToken) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-gray-900/70 border border-gray-700 rounded-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-semibold mb-3">Your Decks</h2>
        <p className="text-gray-300">
          Sign in from the Profile page to start saving decks to your collection.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-6">
      <div className="bg-gray-900/70 border border-gray-700 rounded-2xl p-6 sm:p-8 flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold">Add deck to collection</h3>
          <label className="text-sm text-gray-300" htmlFor="deck-url-input">
            Archidekt deck URL
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="deck-url-input"
              type="url"
              value={deckUrl}
              onChange={(event) => setDeckUrl(event.target.value)}
              placeholder="https://archidekt.com/decks/..."
              className="flex-1 px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button
              type="button"
              onClick={handleAddArchidektDeck}
              disabled={loading}
              className="px-5 py-3 rounded-lg bg-cyan-500 text-gray-900 font-semibold hover:bg-cyan-400 disabled:opacity-60"
            >
              {loading ? 'Saving...' : 'Add Deck'}
            </button>
          </div>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-gray-400">Or add a manual deck entry.</span>
            <button
              type="button"
              onClick={openManualModal}
              className="px-4 py-2 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800"
            >
              Add Deck Manually
            </button>
          </div>
        </div>
      </div>

      {deckError && <p className="text-red-400">{deckError}</p>}

  <div className="bg-gray-900/70 border border-gray-700 rounded-2xl p-6 sm:p-8">
    {loading && <p className="text-gray-400">Loading...</p>}
    {!loading && decks.length === 0 && (
      <p className="text-gray-400">No decks yet. Add your first deck above.</p>
        )}
        {decks.length > 0 && (
          <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-gray-800 bg-gray-950/60 sm:max-h-[60vh]">
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-800 px-4 py-3 text-xs uppercase tracking-wide text-gray-400 sm:hidden">
              <span className="mr-2">Sort by</span>
              <button
                type="button"
                onClick={() => handleSort('name')}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  sortKey === 'name' ? 'border-cyan-400 text-cyan-200' : 'border-gray-700 text-gray-300'
                }`}
              >
                Deck {sortIndicator('name') || ''}
              </button>
              <button
                type="button"
                onClick={() => handleSort('commander')}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  sortKey === 'commander' ? 'border-cyan-400 text-cyan-200' : 'border-gray-700 text-gray-300'
                }`}
              >
                Commander {sortIndicator('commander') || ''}
              </button>
              <button
                type="button"
                onClick={() => handleSort('color')}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  sortKey === 'color' ? 'border-cyan-400 text-cyan-200' : 'border-gray-700 text-gray-300'
                }`}
              >
                Colors {sortIndicator('color') || ''}
              </button>
            </div>
            <div className="divide-y divide-gray-800 sm:hidden">
              {sortedDecks.map((deck) => (
                <div key={deck.id} className="flex flex-col gap-3 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {deck.url ? (
                        <a
                          href={deck.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-base font-semibold text-cyan-300 hover:text-cyan-200"
                        >
                          {deck.name}
                        </a>
                      ) : (
                        <p className="truncate text-base font-semibold text-white">{deck.name}</p>
                      )}
                      {deck.format && <p className="text-xs text-gray-400">{deck.format}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      {deck.url && onOpenInOracle && (
                        <button
                          type="button"
                          onClick={() => onOpenInOracle(deck.url!)}
                          className="inline-flex h-8 w-8 items-center justify-center text-gray-300 hover:text-cyan-300"
                          aria-label={`Open ${deck.name} in Oracle`}
                          title="Open in Oracle"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <circle cx="12" cy="12" r="4" />
                            <path d="M12 2v4" />
                            <path d="M12 18v4" />
                            <path d="M2 12h4" />
                            <path d="M18 12h4" />
                          </svg>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openLogModal(deck)}
                        className="inline-flex h-8 w-8 items-center justify-center text-gray-300 hover:text-emerald-300"
                        aria-label={`Log game for ${deck.name}`}
                        title="Log game"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 8v8" />
                          <path d="M8 12h8" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(deck)}
                        className="inline-flex h-8 w-8 items-center justify-center text-gray-300 hover:text-red-300"
                        aria-label={`Remove ${deck.name}`}
                        title="Delete"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Commander</p>
                    <p className="text-sm text-gray-200">
                      {deck.commanderNames.length > 0 ? deck.commanderNames.join(', ') : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Color identity</p>
                    {deck.colorIdentity ? (
                      <ColorIdentityIcons colors={deck.colorIdentity} />
                    ) : (
                      <span className="text-sm text-gray-500">—</span>
                    )}
                  </div>
                  {deck.stats && deck.stats.totalGames > 0 && (
                    <div className="flex gap-4 text-sm">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">Games</p>
                        <p className="text-gray-200">{deck.stats.totalGames}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">Win %</p>
                        <p className="text-gray-200">{formatWinRate(deck.stats.winRate)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">Last played</p>
                        <p className="text-gray-200">{formatLastPlayed(deck.stats.lastPlayed)}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="hidden sm:block">
              <table className="w-full text-left text-sm text-gray-200">
                <thead className="sticky top-0 z-10 bg-gray-950">
                  <tr className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-3 font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort('name')}
                        className="inline-flex items-center gap-2 hover:text-gray-200"
                      >
                        Deck
                        {sortIndicator('name') && (
                          <span aria-hidden="true">{sortIndicator('name')}</span>
                        )}
                      </button>
                    </th>
                    <th className="border-l border-gray-800 px-4 py-3 font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort('commander')}
                        className="inline-flex items-center gap-2 hover:text-gray-200"
                      >
                        Commander
                        {sortIndicator('commander') && (
                          <span aria-hidden="true">{sortIndicator('commander')}</span>
                        )}
                      </button>
                    </th>
                    <th className="border-l border-gray-800 px-4 py-3 font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort('color')}
                        className="inline-flex items-center gap-2 hover:text-gray-200"
                      >
                        Color identity
                        {sortIndicator('color') && (
                          <span aria-hidden="true">{sortIndicator('color')}</span>
                        )}
                      </button>
                    </th>
                    <th className="border-l border-gray-800 px-4 py-3 font-semibold text-center">
                      Games
                    </th>
                    <th className="border-l border-gray-800 px-4 py-3 font-semibold text-center">
                      Win %
                    </th>
                    <th className="border-l border-gray-800 px-4 py-3 font-semibold">
                      Last played
                    </th>
                    <th className="border-l border-gray-800 px-4 py-3 text-right font-semibold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {sortedDecks.map((deck) => (
                    <tr key={deck.id} className="align-middle">
                      <td className="max-w-48 px-4 py-3">
                        {deck.url ? (
                          <a
                            href={deck.url}
                            target="_blank"
                            rel="noreferrer"
                            title={deck.name}
                            className="block truncate font-semibold text-cyan-300 hover:text-cyan-200"
                          >
                            {deck.name}
                          </a>
                        ) : (
                          <p className="truncate font-semibold text-white" title={deck.name}>{deck.name}</p>
                        )}
                        {deck.format && <p className="text-xs text-gray-400">{deck.format}</p>}
                      </td>
                      <td className="max-w-64 border-l border-gray-800 px-4 py-3">
                        <p
                          className="truncate text-sm text-gray-200"
                          title={deck.commanderNames.length > 0 ? deck.commanderNames.join(', ') : undefined}
                        >
                          {deck.commanderNames.length > 0 ? deck.commanderNames.join(', ') : '—'}
                        </p>
                      </td>
                      <td className="whitespace-nowrap border-l border-gray-800 px-4 py-3">
                        {deck.colorIdentity ? (
                          <ColorIdentityIcons colors={deck.colorIdentity} />
                        ) : (
                          <span className="text-sm text-gray-500">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap border-l border-gray-800 px-4 py-3 text-center text-gray-300">
                        {deck.stats?.totalGames ?? '—'}
                      </td>
                      <td className="whitespace-nowrap border-l border-gray-800 px-4 py-3 text-center text-gray-300">
                        {deck.stats ? formatWinRate(deck.stats.winRate) : '—'}
                      </td>
                      <td className="whitespace-nowrap border-l border-gray-800 px-4 py-3 text-gray-300">
                        {deck.stats ? formatLastPlayed(deck.stats.lastPlayed) : '—'}
                      </td>
                      <td className="whitespace-nowrap border-l border-gray-800 px-2 py-3">
                        <div className="flex justify-end">
                          <div className="h-8 w-8 flex items-center justify-center">
                            {deck.url && onOpenInOracle && (
                              <button
                                type="button"
                                onClick={() => onOpenInOracle(deck.url!)}
                                className="inline-flex h-8 w-8 items-center justify-center text-gray-300 hover:text-cyan-300"
                                aria-label={`Open ${deck.name} in Oracle`}
                                title="Open in Oracle"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  className="h-5 w-5"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <circle cx="12" cy="12" r="10" />
                                  <circle cx="12" cy="12" r="4" />
                                  <path d="M12 2v4" />
                                  <path d="M12 18v4" />
                                  <path d="M2 12h4" />
                                  <path d="M18 12h4" />
                                </svg>
                              </button>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => openLogModal(deck)}
                            className="inline-flex h-8 w-8 items-center justify-center text-gray-300 hover:text-emerald-300"
                            aria-label={`Log game for ${deck.name}`}
                            title="Log game"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <circle cx="12" cy="12" r="9" />
                              <path d="M12 8v8" />
                              <path d="M8 12h8" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(deck)}
                            className="inline-flex h-8 w-8 items-center justify-center text-gray-300 hover:text-red-300"
                            aria-label={`Remove ${deck.name}`}
                            title="Delete"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M19 6l-1 14H6L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {manualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-950/70 px-4 py-6 sm:items-center sm:py-8">
          <div className="w-full max-w-xl rounded-2xl border border-gray-700 bg-gray-900 p-6 sm:p-8">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-lg font-semibold">Add manual deck</h3>
                <p className="text-sm text-gray-400">Enter deck details to save without Archidekt.</p>
              </div>
              <label className="text-sm text-gray-300" htmlFor="manual-deck-name">
                Deck name (required)
              </label>
              <input
                id="manual-deck-name"
                type="text"
                value={manualName}
                onChange={(event) => setManualName(event.target.value)}
                placeholder="My custom deck"
                className="px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <label className="text-sm text-gray-300" htmlFor="manual-deck-commander">
                Commander name(s) (optional)
              </label>
              <input
                id="manual-deck-commander"
                type="text"
                value={manualCommander}
                onChange={(event) => setManualCommander(event.target.value)}
                placeholder="Atraxa, Praetors' Voice"
                className="px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <ColorIdentitySelect
                label="Color identity (optional)"
                value={manualColor}
                onChange={setManualColor}
              />
              {manualError && <p className="text-red-400">{manualError}</p>}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    resetManualForm();
                    closeManualModal();
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddManualDeck}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-cyan-500 text-gray-900 font-semibold hover:bg-cyan-400 disabled:opacity-60"
                >
                  {loading ? 'Saving...' : 'Add Deck'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {logTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-950/70 px-4 py-6 sm:items-center sm:py-8">
          <div className="w-full max-w-3xl rounded-2xl border border-gray-700 bg-gray-900 p-6 sm:p-8">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Log a game</h3>
                  <p className="text-sm text-gray-400">{logTarget.name}</p>
                </div>
                {logStatusMessage && (
                  <span className="text-xs text-emerald-300">{logStatusMessage}</span>
                )}
              </div>
              <label className="flex flex-col gap-2 text-sm text-gray-300">
                Date played
                <input
                  type="date"
                  value={logDate}
                  onChange={(event) => setLogDate(event.target.value)}
                  className="px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </label>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-300">Opponents</p>
                  {logOpponents.length === 0 && (
                    <button
                      type="button"
                      onClick={addLogOpponent}
                      className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
                      </svg>
                      Add opponent
                    </button>
                  )}
                </div>
                {logOpponents.length === 0 && (
                  <p className="text-xs text-gray-500">No opponents added yet.</p>
                )}
                {logOpponents.map((opponent, index) => (
                  <div
                    key={`${logTarget.id}-opponent-${index}`}
                    className="rounded-lg border border-gray-700 bg-gray-800/50 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={opponent.name}
                        onChange={(event) => updateLogOpponent(index, 'name', event.target.value)}
                        placeholder="Name"
                        className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-gray-800 text-white text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                      <input
                        type="text"
                        value={opponent.commander}
                        onChange={(event) => updateLogOpponent(index, 'commander', event.target.value)}
                        placeholder="Commander"
                        className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-gray-800 text-white text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                      <div className="flex-1 min-w-0">
                        <ColorIdentitySelect
                          label=""
                          value={opponent.colorIdentity}
                          onChange={(value) => updateLogOpponent(index, 'colorIdentity', value)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLogOpponent(index)}
                        className="text-gray-500 hover:text-red-400 p-1"
                        aria-label={`Remove opponent ${index + 1}`}
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
                {logOpponents.length > 0 && (
                  <button
                    type="button"
                    onClick={addLogOpponent}
                    className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-gray-600 py-2 text-sm text-gray-400 hover:border-gray-500 hover:text-gray-300"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
                    </svg>
                    Add another opponent
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLogResult('win')}
                    className={`px-4 py-2 rounded-full text-sm border transition ${
                      logResult === 'win'
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                        : 'border-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    Win
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogResult('loss')}
                    className={`px-4 py-2 rounded-full text-sm border transition ${
                      logResult === 'loss'
                        ? 'border-rose-400 bg-rose-500/20 text-rose-100'
                        : 'border-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    Loss
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogResult('pending')}
                    className={`px-4 py-2 rounded-full text-sm border transition ${
                      logResult === 'pending'
                        ? 'border-gray-400 bg-gray-700/40 text-gray-100'
                        : 'border-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    Later
                  </button>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={logGoodGame}
                    onChange={(event) => setLogGoodGame(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-600 text-cyan-500 focus:ring-cyan-500"
                  />
                  Good game?
                </label>
              </div>
              {(logFormError || logError) && (
                <p className="text-xs text-red-400">{logFormError || logError}</p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setLogTarget(null);
                    resetLogForm();
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveLog}
                  disabled={logLoading}
                  className="px-4 py-2 rounded-lg bg-cyan-500 text-gray-900 font-semibold hover:bg-cyan-400 disabled:opacity-60"
                >
                  {logLoading ? 'Saving...' : 'Save log'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-950/70 px-4 py-6 sm:items-center sm:py-8">
          <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 sm:p-8">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-lg font-semibold">Remove deck?</h3>
                <p className="text-sm text-gray-400">
                  This will remove <span className="text-gray-200">{deleteTarget.name}</span> from your collection.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const deckId = deleteTarget.id;
                    setDeleteTarget(null);
                    await onRemoveDeck(deckId);
                  }}
                  className="px-4 py-2 rounded-lg bg-red-500/80 text-white font-semibold hover:bg-red-500"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
