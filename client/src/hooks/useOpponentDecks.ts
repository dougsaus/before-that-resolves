import { useCallback, useMemo, useRef, useState } from 'react';
import { buildApiUrl } from '../utils/api';
import type { AuthStatus } from '../types/auth';

export type OpponentDeck = {
  id: string;
  name: string;
  url: string | null;
  commanderNames: string[];
  commanderLinks: Array<string | null>;
  colorIdentity: string[] | null;
};

type OpponentDecksResponse = {
  success: boolean;
  decks?: OpponentDeck[];
  error?: string;
};

type AuthState = {
  authStatus: AuthStatus;
  onAuthExpired?: (message?: string) => void;
};

export function useOpponentDecks(auth: AuthState) {
  const { authStatus, onAuthExpired } = auth;
  const isAuthenticated = authStatus === 'authenticated';
  const [decksByUserId, setDecksByUserId] = useState<Record<string, OpponentDeck[]>>({});
  const [loadingByUserId, setLoadingByUserId] = useState<Record<string, boolean>>({});
  const [errorByUserId, setErrorByUserId] = useState<Record<string, string | null>>({});
  const decksRef = useRef(decksByUserId);
  decksRef.current = decksByUserId;

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

  const loadOpponentDecks = useCallback(
    async (userId: string, options?: { force?: boolean }): Promise<OpponentDeck[]> => {
      if (!isAuthenticated) return [];
      const trimmed = userId.trim();
      if (!trimmed) return [];
      if (!options?.force && decksRef.current[trimmed]) {
        return decksRef.current[trimmed];
      }
      setLoadingByUserId((current) => ({ ...current, [trimmed]: true }));
      setErrorByUserId((current) => ({ ...current, [trimmed]: null }));
      try {
        const response = await fetch(buildApiUrl(`/api/opponents/${encodeURIComponent(trimmed)}/decks`), {
          headers: jsonHeaders,
          credentials: 'include'
        });
        const payload = await readPayload<OpponentDecksResponse>(response);
        if (handleAuthFailure(payload, response, 'Unable to load opponent decks.', (message) => {
          setErrorByUserId((current) => ({ ...current, [trimmed]: message }));
        })) {
          return [];
        }
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Unable to load opponent decks.');
        }
        const decks = Array.isArray(payload.decks) ? payload.decks : [];
        setDecksByUserId((current) => ({ ...current, [trimmed]: decks }));
        return decks;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unable to load opponent decks.';
        setErrorByUserId((current) => ({ ...current, [trimmed]: message }));
        return [];
      } finally {
        setLoadingByUserId((current) => ({ ...current, [trimmed]: false }));
      }
    },
    [handleAuthFailure, isAuthenticated, jsonHeaders, readPayload]
  );

  return {
    decksByUserId,
    loadingByUserId,
    errorByUserId,
    loadOpponentDecks
  };
}
