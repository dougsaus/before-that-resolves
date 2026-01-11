import type { FormEvent, RefCallback } from 'react';
import { useMemo, useState } from 'react';
import type { DeckEntry } from './DeckCollection';
import { DeckAuthPanel } from './DeckAuthPanel';
import { ManaSymbol } from './ManaSymbol';
import { useGameLogs } from '../hooks/useGameLogs';

type GoogleUser = {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
};

type GameLogsProps = {
  enabled: boolean;
  idToken: string | null;
  user: GoogleUser | null;
  authError: string | null;
  loading: boolean;
  decks: DeckEntry[];
  buttonRef: RefCallback<HTMLDivElement>;
  onSignOut: () => void;
};

type OpponentForm = {
  commander: string;
  colorIdentity: string;
};

type WubrgColor = 'W' | 'U' | 'B' | 'R' | 'G';
const WUBRG_INDEX: Record<WubrgColor, number> = {
  W: 0,
  U: 1,
  B: 2,
  R: 3,
  G: 4
};

function sortColors(colors: string[]): string[] {
  return [...colors].sort((a, b) => {
    const left = WUBRG_INDEX[a as WubrgColor] ?? 99;
    const right = WUBRG_INDEX[b as WubrgColor] ?? 99;
    return left - right;
  });
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function ColorIdentityIcons({ colors }: { colors: string[] | null }) {
  if (!colors) {
    return <span className="text-xs text-gray-500">Unknown colors</span>;
  }
  const displayColors = colors.length === 0 ? ['C'] : sortColors(colors);
  return (
    <span className="inline-flex items-center gap-1">
      {displayColors.map((color) => (
        <ManaSymbol key={color} symbol={`{${color}}`} size="small" />
      ))}
    </span>
  );
}

export function GameLogs({
  enabled,
  idToken,
  user,
  authError,
  loading,
  decks,
  buttonRef,
  onSignOut
}: GameLogsProps) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { logs, loading: logsLoading, error, statusMessage, addLog, removeLog } = useGameLogs(idToken);
  const [deckId, setDeckId] = useState('');
  const [datePlayed, setDatePlayed] = useState(today);
  const [opponentsCount, setOpponentsCount] = useState(1);
  const [opponents, setOpponents] = useState<OpponentForm[]>([{ commander: '', colorIdentity: '' }]);
  const [result, setResult] = useState<'win' | 'loss'>('win');
  const [goodGame, setGoodGame] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const isBusy = loading || logsLoading;

  const selectedDeckId = useMemo(() => {
    if (decks.length === 0) return '';
    return decks.some((deck) => deck.id === deckId) ? deckId : decks[0]?.id ?? '';
  }, [deckId, decks]);

  const updateOpponent = (index: number, field: keyof OpponentForm, value: string) => {
    setOpponents((current) => {
      const next = [...current];
      const target = next[index] ?? { commander: '', colorIdentity: '' };
      next[index] = { ...target, [field]: value };
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (!selectedDeckId) {
      setFormError('Select a deck to log a game.');
      return;
    }
    const success = await addLog({
      deckId: selectedDeckId,
      datePlayed,
      opponentsCount,
      opponents: opponents.map((opponent) => ({
        commander: opponent.commander.trim(),
        colorIdentity: opponent.colorIdentity.trim()
      })),
      result,
      goodGame
    });
    if (success) {
      setDatePlayed(today);
      setOpponents((current) =>
        current.map(() => ({
          commander: '',
          colorIdentity: ''
        }))
      );
      setResult('win');
      setGoodGame(true);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
      <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
        <h2 className="text-2xl font-semibold mb-2">Game Logs</h2>
        <p className="text-gray-300">
          Track quick Commander results and keep recent games tied to each deck.
        </p>
      </div>

      <DeckAuthPanel
        enabled={enabled}
        idToken={idToken}
        user={user}
        authError={authError}
        loading={loading}
        buttonRef={buttonRef}
        onSignOut={onSignOut}
      />

      {enabled && idToken && (
        <>
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6 flex flex-col gap-4"
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-lg font-semibold">Log a game</h3>
                <p className="text-sm text-gray-400">Quick entry optimized for mobile.</p>
              </div>
              {statusMessage && (
                <span className="text-xs text-emerald-300">{statusMessage}</span>
              )}
            </div>

            {decks.length === 0 ? (
              <p className="text-sm text-gray-300">
                Add a deck to your collection before logging games.
              </p>
            ) : (
              <>
                <label className="flex flex-col gap-2 text-sm">
                  Deck
                  <select
                    value={selectedDeckId}
                    onChange={(event) => setDeckId(event.target.value)}
                    className="bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {decks.map((deck) => (
                      <option key={deck.id} value={deck.id}>
                        {deck.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm">
                    Date played
                    <input
                      type="date"
                      value={datePlayed}
                      onChange={(event) => setDatePlayed(event.target.value)}
                      className="bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    Number of opponents
                    <input
                      type="number"
                      min={0}
                      max={6}
                      value={opponentsCount}
                      onChange={(event) => {
                        const parsed = Number.parseInt(event.target.value, 10);
                        const nextCount = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
                        setOpponentsCount(nextCount);
                        setOpponents((current) => {
                          const next = [...current];
                          while (next.length < nextCount) {
                            next.push({ commander: '', colorIdentity: '' });
                          }
                          return next.slice(0, nextCount);
                        });
                      }}
                      className="bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </label>
                </div>

                {opponents.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-gray-300">Opponent commanders</p>
                    {opponents.map((opponent, index) => (
                      <div key={`${index + 1}`} className="grid gap-3 sm:grid-cols-2">
                        <input
                          type="text"
                          value={opponent.commander}
                          onChange={(event) => updateOpponent(index, 'commander', event.target.value)}
                          placeholder={`Opponent ${index + 1} commander`}
                          className="bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                        <input
                          type="text"
                          value={opponent.colorIdentity}
                          onChange={(event) => updateOpponent(index, 'colorIdentity', event.target.value)}
                          placeholder="Color identity (WUBRG)"
                          className="bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setResult('win')}
                      className={`px-4 py-2 rounded-full text-sm border transition ${
                        result === 'win'
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                          : 'border-gray-700 text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      Win
                    </button>
                    <button
                      type="button"
                      onClick={() => setResult('loss')}
                      className={`px-4 py-2 rounded-full text-sm border transition ${
                        result === 'loss'
                          ? 'border-rose-400 bg-rose-500/20 text-rose-100'
                          : 'border-gray-700 text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      Loss
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={goodGame}
                      onChange={(event) => setGoodGame(event.target.checked)}
                      className="h-4 w-4 rounded border-gray-600 text-cyan-500 focus:ring-cyan-500"
                    />
                    Good game?
                  </label>
                </div>

                {(formError || error) && (
                  <p className="text-xs text-red-400">{formError || error}</p>
                )}

                <button
                  type="submit"
                  disabled={isBusy || decks.length === 0}
                  className="w-full sm:w-auto self-start rounded-full bg-cyan-500/80 px-6 py-2 text-sm font-semibold text-gray-900 hover:bg-cyan-400 disabled:opacity-50"
                >
                  Save log
                </button>
              </>
            )}
          </form>

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

            {logs.length === 0 ? (
              <p className="mt-4 text-sm text-gray-300">No games logged yet.</p>
            ) : (
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
                            log.result === 'win' ? 'text-emerald-300' : 'text-rose-300'
                          }`}
                        >
                          {log.result}
                        </span>
                        {log.goodGame && (
                          <span className="rounded-full border border-emerald-500/50 px-2 py-1 text-xs text-emerald-200">
                            Good game
                          </span>
                        )}
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
                              {opponent.commander || `Opponent ${index + 1}`}
                            </span>
                            <ColorIdentityIcons colors={opponent.colorIdentity} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
