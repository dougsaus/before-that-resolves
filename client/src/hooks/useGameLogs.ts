import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildApiUrl } from '../utils/api';

export type GameLogOpponent = {
  userId: string | null;
  name: string | null;
  email: string | null;
  deckId: string | null;
  deckName: string | null;
  deckUrl: string | null;
  commanderNames: string[];
  commanderLinks: Array<string | null>;
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
  tags: string[];
  createdAt: string;
};

export type GameLogInput = {
  deckId: string;
  datePlayed: string;
  turns: number | null;
  durationMinutes: number | null;
  opponentsCount: number;
  opponents: Array<{
    userId: string | null;
    name: string;
    email: string | null;
    deckId: string | null;
    deckName: string | null;
    deckUrl: string | null;
    commanderNames: string[];
    commanderLinks: Array<string | null>;
    colorIdentity: string;
  }>;
  result: 'win' | 'loss' | null;
  tags: string[];
};

export type GameLogUpdate = Omit<GameLogInput, 'deckId'>;

type GameLogResponse = {
  success: boolean;
  logs?: GameLogEntry[];
  error?: string;
};

type ShareLogResponse = {
  success: boolean;
  sharedCount?: number;
  reopenedCount?: number;
  skippedCount?: number;
  needsConfirm?: boolean;
  rejectedCount?: number;
  acceptedCount?: number;
  pendingCount?: number;
  nonUserCount?: number;
  opponents?: Array<{
    userId: string;
    name: string | null;
    status: 'pending' | 'accepted' | 'rejected' | null;
  }>;
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

  const shareLog = useCallback(async (
    logId: string,
    options: { confirmReshare?: boolean; reshareRecipientIds?: string[] } = {}
  ): Promise<ShareLogResponse | null> => {
    if (!headers) {
      setError('Sign in with Google to share game logs.');
      return null;
    }
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await fetch(buildApiUrl(`/api/game-logs/${logId}/share`), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          confirmReshare: options.confirmReshare ?? false,
          reshareRecipientIds: options.reshareRecipientIds ?? null
        })
      });
      const payload = (await response.json()) as ShareLogResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to share game log.');
      }
      if (!payload.needsConfirm) {
        const acceptedCount = payload.acceptedCount ?? 0;
        const pendingCount = payload.pendingCount ?? 0;
        const rejectedCount = payload.rejectedCount ?? 0;
        const nonUserCount = payload.nonUserCount ?? 0;
        const sharedParts: string[] = [];
        if (pendingCount > 0) sharedParts.push(`${pendingCount} pending`);
        if (rejectedCount > 0) sharedParts.push(`${rejectedCount} rejected`);
        if (acceptedCount > 0) sharedParts.push(`${acceptedCount} accepted`);
        const sharedMessage = sharedParts.length > 0
          ? `Game log shared: ${sharedParts.join(', ')}.`
          : null;
        const notSharedMessage =
          nonUserCount > 0 ? ` Not shared: ${nonUserCount} (not users)` : '';
        if (sharedMessage) {
          setStatusMessage(`${sharedMessage}${notSharedMessage}`);
          return payload;
        }
        if (nonUserCount > 0) {
          setStatusMessage('All opponents are non-users');
          return payload;
        }
        setStatusMessage('No opponents to share log');
        return payload;
      }
      return payload;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to share game log.';
      setError(message);
      return null;
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
    shareLog,
    refreshLogs: loadLogs
  };
}
