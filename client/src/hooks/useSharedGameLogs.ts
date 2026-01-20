import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildApiUrl } from '../utils/api';
import type { GameLogOpponent } from './useGameLogs';

export type SharedGameLogEntry = {
  id: string;
  recipientUserId: string;
  sharedByUserId: string;
  sourceLogId: string;
  deckId: string | null;
  deckName: string | null;
  deckUrl: string | null;
  playedAt: string;
  turns: number | null;
  durationMinutes: number | null;
  opponentsCount: number;
  opponents: GameLogOpponent[];
  result: 'win' | 'loss' | null;
  tags: string[];
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
};

export type SharedGameLogUpdate = {
  deckId: string | null;
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

type SharedLogsResponse = {
  success: boolean;
  sharedLogs?: SharedGameLogEntry[];
  error?: string;
};

export function useSharedGameLogs(
  idToken: string | null,
  options: { autoLoad?: boolean } = {}
) {
  const [sharedLogs, setSharedLogs] = useState<SharedGameLogEntry[]>([]);
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

  const loadSharedLogs = useCallback(async () => {
    if (!headers) {
      setSharedLogs([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(buildApiUrl('/api/game-logs/shared'), { headers });
      const payload = (await response.json()) as SharedLogsResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to load shared game logs.');
      }
      setSharedLogs(Array.isArray(payload.sharedLogs) ? payload.sharedLogs : []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load shared game logs.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (!headers) {
      setSharedLogs([]);
      return;
    }
    if (options.autoLoad === false) {
      return;
    }
    void loadSharedLogs();
  }, [headers, loadSharedLogs, options.autoLoad]);

  const updateSharedLog = useCallback(async (logId: string, input: SharedGameLogUpdate): Promise<boolean> => {
    if (!headers) {
      setError('Sign in with Google to edit shared logs.');
      return false;
    }
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await fetch(buildApiUrl(`/api/game-logs/shared/${logId}`), {
        method: 'PATCH',
        headers,
        body: JSON.stringify(input)
      });
      const payload = (await response.json()) as SharedLogsResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to update shared game log.');
      }
      setSharedLogs(Array.isArray(payload.sharedLogs) ? payload.sharedLogs : []);
      setStatusMessage('Shared log updated.');
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to update shared game log.';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const acceptSharedLog = useCallback(async (logId: string): Promise<boolean> => {
    if (!headers) {
      setError('Sign in with Google to accept shared logs.');
      return false;
    }
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await fetch(buildApiUrl(`/api/game-logs/shared/${logId}/accept`), {
        method: 'POST',
        headers
      });
      const payload = (await response.json()) as SharedLogsResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to accept shared game log.');
      }
      setSharedLogs(Array.isArray(payload.sharedLogs) ? payload.sharedLogs : []);
      setStatusMessage('Shared log accepted.');
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to accept shared game log.';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const rejectSharedLog = useCallback(async (logId: string): Promise<boolean> => {
    if (!headers) {
      setError('Sign in with Google to reject shared logs.');
      return false;
    }
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await fetch(buildApiUrl(`/api/game-logs/shared/${logId}/reject`), {
        method: 'POST',
        headers
      });
      const payload = (await response.json()) as SharedLogsResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to reject shared game log.');
      }
      setSharedLogs(Array.isArray(payload.sharedLogs) ? payload.sharedLogs : []);
      setStatusMessage('Shared log rejected.');
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to reject shared game log.';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [headers]);

  return {
    sharedLogs,
    loading,
    error,
    statusMessage,
    refreshSharedLogs: loadSharedLogs,
    updateSharedLog,
    acceptSharedLog,
    rejectSharedLog
  };
}
