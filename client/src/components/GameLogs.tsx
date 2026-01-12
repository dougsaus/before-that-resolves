import { useMemo, useState } from 'react';
import { ColorIdentityIcons, ColorIdentitySelect } from './ColorIdentitySelect';
import { useGameLogs } from '../hooks/useGameLogs';

type GameLogsProps = {
  enabled: boolean;
  idToken: string | null;
};

function formatDate(value: string): string {
  // Append time to treat date-only strings as local time, not UTC
  const parsed = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function truncateLabel(value: string, maxLength = 12): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}

function formatGameLength(durationMinutes: number | null, turns: number | null): string {
  const parts: string[] = [];
  if (durationMinutes) {
    parts.push(`${durationMinutes}m`);
  }
  if (turns) {
    parts.push(`${turns} turns`);
  }
  if (parts.length === 0) return '';
  return `Game Length: ${parts.join(', ')}`;
}

type OpponentForm = {
  name: string;
  commander: string;
  colorIdentity: string;
};

export function GameLogs({ enabled, idToken }: GameLogsProps) {
  const { logs, loading, error, removeLog, updateLog } = useGameLogs(idToken);
  type SortKey = 'playedAt' | 'deckName' | 'result' | 'durationMinutes' | 'turns';
  const sortStorageKey = 'btr:game-logs-sort';
  const sortKeys: SortKey[] = ['playedAt', 'deckName', 'result', 'durationMinutes', 'turns'];
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
  const [sortKey, setSortKey] = useState<SortKey>(() => initialSort?.key ?? 'playedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => initialSort?.dir ?? 'desc');
  const [editTarget, setEditTarget] = useState<{
    id: string;
    deckName: string;
  } | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTurns, setEditTurns] = useState('');
  const [editDurationMinutes, setEditDurationMinutes] = useState('');
  const [editOpponents, setEditOpponents] = useState<OpponentForm[]>([]);
  const [editResult, setEditResult] = useState<'win' | 'loss' | 'pending'>('pending');
  const [editFormError, setEditFormError] = useState<string | null>(null);

  const openEditModal = (log: (typeof logs)[number]) => {
    setEditTarget({ id: log.id, deckName: log.deckName });
    setEditDate(log.playedAt);
    setEditTurns(log.turns ? String(log.turns) : '');
    setEditDurationMinutes(log.durationMinutes ? String(log.durationMinutes) : '');
    setEditOpponents(
      log.opponents.map((opponent) => ({
        name: opponent.name ?? '',
        commander: opponent.commander ?? '',
        colorIdentity: opponent.colorIdentity ? opponent.colorIdentity.join('') : ''
      }))
    );
    setEditResult(log.result ?? 'pending');
    setEditFormError(null);
  };

  const parseOptionalNumberInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  };

  const addEditOpponent = () => {
    setEditOpponents((current) => [...current, { name: '', commander: '', colorIdentity: '' }]);
  };

  const removeEditOpponent = (index: number) => {
    setEditOpponents((current) => current.filter((_, i) => i !== index));
  };

  const updateEditOpponent = (index: number, field: keyof OpponentForm, value: string) => {
    setEditOpponents((current) => {
      const next = [...current];
      const target = next[index] ?? { name: '', commander: '', colorIdentity: '' };
      next[index] = { ...target, [field]: value };
      return next;
    });
  };

  const handleSaveEdit = async () => {
    if (!editTarget) {
      setEditFormError('Choose a log to edit.');
      return;
    }
    setEditFormError(null);
    const success = await updateLog(editTarget.id, {
      datePlayed: editDate,
      turns: parseOptionalNumberInput(editTurns),
      durationMinutes: parseOptionalNumberInput(editDurationMinutes),
      opponentsCount: editOpponents.length,
      opponents: editOpponents.map((opponent) => ({
        name: opponent.name.trim(),
        commander: opponent.commander.trim(),
        colorIdentity: opponent.colorIdentity.trim()
      })),
      result: editResult === 'pending' ? null : editResult
    });
    if (success) {
      setEditTarget(null);
    }
  };

  const sortLabels: Record<SortKey, string> = {
    playedAt: 'Date played',
    deckName: 'Deck name',
    result: 'Win/Loss',
    durationMinutes: 'Game length (minutes)',
    turns: 'Game length (turns)'
  };

  const handleSortChange = (key: SortKey) => {
    setSortKey(key);
    try {
      localStorage.setItem(sortStorageKey, JSON.stringify({ key, dir: sortDir }));
    } catch {
      // Ignore storage errors in private mode.
    }
  };

  const handleSortDirToggle = () => {
    setSortDir((prev) => {
      const next = prev === 'asc' ? 'desc' : 'asc';
      try {
        localStorage.setItem(sortStorageKey, JSON.stringify({ key: sortKey, dir: next }));
      } catch {
        // Ignore storage errors in private mode.
      }
      return next;
    });
  };

  const sortedLogs = useMemo(() => {
    const list = [...logs];
    const compare = (a: number, b: number) => (sortDir === 'asc' ? a - b : b - a);
    const compareStrings = (a: string, b: string) =>
      sortDir === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
    list.sort((first, second) => {
      switch (sortKey) {
        case 'deckName':
          return compareStrings(first.deckName, second.deckName);
        case 'result': {
          const rank = (value: typeof first.result) =>
            value === 'win' ? 2 : value === 'loss' ? 1 : 0;
          return compare(rank(first.result), rank(second.result));
        }
        case 'durationMinutes': {
          const missingValue = sortDir === 'asc' ? Number.POSITIVE_INFINITY : -1;
          const aValue = first.durationMinutes ?? missingValue;
          const bValue = second.durationMinutes ?? missingValue;
          return compare(aValue, bValue);
        }
        case 'turns': {
          const missingValue = sortDir === 'asc' ? Number.POSITIVE_INFINITY : -1;
          const aValue = first.turns ?? missingValue;
          const bValue = second.turns ?? missingValue;
          return compare(aValue, bValue);
        }
        case 'playedAt':
        default: {
          const aValue = new Date(first.playedAt).getTime();
          const bValue = new Date(second.playedAt).getTime();
          return compare(aValue, bValue);
        }
      }
    });
    return list;
  }, [logs, sortDir, sortKey]);

  if (!enabled) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-gray-900/70 border border-gray-700 rounded-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-semibold mb-3">Game Logs</h2>
        <p className="text-gray-300">
          Google login is not configured. Set `VITE_GOOGLE_CLIENT_ID` to enable game logs.
        </p>
      </div>
    );
  }

  if (!idToken) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-gray-900/70 border border-gray-700 rounded-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-semibold mb-3">Game Logs</h2>
        <p className="text-gray-300">
          Sign in from the Profile page to start logging games.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto flex h-full min-h-0 flex-col gap-6">
      {error && <p className="text-red-400">{error}</p>}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-gray-900/70 border border-gray-700 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Game Logs</h3>
            <p className="text-sm text-gray-400">
              Review recent Commander games logged from your deck list.
            </p>
          </div>
          {logs.length > 0 && <span className="text-xs text-gray-500">{logs.length} total</span>}
        </div>

        <div className="mt-6 flex flex-1 min-h-0 flex-col overflow-hidden">
          {loading && <p className="text-gray-400">Loading game logs...</p>}
          {!loading && !error && logs.length === 0 && (
            <p className="text-gray-400">No games logged yet.</p>
          )}

          {!loading && logs.length > 0 && (
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-gray-800 bg-gray-950/60">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 px-4 py-2">
                <span className="text-xs uppercase tracking-wide text-gray-500">Logs</span>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <label className="text-xs uppercase tracking-wide text-gray-500" htmlFor="game-log-sort">
                    Sort
                  </label>
                  <select
                    id="game-log-sort"
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
                    onClick={handleSortDirToggle}
                    className="rounded-md border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-200 hover:border-cyan-400 hover:text-cyan-200"
                    aria-label={`Sort ${sortDir === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    {sortDir === 'asc' ? '^' : 'v'}
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-scroll divide-y divide-gray-800">
                {sortedLogs.map((log) => (
                  <div key={log.id} className="flex flex-col gap-1 px-4 py-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(6rem,6.5rem)_minmax(10rem,1fr)_minmax(4.5rem,4.5rem)_minmax(12rem,1fr)_auto] sm:items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wide text-gray-500 sm:hidden">
                          Date
                        </span>
                        <span className="text-xs text-gray-400">{formatDate(log.playedAt)}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase tracking-wide text-gray-500 sm:hidden">
                          Deck
                        </span>
                        <h4 className="truncate text-sm font-semibold text-white sm:text-base">
                          {log.deckName}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wide text-gray-500 sm:hidden">
                          Result
                        </span>
                        <span
                          className={`text-xs font-semibold uppercase tracking-wide ${
                            log.result === 'win'
                              ? 'text-emerald-300'
                              : log.result === 'loss'
                                ? 'text-rose-300'
                                : 'text-gray-300'
                          }`}
                        >
                          {log.result ?? 'pending'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-300">
                        <span className="text-[10px] uppercase tracking-wide text-gray-500 sm:hidden">
                          Game Length
                        </span>
                        <span>{formatGameLength(log.durationMinutes, log.turns)}</span>
                      </div>
                      <div className="flex items-center justify-start gap-1 sm:justify-end">
                        <button
                          type="button"
                          onClick={() => openEditModal(log)}
                          className="inline-flex h-7 w-7 items-center justify-center text-gray-300 hover:text-cyan-300"
                          aria-label={`Edit ${log.deckName}`}
                          title="Edit log"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
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
                          onClick={() => removeLog(log.id)}
                          className="inline-flex h-7 w-7 items-center justify-center text-gray-300 hover:text-red-300"
                          aria-label={`Delete ${log.deckName} log`}
                          title="Delete log"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
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

                    {log.opponents.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {log.opponents.map((opponent, index) => (
                          <div
                            key={`${log.id}-opponent-${index}`}
                            className="grid grid-cols-1 gap-2 text-xs text-gray-200 sm:grid-cols-[minmax(6rem,6.5rem)_12ch_5.5rem_minmax(10rem,1fr)] sm:items-center"
                          >
                            <span className="text-[10px] uppercase tracking-wide text-gray-500 sm:text-[11px]">
                              {index === 0 ? 'Opponents:' : ''}
                            </span>
                            <span className="truncate font-medium" title={opponent.name || undefined}>
                              {opponent.name
                                ? truncateLabel(opponent.name)
                                : `Opponent ${index + 1}`}
                            </span>
                            <div className="flex items-center justify-start">
                              {opponent.colorIdentity ? (
                                <ColorIdentityIcons colors={opponent.colorIdentity} />
                              ) : null}
                            </div>
                            <span className="text-gray-400">
                              {opponent.commander || ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-950/70 px-4 py-6 sm:items-center sm:py-8">
          <div className="w-full max-w-3xl rounded-2xl border border-gray-700 bg-gray-900 p-6 sm:p-8">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-lg font-semibold">Edit game log</h3>
                <p className="text-sm text-gray-400">{editTarget.deckName}</p>
              </div>
              <label className="flex flex-col gap-2 text-sm text-gray-300">
                Date played
                <input
                  type="date"
                  value={editDate}
                  onChange={(event) => setEditDate(event.target.value)}
                  className="px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm text-gray-300">
                  Number of turns (optional)
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={editTurns}
                    onChange={(event) => setEditTurns(event.target.value)}
                    className="px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-gray-300">
                  Length (minutes, optional)
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={editDurationMinutes}
                    onChange={(event) => setEditDurationMinutes(event.target.value)}
                    className="px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </label>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-300">Opponents</p>
                  {editOpponents.length === 0 && (
                    <button
                      type="button"
                      onClick={addEditOpponent}
                      className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
                      </svg>
                      Add opponent
                    </button>
                  )}
                </div>
                {editOpponents.length === 0 && (
                  <p className="text-xs text-gray-500">No opponents added yet.</p>
                )}
                {editOpponents.map((opponent, index) => (
                  <div
                    key={`${editTarget.id}-opponent-${index}`}
                    className="rounded-lg border border-gray-700 bg-gray-800/50 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={opponent.name}
                        onChange={(event) => updateEditOpponent(index, 'name', event.target.value)}
                        placeholder="Name"
                        className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-gray-800 text-white text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                      <input
                        type="text"
                        value={opponent.commander}
                        onChange={(event) => updateEditOpponent(index, 'commander', event.target.value)}
                        placeholder="Commander"
                        className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-gray-800 text-white text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                      <div className="flex-1 min-w-0">
                        <ColorIdentitySelect
                          label=""
                          value={opponent.colorIdentity}
                          onChange={(value) => updateEditOpponent(index, 'colorIdentity', value)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEditOpponent(index)}
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
                {editOpponents.length > 0 && (
                  <button
                    type="button"
                    onClick={addEditOpponent}
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
                    onClick={() => setEditResult('win')}
                    className={`px-4 py-2 rounded-full text-sm border transition ${
                      editResult === 'win'
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                        : 'border-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    Win
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditResult('loss')}
                    className={`px-4 py-2 rounded-full text-sm border transition ${
                      editResult === 'loss'
                        ? 'border-rose-400 bg-rose-500/20 text-rose-100'
                        : 'border-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    Loss
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditResult('pending')}
                    className={`px-4 py-2 rounded-full text-sm border transition ${
                      editResult === 'pending'
                        ? 'border-gray-400 bg-gray-700/40 text-gray-100'
                        : 'border-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    Later
                  </button>
                </div>
              </div>
              {editFormError && <p className="text-xs text-red-400">{editFormError}</p>}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="px-4 py-2 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-4 py-2 rounded-lg bg-cyan-500 text-gray-900 font-semibold hover:bg-cyan-400"
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
