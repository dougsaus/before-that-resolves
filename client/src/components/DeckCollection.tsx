import { useEffect, useMemo, useRef, useState } from 'react';
import { ManaSymbol } from './ManaSymbol';

export type DeckEntry = {
  id: string;
  name: string;
  url: string | null;
  format: string | null;
  commanderNames: string[];
  colorIdentity: string[] | null;
  source: 'archidekt' | 'manual';
  addedAt: string;
};

export type ManualDeckInput = {
  name: string;
  commanderNames?: string;
  colorIdentity?: string[];
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
};

type ColorOption = {
  value: string;
  label: string;
  colors: string[] | null;
};

const WUBRG_ORDER = ['W', 'U', 'B', 'R', 'G'] as const;
const WUBRG_INDEX: Record<(typeof WUBRG_ORDER)[number], number> = {
  W: 0,
  U: 1,
  B: 2,
  R: 3,
  G: 4
};

const COLOR_OPTIONS: ColorOption[] = [
  { value: '', label: 'No color identity', colors: null },
  { value: 'C', label: 'Colorless', colors: [] },
  { value: 'W', label: 'White', colors: ['W'] },
  { value: 'U', label: 'Blue', colors: ['U'] },
  { value: 'B', label: 'Black', colors: ['B'] },
  { value: 'R', label: 'Red', colors: ['R'] },
  { value: 'G', label: 'Green', colors: ['G'] },
  { value: 'WU', label: 'Azorius', colors: ['W', 'U'] },
  { value: 'UB', label: 'Dimir', colors: ['U', 'B'] },
  { value: 'BR', label: 'Rakdos', colors: ['B', 'R'] },
  { value: 'RG', label: 'Gruul', colors: ['R', 'G'] },
  { value: 'GW', label: 'Selesnya', colors: ['G', 'W'] },
  { value: 'WB', label: 'Orzhov', colors: ['W', 'B'] },
  { value: 'UR', label: 'Izzet', colors: ['U', 'R'] },
  { value: 'BG', label: 'Golgari', colors: ['B', 'G'] },
  { value: 'RW', label: 'Boros', colors: ['R', 'W'] },
  { value: 'GU', label: 'Simic', colors: ['G', 'U'] },
  { value: 'WUB', label: 'Esper', colors: ['W', 'U', 'B'] },
  { value: 'UBR', label: 'Grixis', colors: ['U', 'B', 'R'] },
  { value: 'BRG', label: 'Jund', colors: ['B', 'R', 'G'] },
  { value: 'RGW', label: 'Naya', colors: ['R', 'G', 'W'] },
  { value: 'GWU', label: 'Bant', colors: ['G', 'W', 'U'] },
  { value: 'WBG', label: 'Abzan', colors: ['W', 'B', 'G'] },
  { value: 'URW', label: 'Jeskai', colors: ['U', 'R', 'W'] },
  { value: 'BGU', label: 'Sultai', colors: ['B', 'G', 'U'] },
  { value: 'RWB', label: 'Mardu', colors: ['R', 'W', 'B'] },
  { value: 'GRU', label: 'Temur', colors: ['G', 'R', 'U'] },
  { value: 'UBRG', label: 'Glint-Eye', colors: ['U', 'B', 'R', 'G'] },
  { value: 'BRGW', label: 'Dune-Brood', colors: ['B', 'R', 'G', 'W'] },
  { value: 'RGWU', label: 'Ink-Treader', colors: ['R', 'G', 'W', 'U'] },
  { value: 'GWUB', label: 'Witch-Maw', colors: ['G', 'W', 'U', 'B'] },
  { value: 'WUBR', label: 'Yore-Tiller', colors: ['W', 'U', 'B', 'R'] },
  { value: 'WUBRG', label: 'Maelstrom', colors: ['W', 'U', 'B', 'R', 'G'] }
];

const COLOR_IDENTITY_DISPLAY_MAP: Record<string, string[]> = COLOR_OPTIONS.reduce((map, option) => {
  if (!option.colors) {
    return map;
  }
  const key =
    option.colors.length === 0
      ? 'C'
      : [...option.colors]
          .sort((a, b) => WUBRG_INDEX[a as keyof typeof WUBRG_INDEX] - WUBRG_INDEX[b as keyof typeof WUBRG_INDEX])
          .join('');
  map[key] = option.colors;
  return map;
}, {} as Record<string, string[]>);

function buildColorOptions(): ColorOption[] {
  return COLOR_OPTIONS;
}

