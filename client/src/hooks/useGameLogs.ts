import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildApiUrl } from '../utils/api';

export type GameLogOpponent = {
  name: string | null;
  commander: string | null;
  colorIdentity: string[] | null;
};

export type GameLogEntry = {
  id: string;
  deckId: string;
  deckName: string;
  playedAt: string;
  turns: number | null;
  durationMinutes: number | null;
  opponentsCount: number;
  opponents: GameLogOpponent[];
  result: 'win' | 'loss' | null;
  createdAt: string;
};

export type GameLogInput = {
  deckId: string;
  datePlayed: string;
  turns: number | null;
  durationMinutes: number | null;
  opponentsCount: number;
  opponents: Array<{ name: string; commander: string; colorIdentity: string }>;
  result: 'win' | 'loss' | null;
};

export type GameLogUpdate = Omit<GameLogInput, 'deckId'>;

type GameLogResponse = {
  success: boolean;
  logs?: GameLogEntry[];
  error?: string;
};

export function useGameLogs(
  idToken: string | null,
  options: { autoLoad?: boolean } = {}
) {
  const [logs, setLogs] = useState<GameLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const headers = useMemo(() => {
    if (!idToken) return null;
    return {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    };
  }, [idToken]);

  const loadLogs = useCallback(async () => {
    if (!headers) {
      setLogs([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(buildApiUrl('/api/game-logs'), { headers });
      const payload = (await response.json()) as GameLogResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to load game logs.');
      }
      setLogs(Array.isArray(payload.logs) ? payload.logs : []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load game logs.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (!headers) {
      setLogs([]);
      return;
    }
    if (options.autoLoad === false) {
      return;
    }
    void loadLogs();
  }, [headers, loadLogs, options.autoLoad]);

  const addLog = useCallback(async (input: GameLogInput): Promise<boolean> => {
    if (!headers) {
      setError('Sign in with Google to add game logs.');
      return false;
    }
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await fetch(buildApiUrl('/api/game-logs'), {
        method: 'POST',
        headers,
        body: JSON.stringify(input)
      });
      const payload = (await response.json()) as GameLogResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to add game log.');
      }
      setLogs(Array.isArray(payload.logs) ? payload.logs : []);
      setStatusMessage('Game log saved.');
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to add game log.';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const removeLog = useCallback(async (logId: string): Promise<boolean> => {
    if (!headers) {
      setError('Sign in with Google to remove game logs.');
      return false;
    }
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await fetch(buildApiUrl(`/api/game-logs/${logId}`), {
        method: 'DELETE',
        headers
      });
      const payload = (await response.json()) as GameLogResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to remove game log.');
      }
      setLogs(Array.isArray(payload.logs) ? payload.logs : []);
      setStatusMessage('Game log removed.');
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to remove game log.';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const updateLog = useCallback(async (logId: string, input: GameLogUpdate): Promise<boolean> => {
    if (!headers) {
      setError('Sign in with Google to edit game logs.');
      return false;
    }
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await fetch(buildApiUrl(`/api/game-logs/${logId}`), {
        method: 'PATCH',
        headers,
        body: JSON.stringify(input)
      });
      const payload = (await response.json()) as GameLogResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to update game log.');
      }
      setLogs(Array.isArray(payload.logs) ? payload.logs : []);
      setStatusMessage('Game log updated.');
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to update game log.';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [headers]);

  return {
    logs,
    loading,
    error,
    statusMessage,
    addLog,
    removeLog,
    updateLog,
    refreshLogs: loadLogs
  };
}
