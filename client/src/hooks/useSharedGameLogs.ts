import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildApiUrl } from '../utils/api';
import type { GameLogOpponent } from './useGameLogs';
import type { AuthStatus } from '../types/auth';

export type SharedGameLogEntry = {
  id: string;
  recipientUserId: string;
  sharedByUserId: string;
  sourceLogId: string;
  deckId: string | null;
  deckName: string | null;
  deckUrl: string | null;
  commanderNames: string[];
  commanderLinks: Array<string | null>;
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

type AuthState = {
  authStatus: AuthStatus;
  onAuthExpired?: (message?: string) => void;
};

export function useSharedGameLogs(
  auth: AuthState,
  options: { autoLoad?: boolean } = {}
) {
  const { authStatus, onAuthExpired } = auth;
  const isAuthenticated = authStatus === 'authenticated';
  const [sharedLogs, setSharedLogs] = useState<SharedGameLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const jsonHeaders = useMemo(() => ({
    'Content-Type': 'application/json'
  }), []);

  const readPayload = useCallback(async <T extends { success?: boolean; error?: string; code?: string }>(
    response: Response
  ): Promise<T> => {
    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error('Unexpected response from server.');
    }
  }, []);

  const handleAuthFailure = useCallback((
    payload: { error?: string; code?: string },
    response: Response,
    fallbackMessage: string
  ): boolean => {
    if (response.status !== 401) return false;
    const message = payload.error || fallbackMessage;
    if (payload.code === 'auth_expired') {
      onAuthExpired?.(message);
    }
    setError(message);
    return true;
  }, [onAuthExpired]);

  const loadSharedLogs = useCallback(async () => {
    if (authStatus === 'unauthenticated') {
      setSharedLogs([]);
      return;
    }
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(buildApiUrl('/api/game-logs/shared'), {
        headers: jsonHeaders,
        credentials: 'include'
      });
      const payload = await readPayload<SharedLogsResponse>(response);
      if (handleAuthFailure(payload, response, 'Unable to load shared game logs.')) {
        return;
      }
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
  }, [authStatus, handleAuthFailure, isAuthenticated, jsonHeaders, readPayload]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      setSharedLogs([]);
      return;
    }
    if (!isAuthenticated) return;
    if (options.autoLoad === false) {
      return;
    }
    void loadSharedLogs();
  }, [authStatus, isAuthenticated, loadSharedLogs, options.autoLoad]);

  const updateSharedLog = useCallback(async (logId: string, input: SharedGameLogUpdate): Promise<boolean> => {
    if (!isAuthenticated) {
      setError('Sign in with Google to edit shared logs.');
      return false;
    }
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await fetch(buildApiUrl(`/api/game-logs/shared/${logId}`), {
        method: 'PATCH',
        headers: jsonHeaders,
        credentials: 'include',
        body: JSON.stringify(input)
      });
      const payload = await readPayload<SharedLogsResponse>(response);
      if (handleAuthFailure(payload, response, 'Unable to update shared game log.')) {
        return false;
      }
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
  }, [handleAuthFailure, isAuthenticated, jsonHeaders, readPayload]);

  const acceptSharedLog = useCallback(async (logId: string): Promise<boolean> => {
    if (!isAuthenticated) {
      setError('Sign in with Google to accept shared logs.');
      return false;
    }
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await fetch(buildApiUrl(`/api/game-logs/shared/${logId}/accept`), {
        method: 'POST',
        headers: jsonHeaders,
        credentials: 'include'
      });
      const payload = await readPayload<SharedLogsResponse>(response);
      if (handleAuthFailure(payload, response, 'Unable to accept shared game log.')) {
        return false;
      }
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
  }, [handleAuthFailure, isAuthenticated, jsonHeaders, readPayload]);

  const rejectSharedLog = useCallback(async (logId: string): Promise<boolean> => {
    if (!isAuthenticated) {
      setError('Sign in with Google to reject shared logs.');
      return false;
    }
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await fetch(buildApiUrl(`/api/game-logs/shared/${logId}/reject`), {
        method: 'POST',
        headers: jsonHeaders,
        credentials: 'include'
      });
      const payload = await readPayload<SharedLogsResponse>(response);
      if (handleAuthFailure(payload, response, 'Unable to reject shared game log.')) {
        return false;
      }
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
  }, [handleAuthFailure, isAuthenticated, jsonHeaders, readPayload]);

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
