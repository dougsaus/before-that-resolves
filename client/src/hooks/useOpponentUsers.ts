import { useCallback, useMemo, useState } from 'react';
import { buildApiUrl } from '../utils/api';
import type { AuthStatus } from '../types/auth';

export type OpponentUser = {
  id: string;
  name: string | null;
  email: string | null;
};

type OpponentSearchResponse = {
  success: boolean;
  users?: OpponentUser[];
  opponents?: OpponentUser[];
  error?: string;
};

type AuthState = {
  authStatus: AuthStatus;
  onAuthExpired?: (message?: string) => void;
};

export function useOpponentUsers(auth: AuthState) {
  const { authStatus, onAuthExpired } = auth;
  const isAuthenticated = authStatus === 'authenticated';
  const [recentOpponents, setRecentOpponents] = useState<OpponentUser[]>([]);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [recentLoading, setRecentLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<OpponentUser[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

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
    fallbackMessage: string,
    setMessage: (message: string) => void
  ): boolean => {
    if (response.status !== 401) return false;
    const message = payload.error || fallbackMessage;
    if (payload.code === 'auth_expired') {
      onAuthExpired?.(message);
    }
    setMessage(message);
    return true;
  }, [onAuthExpired]);

  const loadRecentOpponents = useCallback(async () => {
    if (authStatus === 'unauthenticated') {
      setRecentOpponents([]);
      return;
    }
    if (!isAuthenticated) return;
    setRecentLoading(true);
    setRecentError(null);
    try {
      const response = await fetch(buildApiUrl('/api/opponents/recent'), {
        headers: jsonHeaders,
        credentials: 'include'
      });
      const payload = await readPayload<OpponentSearchResponse>(response);
      if (handleAuthFailure(payload, response, 'Unable to load recent opponents.', setRecentError)) {
        return;
      }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to load recent opponents.');
      }
      setRecentOpponents(Array.isArray(payload.opponents) ? payload.opponents : []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load recent opponents.';
      setRecentError(message);
    } finally {
      setRecentLoading(false);
    }
  }, [authStatus, handleAuthFailure, isAuthenticated, jsonHeaders, readPayload]);

  const searchOpponents = useCallback(async (query: string): Promise<OpponentUser[]> => {
    if (!isAuthenticated) {
      setSearchResults([]);
      return [];
    }
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      return [];
    }
    setSearchLoading(true);
    setSearchError(null);
    try {
      const response = await fetch(buildApiUrl(`/api/users/search?query=${encodeURIComponent(trimmed)}`), {
        headers: jsonHeaders,
        credentials: 'include'
      });
      const payload = await readPayload<OpponentSearchResponse>(response);
      if (handleAuthFailure(payload, response, 'Unable to search users.', setSearchError)) {
        return [];
      }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to search users.');
      }
      const results = Array.isArray(payload.users) ? payload.users : [];
      setSearchResults(results);
      return results;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to search users.';
      setSearchError(message);
      return [];
    } finally {
      setSearchLoading(false);
    }
  }, [handleAuthFailure, isAuthenticated, jsonHeaders, readPayload]);

  const clearSearch = useCallback(() => {
    setSearchResults([]);
    setSearchError(null);
    setSearchLoading(false);
  }, []);

  return {
    recentOpponents,
    recentError,
    recentLoading,
    searchResults,
    searchError,
    searchLoading,
    loadRecentOpponents,
    searchOpponents,
    clearSearch
  };
}
