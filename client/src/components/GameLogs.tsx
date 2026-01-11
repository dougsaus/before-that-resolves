import { ManaSymbol } from './ManaSymbol';
import { useGameLogs } from '../hooks/useGameLogs';

type GameLogsProps = {
  enabled: boolean;
  idToken: string | null;
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

export function GameLogs({ enabled, idToken }: GameLogsProps) {
  const { logs, loading, error, removeLog } = useGameLogs(idToken);

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
    </div>
  );
}
