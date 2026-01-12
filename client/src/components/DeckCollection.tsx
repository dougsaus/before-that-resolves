import { useEffect, useMemo, useState } from 'react';
import { ColorIdentityIcons, ColorIdentitySelect } from './ColorIdentitySelect';
import { getColorIdentityLabel, sortColorsForDisplay } from '../utils/color-identity';
import { useGameLogs } from '../hooks/useGameLogs';

function formatWinRate(winRate: number | null): string {
  if (winRate === null) return '—';
  return `${Math.round(winRate * 100)}%`;
}

function parseLocalDate(input: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(input);
}

function formatLastPlayed(lastPlayed: string | null): string {
  if (!lastPlayed) return '—';
  const date = parseLocalDate(lastPlayed);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isArchidektUrl(input: string): boolean {
  if (!input.trim()) return false;
  try {
    const parsed = new URL(input);
    return parsed.host.includes('archidekt.com') && parsed.pathname.includes('/decks/');
  } catch {
    return false;
  }
}

function formatColorValue(colors: string[] | null): string {
  if (!colors) return '';
  if (colors.length === 0) return 'C';
  return sortColorsForDisplay(colors).join('');
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
  commanderNames: string[];
  colorIdentity: string[] | null;
  source: 'archidekt' | 'manual';
  addedAt: string;
  stats: DeckStats | null;
};

export type DeckFormInput = {
  deckId?: string;
  name: string;
  url?: string | null;
  commanderNames?: string;
  colorIdentity?: string[];
};

export type DeckPreview = {
  id: string;
  name: string;
  url: string;
  commanderNames: string[];
  colorIdentity: string[];
};

export type DeckPreviewResult = {
  deck?: DeckPreview;
  error?: string;
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
  onCreateDeck: (input: DeckFormInput) => Promise<boolean>;
  onUpdateDeck: (deckId: string, input: DeckFormInput) => Promise<boolean>;
  onPreviewDeck: (deckUrl: string) => Promise<DeckPreviewResult>;
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
  onCreateDeck,
  onUpdateDeck,
  onPreviewDeck,
  onRemoveDeck,
  onOpenInOracle,
  onRefreshDecks
}: DeckCollectionProps) {
  type SortKey = 'name' | 'commander' | 'color' | 'games' | 'wins' | 'lastPlayed';
  const sortStorageKey = 'btr:deck-sort';
  const sortKeys: SortKey[] = ['name', 'commander', 'color', 'games', 'wins', 'lastPlayed'];
  const loadSortPrefs = (): { key: SortKey; dir: 'asc' | 'desc' } | null => {
    try {
      const raw = localStorage.getItem(sortStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { key?: string; dir?: string };
      const key = sortKeys.find((option) => option === parsed.key);
      const dir = parsed.dir === 'asc' || parsed.dir === 'desc' ? parsed.dir : null;
      if (!key || !dir) return null;
      return { key, dir };
    } catch {
      return null;
    }
  };
  const initialSort = loadSortPrefs();
  const [deckId, setDeckId] = useState<string | null>(null);
  const [deckUrl, setDeckUrl] = useState('');
  const [deckName, setDeckName] = useState('');
  const [deckCommander, setDeckCommander] = useState('');
  const [deckColor, setDeckColor] = useState('');
  const [deckFormError, setDeckFormError] = useState<string | null>(null);
  const [deckPreviewError, setDeckPreviewError] = useState<string | null>(null);
  const [deckModalOpen, setDeckModalOpen] = useState(false);
  const [deckPreviewLoading, setDeckPreviewLoading] = useState(false);
  const [editTarget, setEditTarget] = useState<DeckEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeckEntry | null>(null);
  const [logTarget, setLogTarget] = useState<DeckEntry | null>(null);
  const [logDate, setLogDate] = useState('');
  const [logOpponents, setLogOpponents] = useState<OpponentForm[]>([]);
  const [logResult, setLogResult] = useState<'win' | 'loss' | 'pending'>('pending');
  const [logGoodGame, setLogGoodGame] = useState(true);
  const [logFormError, setLogFormError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>(() => initialSort?.key ?? 'name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => initialSort?.dir ?? 'asc');
  const sortLabels: Record<SortKey, string> = {
    name: 'Deck name',
    commander: 'Commander',
    color: 'Color identity',
    games: 'Games played',
    wins: 'Wins',
    lastPlayed: 'Last played'
  };
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const {
    addLog,
    error: logError,
    loading: logLoading,
    statusMessage: logStatusMessage
  } = useGameLogs(idToken, { autoLoad: false });
  useEffect(() => {
    localStorage.setItem(sortStorageKey, JSON.stringify({ key: sortKey, dir: sortDir }));
  }, [sortKey, sortDir]);
  const sortedDecks = useMemo(() => {
    const sorted = [...decks];
    const direction = sortDir === 'asc' ? 1 : -1;
    const getCommanderValue = (deck: DeckEntry) => deck.commanderNames[0] ?? '';
    const getColorValue = (deck: DeckEntry) => {
      if (!deck.colorIdentity) return '';
      return sortColorsForDisplay(deck.colorIdentity).join('');
    };
    const getGamesValue = (deck: DeckEntry) => deck.stats?.totalGames ?? 0;
    const getWinsValue = (deck: DeckEntry) => deck.stats?.wins ?? 0;
    const getLastPlayedValue = (deck: DeckEntry) =>
      deck.stats?.lastPlayed ? parseLocalDate(deck.stats.lastPlayed).getTime() : 0;
    sorted.sort((a, b) => {
      if (sortKey === 'games') {
        return (getGamesValue(a) - getGamesValue(b)) * direction;
      }
      if (sortKey === 'wins') {
        return (getWinsValue(a) - getWinsValue(b)) * direction;
      }
      if (sortKey === 'lastPlayed') {
        return (getLastPlayedValue(a) - getLastPlayedValue(b)) * direction;
      }
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

  const handleSortChange = (key: SortKey) => {
    setSortKey(key);
    const defaultDir = key === 'games' || key === 'wins' || key === 'lastPlayed' ? 'desc' : 'asc';
    setSortDir(defaultDir);
  };

  const resetDeckForm = () => {
    setDeckId(null);
    setDeckUrl('');
    setDeckName('');
    setDeckCommander('');
    setDeckColor('');
    setDeckFormError(null);
    setDeckPreviewError(null);
    setDeckPreviewLoading(false);
  };

  const openAddModal = () => {
    setEditTarget(null);
    resetDeckForm();
    setDeckModalOpen(true);
  };

  const openEditModal = (deck: DeckEntry) => {
    setEditTarget(deck);
    setDeckId(deck.id);
    setDeckUrl(deck.url ?? '');
    setDeckName(deck.name);
    setDeckCommander(deck.commanderNames.join(', '));
    setDeckColor(formatColorValue(deck.colorIdentity));
    setDeckFormError(null);
    setDeckPreviewError(null);
    setDeckPreviewLoading(false);
    setDeckModalOpen(true);
  };

  const closeDeckModal = () => {
    setDeckModalOpen(false);
    setEditTarget(null);
    setDeckPreviewLoading(false);
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

  const handlePreviewDeck = async () => {
    const trimmedUrl = deckUrl.trim();
    if (!isArchidektUrl(trimmedUrl)) return;
    setDeckPreviewError(null);
    setDeckPreviewLoading(true);
    const result = await onPreviewDeck(trimmedUrl);
    setDeckPreviewLoading(false);
    if (!result.deck) {
      setDeckPreviewError(result.error || 'Unable to load deck.');
      return;
    }
    const { deck } = result;
    setDeckName(deck.name);
    setDeckCommander(deck.commanderNames.join(', '));
    setDeckColor(formatColorValue(deck.colorIdentity));
    setDeckUrl(deck.url);
    if (!editTarget) {
      setDeckId(deck.id);
    }
  };

  const handleSaveDeck = async () => {
    if (!deckName.trim()) {
      setDeckFormError('Deck name is required.');
      return;
    }
    setDeckFormError(null);
    const input: DeckFormInput = {
      name: deckName.trim(),
      url: deckUrl.trim() ? deckUrl.trim() : null,
      commanderNames: deckCommander.trim() || undefined
    };
    if (deckColor === 'C') {
      input.colorIdentity = [];
    } else if (deckColor) {
      input.colorIdentity = deckColor.split('');
    }
    const saved = editTarget
      ? await onUpdateDeck(editTarget.id, input)
      : await onCreateDeck({ ...input, ...(deckId ? { deckId } : {}) });
    if (!saved) return;
    resetDeckForm();
    closeDeckModal();
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
      {deckError && <p className="text-red-400">{deckError}</p>}
      <div className="bg-gray-900/70 border border-gray-700 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Your Deck Collection</h3>
            <p className="text-sm text-gray-400">
              Save decks, track stats, and launch Oracle tools from a single list.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-gray-900 shadow hover:bg-cyan-400"
          >
            <span className="text-lg leading-none">+</span>
            Deck
          </button>
        </div>
        <div className="mt-6">
          {loading && <p className="text-gray-400">Loading...</p>}
          {!loading && decks.length === 0 && (
            <p className="text-gray-400">No decks yet. Use + Deck to add your first deck.</p>
          )}
          {decks.length > 0 && (
            <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-gray-800 bg-gray-950/60 sm:max-h-[60vh]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 px-4 py-2">
                <span className="text-xs uppercase tracking-wide text-gray-500">Decks</span>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <label className="text-xs uppercase tracking-wide text-gray-500" htmlFor="deck-sort">
                    Sort
                  </label>
                  <select
                    id="deck-sort"
                    value={sortKey}
                    onChange={(event) => handleSortChange(event.target.value as SortKey)}
                    className="rounded-md border border-gray-700 bg-gray-900/80 px-2 py-1 text-xs text-gray-200"
                  >
                    {Object.entries(sortLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                    className="rounded-md border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-200 hover:border-cyan-400 hover:text-cyan-200"
                    aria-label={`Sort ${sortDir === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    {sortDir === 'asc' ? '^' : 'v'}
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-800">
                {sortedDecks.map((deck) => (
                  <div key={deck.id} className="flex flex-col gap-1 px-4 py-2">
                    <div className="grid grid-cols-[minmax(0,1fr)_6rem_6rem] grid-rows-[auto_auto] items-center gap-x-3 gap-y-0.5 sm:grid-cols-[minmax(0,1fr)_8rem_8rem] sm:gap-x-4">
                      <div className="min-w-0 row-start-1 col-start-1">
                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                          {deck.url ? (
                            <a
                              href={deck.url}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-sm font-semibold text-cyan-300 hover:text-cyan-200 sm:text-base"
                            >
                              {deck.name}
                            </a>
                          ) : (
                            <p className="truncate text-sm font-semibold text-white sm:text-base">{deck.name}</p>
                          )}
                          {deck.commanderNames.length > 0 && (
                            <span className="truncate text-xs text-gray-400 sm:text-sm">
                              {deck.commanderNames.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="row-start-1 col-start-2 flex w-24 items-center justify-start justify-self-start text-left pr-1 sm:w-32 sm:pr-2">
                        {deck.colorIdentity && <ColorIdentityIcons colors={deck.colorIdentity} />}
                      </div>
                      <div className="row-start-1 col-start-3 flex w-24 items-center justify-end gap-0.5 sm:w-32 sm:gap-1">
                        {deck.url && onOpenInOracle && isArchidektUrl(deck.url) && (
                          <button
                            type="button"
                            onClick={() => onOpenInOracle(deck.url!)}
                            className="inline-flex h-7 w-7 items-center justify-center text-gray-300 hover:text-cyan-300 sm:h-8 sm:w-8"
                            aria-label={`Open ${deck.name} in Oracle`}
                            title="Open in Oracle"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="h-4 w-4 sm:h-5 sm:w-5"
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
                          onClick={() => openEditModal(deck)}
                          className="inline-flex h-7 w-7 items-center justify-center text-gray-300 hover:text-cyan-300 sm:h-8 sm:w-8"
                          aria-label={`Edit ${deck.name}`}
                          title="Edit deck"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4 sm:h-5 sm:w-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => openLogModal(deck)}
                          className="inline-flex h-7 w-7 items-center justify-center text-gray-300 hover:text-emerald-300 sm:h-8 sm:w-8"
                          aria-label={`Log game for ${deck.name}`}
                          title="Log game"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4 sm:h-5 sm:w-5"
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
                          className="inline-flex h-7 w-7 items-center justify-center text-gray-300 hover:text-red-300 sm:h-8 sm:w-8"
                          aria-label={`Remove ${deck.name}`}
                          title="Delete"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4 sm:h-5 sm:w-5"
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
                      <div className="row-start-2 col-start-1 grid grid-cols-[4.5rem_3.5rem_4rem_7rem] items-center gap-2 text-[11px] text-gray-400 sm:grid-cols-[5rem_4rem_4.5rem_8.5rem] sm:gap-3 sm:text-xs">
                        <span>
                          Games <span className="text-gray-200">{deck.stats?.totalGames ?? 0}</span>
                        </span>
                        {deck.stats && deck.stats.totalGames > 0 ? (
                          <>
                            <span>
                              Wins <span className="text-gray-200">{deck.stats.wins}</span>
                            </span>
                            <span>
                              Rate <span className="text-gray-200">{formatWinRate(deck.stats.winRate)}</span>
                            </span>
                            <span className="whitespace-nowrap">
                              Last played{' '}
                              <span className="text-gray-200">
                                {formatLastPlayed(deck.stats.lastPlayed)}
                              </span>
                            </span>
                          </>
                        ) : (
                          <>
                            <span aria-hidden="true" />
                            <span aria-hidden="true" />
                            <span aria-hidden="true" />
                          </>
                        )}
                      </div>
                      <div className="row-start-2 col-start-2 flex w-24 items-start justify-start justify-self-start text-left pr-1 sm:w-32 sm:pr-2">
                        {deck.colorIdentity && (
                          <span className="text-[10px] uppercase tracking-wide text-gray-500">
                            {getColorIdentityLabel(deck.colorIdentity)}
                          </span>
                        )}
                      </div>
                      <div className="row-start-2 col-start-3" aria-hidden="true" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    </div>

      {deckModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-950/70 px-4 py-6 sm:items-center sm:py-8">
          <div className="w-full max-w-xl rounded-2xl border border-gray-700 bg-gray-900 p-6 sm:p-8">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-lg font-semibold">{editTarget ? 'Edit deck' : 'Add deck'}</h3>
                <p className="text-sm text-gray-400">
                  Add a deck link to auto-fill details from Archidekt or enter them manually.
                </p>
              </div>
              <label className="text-sm text-gray-300" htmlFor="deck-link-input">
                Deck link (optional)
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="deck-link-input"
                  type="url"
                  value={deckUrl}
                  onChange={(event) => {
                    setDeckUrl(event.target.value);
                    setDeckPreviewError(null);
                  }}
                  placeholder="https://..."
                  className="flex-1 px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={handlePreviewDeck}
                  disabled={!isArchidektUrl(deckUrl) || deckPreviewLoading}
                  className="px-4 py-3 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800 disabled:opacity-60"
                >
                  {deckPreviewLoading ? 'Loading...' : 'Load deck'}
                </button>
              </div>
              <p className="text-xs text-gray-500">Load deck supports Archidekt deck links.</p>
              <label className="text-sm text-gray-300" htmlFor="deck-name-input">
                Deck name (required)
              </label>
                <input
                  id="deck-name-input"
                  type="text"
                  value={deckName}
                  onChange={(event) => {
                    setDeckName(event.target.value);
                    setDeckFormError(null);
                  }}
                  placeholder="My custom deck"
                  className="px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              <label className="text-sm text-gray-300" htmlFor="deck-commander-input">
                Commander name(s) (optional)
              </label>
              <input
                id="deck-commander-input"
                type="text"
                value={deckCommander}
                onChange={(event) => setDeckCommander(event.target.value)}
                placeholder="Atraxa, Praetors' Voice"
                className="px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <ColorIdentitySelect
                label="Color identity (optional)"
                value={deckColor}
                onChange={setDeckColor}
              />
              {(deckFormError || deckPreviewError) && (
                <p className="text-red-400">{deckFormError || deckPreviewError}</p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    resetDeckForm();
                    closeDeckModal();
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDeck}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-cyan-500 text-gray-900 font-semibold hover:bg-cyan-400 disabled:opacity-60"
                >
                  {loading ? 'Saving...' : editTarget ? 'Save Deck' : 'Add Deck'}
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