function sortColorsForDisplay(colors: string[]): string[] {
  if (colors.length === 0) return ['C'];
  const key = [...colors]
    .filter((color) => color !== 'C')
    .sort((a, b) => WUBRG_INDEX[a as keyof typeof WUBRG_INDEX] - WUBRG_INDEX[b as keyof typeof WUBRG_INDEX])
    .join('');
  return COLOR_IDENTITY_DISPLAY_MAP[key] ?? colors;
}

function ColorIdentityIcons({ colors }: { colors: string[] }) {
  const displayColors = sortColorsForDisplay(colors);
  return (
    <span className="inline-flex items-center gap-1">
      {displayColors.map((color) => (
        <ManaSymbol key={color} symbol={`{${color}}`} size="small" />
      ))}
    </span>
  );
}

export function DeckCollection({
  enabled,
  idToken,
  decks,
  loading,
  deckError,
  onAddArchidektDeck,
  onAddManualDeck,
  onRemoveDeck
}: DeckCollectionProps) {
  const [deckUrl, setDeckUrl] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualCommander, setManualCommander] = useState('');
  const [manualColor, setManualColor] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeckEntry | null>(null);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [sortKey, setSortKey] = useState<'name' | 'commander' | 'color'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const colorMenuRef = useRef<HTMLDivElement | null>(null);
  const colorOptions = useMemo(() => buildColorOptions(), []);
  const selectedColor = colorOptions.find((option) => option.value === manualColor) || colorOptions[0];
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

  useEffect(() => {
    if (!colorMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!colorMenuRef.current) return;
      if (!colorMenuRef.current.contains(event.target as Node)) {
        setColorMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [colorMenuOpen]);

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
    setColorMenuOpen(false);
  };

  const openManualModal = () => {
    setManualError(null);
    setManualModalOpen(true);
  };

  const closeManualModal = () => {
    setManualModalOpen(false);
    setColorMenuOpen(false);
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
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(deck)}
                      className="inline-flex h-10 w-10 items-center justify-center text-gray-300 hover:text-red-300"
                      aria-label={`Remove ${deck.name}`}
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
                </div>
              ))}
            </div>
            <div className="hidden sm:block">
              <table className="w-full table-fixed text-left text-sm text-gray-200">
                <colgroup>
                  <col className="w-[40%]" />
                  <col className="w-[35%]" />
                  <col className="w-[20%]" />
                  <col className="w-[5%]" />
                </colgroup>
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
                    <th className="border-l border-gray-800 px-4 py-3 text-center font-semibold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {sortedDecks.map((deck) => (
                    <tr key={deck.id} className="align-middle">
                      <td className="px-4 py-3">
                        {deck.url ? (
                          <a
                            href={deck.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate font-semibold text-cyan-300 hover:text-cyan-200"
                          >
                            {deck.name}
                          </a>
                        ) : (
                          <p className="truncate font-semibold text-white">{deck.name}</p>
                        )}
                        {deck.format && <p className="text-xs text-gray-400">{deck.format}</p>}
                      </td>
                      <td className="border-l border-gray-800 px-4 py-3">
                        <p className="truncate text-sm text-gray-200">
                          {deck.commanderNames.length > 0 ? deck.commanderNames.join(', ') : '—'}
                        </p>
                      </td>
                      <td className="border-l border-gray-800 px-4 py-3">
                        {deck.colorIdentity ? (
                          <ColorIdentityIcons colors={deck.colorIdentity} />
                        ) : (
                          <span className="text-sm text-gray-500">—</span>
                        )}
                      </td>
                      <td className="border-l border-gray-800 px-4 py-3">
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(deck)}
                            className="inline-flex h-10 w-10 items-center justify-center text-gray-300 hover:text-red-300"
                            aria-label={`Remove ${deck.name}`}
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
              <div className="flex flex-col gap-2">
                <span className="text-sm text-gray-300">Color identity (optional)</span>
                <div ref={colorMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setColorMenuOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-left text-sm text-gray-200 hover:border-gray-600"
                  >
                    <span className="flex items-center gap-2">
                      {selectedColor.colors && <ColorIdentityIcons colors={selectedColor.colors} />}
                      <span className="text-gray-300">{selectedColor.label}</span>
                    </span>
                    <span className="text-xs text-gray-400">{colorMenuOpen ? 'Close' : 'Select'}</span>
                  </button>
                  {colorMenuOpen && (
                    <div className="absolute z-10 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-950/95 p-2 shadow-lg">
                      {colorOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setManualColor(option.value);
                            setColorMenuOpen(false);
                          }}
                          className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-gray-800 ${
                            option.value === selectedColor.value ? 'bg-gray-800 text-white' : 'text-gray-200'
                          }`}
                        >
                          {option.colors && <ColorIdentityIcons colors={option.colors} />}
                          <span className="text-gray-300">{option.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
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
