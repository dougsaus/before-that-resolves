import { useCallback, useMemo, useState } from 'react';
import { buildApiUrl } from '../utils/api';

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

const readPayload = async <T extends { success?: boolean; error?: string }>(
  response: Response
): Promise<T> => {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Unexpected response from server.');
  }
};

export function useOpponentUsers(idToken: string | null) {
  const [recentOpponents, setRecentOpponents] = useState<OpponentUser[]>([]);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [recentLoading, setRecentLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<OpponentUser[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const headers = useMemo(() => {
    if (!idToken) return null;
    return {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    };
  }, [idToken]);

  const loadRecentOpponents = useCallback(async () => {
    if (!headers) {
      setRecentOpponents([]);
      return;
    }
    setRecentLoading(true);
    setRecentError(null);
    try {
      const response = await fetch(buildApiUrl('/api/opponents/recent'), { headers });
      const payload = await readPayload<OpponentSearchResponse>(response);
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
  }, [headers]);

  const searchOpponents = useCallback(async (query: string): Promise<OpponentUser[]> => {
    if (!headers) {
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
      const response = await fetch(buildApiUrl(`/api/users/search?query=${encodeURIComponent(trimmed)}`), { headers });
      const payload = await readPayload<OpponentSearchResponse>(response);
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
  }, [headers]);

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
