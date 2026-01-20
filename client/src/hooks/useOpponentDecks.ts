import { useCallback, useMemo, useRef, useState } from 'react';
import { buildApiUrl } from '../utils/api';

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

export function useOpponentDecks(idToken: string | null) {
  const [decksByUserId, setDecksByUserId] = useState<Record<string, OpponentDeck[]>>({});
  const [loadingByUserId, setLoadingByUserId] = useState<Record<string, boolean>>({});
  const [errorByUserId, setErrorByUserId] = useState<Record<string, string | null>>({});
  const decksRef = useRef(decksByUserId);
  decksRef.current = decksByUserId;

  const headers = useMemo(() => {
    if (!idToken) return null;
    return {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    };
  }, [idToken]);

  const loadOpponentDecks = useCallback(
    async (userId: string, options?: { force?: boolean }): Promise<OpponentDeck[]> => {
      if (!headers) return [];
      const trimmed = userId.trim();
      if (!trimmed) return [];
      if (!options?.force && decksRef.current[trimmed]) {
        return decksRef.current[trimmed];
      }
      setLoadingByUserId((current) => ({ ...current, [trimmed]: true }));
      setErrorByUserId((current) => ({ ...current, [trimmed]: null }));
      try {
        const response = await fetch(buildApiUrl(`/api/opponents/${encodeURIComponent(trimmed)}/decks`), { headers });
        const payload = await readPayload<OpponentDecksResponse>(response);
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
    [headers]
  );

  return {
    decksByUserId,
    loadingByUserId,
    errorByUserId,
    loadOpponentDecks
  };
}
