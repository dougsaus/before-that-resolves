import { useState } from 'react';
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

type OpponentForm = {
  name: string;
  commander: string;
  colorIdentity: string;
};

export function GameLogs({ enabled, idToken }: GameLogsProps) {
  const { logs, loading, error, removeLog, updateLog } = useGameLogs(idToken);
  const [editTarget, setEditTarget] = useState<{
    id: string;
    deckName: string;
  } | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editOpponents, setEditOpponents] = useState<OpponentForm[]>([]);
  const [editResult, setEditResult] = useState<'win' | 'loss' | 'pending'>('pending');
  const [editGoodGame, setEditGoodGame] = useState(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);

  const openEditModal = (log: (typeof logs)[number]) => {
    setEditTarget({ id: log.id, deckName: log.deckName });
    setEditDate(log.playedAt);
    setEditOpponents(
      log.opponents.map((opponent) => ({
        name: opponent.name ?? '',
        commander: opponent.commander ?? '',
        colorIdentity: opponent.colorIdentity ? opponent.colorIdentity.join('') : ''
      }))
    );
    setEditResult(log.result ?? 'pending');
    setEditGoodGame(Boolean(log.goodGame));
    setEditFormError(null);
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
      opponentsCount: editOpponents.length,
      opponents: editOpponents.map((opponent) => ({
        name: opponent.name.trim(),
        commander: opponent.commander.trim(),
        colorIdentity: opponent.colorIdentity.trim()
      })),
      result: editResult === 'pending' ? null : editResult,
      goodGame: editGoodGame
    });
    if (success) {
      setEditTarget(null);
    }
  };

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
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
      <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
        <h2 className="text-2xl font-semibold mb-2">Game Logs</h2>
        <p className="text-gray-300">
          Review recent Commander games logged from your deck list.
        </p>
      </div>

      <section className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-semibold">Recent logs</h3>
            <p className="text-sm text-gray-400">Your latest Commander games.</p>
          </div>
          {logs.length > 0 && (
            <span className="text-xs text-gray-500">{logs.length} total</span>
          )}
        </div>

        {loading && <p className="mt-4 text-sm text-gray-400">Loading game logs...</p>}
        {!loading && error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        {!loading && !error && logs.length === 0 && (
          <p className="mt-4 text-sm text-gray-300">No games logged yet.</p>
        )}

        {!loading && logs.length > 0 && (
          <div className="mt-4 flex flex-col gap-4">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-gray-800 bg-gray-950/60 p-4 flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-400">{formatDate(log.playedAt)}</p>
                    <h4 className="text-base font-semibold text-white">{log.deckName}</h4>
                  </div>
                  <div className="flex items-center gap-3">
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
                    {log.goodGame && (
                      <span className="rounded-full border border-emerald-500/50 px-2 py-1 text-xs text-emerald-200">
                        Good game
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditModal(log)}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeLog(log.id)}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="text-sm text-gray-300">
                  Opponents: <span className="text-white">{log.opponentsCount}</span>
                </div>

                {log.opponents.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {log.opponents.map((opponent, index) => (
                      <div
                        key={`${log.id}-opponent-${index}`}
                        className="flex flex-wrap items-center gap-2 text-sm text-gray-200"
                      >
                        <span className="font-medium">
                          {opponent.name || `Opponent ${index + 1}`}
                        </span>
                        {opponent.commander && (
                          <span className="text-gray-400">({opponent.commander})</span>
                        )}
                        {opponent.colorIdentity ? (
                          <ColorIdentityIcons colors={opponent.colorIdentity} />
                        ) : (
                          <span className="text-xs text-gray-500">Unknown colors</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

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
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={editGoodGame}
                    onChange={(event) => setEditGoodGame(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-600 text-cyan-500 focus:ring-cyan-500"
                  />
                  Good game?
                </label>
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
