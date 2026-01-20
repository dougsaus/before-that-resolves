import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildApiUrl } from '../utils/api';
import type {
  DeckEntry,
  DeckFormInput,
  DeckImportCandidate,
  DeckImportPreviewResult,
  DeckImportResult,
  DeckPreview,
  DeckPreviewResult
} from '../components/DeckCollection';

type GoogleUser = {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
};

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleIdApi = {
  initialize: (config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
  renderButton: (element: HTMLDivElement, options: { theme: string; size: string; text: string; width: number }) => void;
};

type GoogleApi = {
  accounts?: {
    id?: GoogleIdApi;
  };
};

const GOOGLE_SCRIPT_ID = 'google-identity-service';
const TOKEN_STORAGE_KEY = 'btr_google_id_token';

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_SCRIPT_ID);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services.'));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

export function useDeckCollection() {
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const [buttonEl, setButtonEl] = useState<HTMLDivElement | null>(null);
  const buttonRef = useCallback((node: HTMLDivElement | null) => {
    setButtonEl(node);
  }, []);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [decks, setDecks] = useState<DeckEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [deckError, setDeckError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const headers = useMemo(() => {
    if (!idToken) return null;
    return {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    };
  }, [idToken]);

  const resetDeckMessages = () => {
    setDeckError(null);
    setStatusMessage(null);
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

  const loadDecks = useCallback(async (token: string): Promise<boolean> => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await fetch(buildApiUrl('/api/decks'), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const payload = await readPayload<{ success?: boolean; error?: string; user?: GoogleUser; decks?: DeckEntry[] }>(response);
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to load your decks.');
      }
      setUser(payload.user ?? null);
      setDecks(Array.isArray(payload.decks) ? payload.decks : []);
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load your decks.';
      setAuthError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const googleApiRef = useRef<GoogleApi | null>(null);
  const hasInitRef = useRef(false);

  const renderGoogleButton = useCallback((element: HTMLDivElement | null) => {
    const googleApi = googleApiRef.current;
    if (!element || !googleApi?.accounts?.id) {
      return;
    }
    element.innerHTML = '';
    googleApi.accounts.id.renderButton(element, {
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      width: 280
    });
  }, []);

  const handleCredentialResponse = useCallback((credential?: string) => {
    if (!credential) {
      setAuthError('Google login failed. Please try again.');
      return;
    }
    setIdToken(credential);
    try {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, credential);
    } catch {
      // Ignore storage errors.
    }
    void loadDecks(credential).then((success) => {
      if (!success) {
        setIdToken(null);
        try {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        } catch {
          // Ignore storage errors.
        }
      }
    });
  }, [loadDecks]);

  useEffect(() => {
    if (!googleClientId || idToken) {
      return;
    }
    let storedToken: string | null = null;
    try {
      storedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      storedToken = null;
    }
    if (!storedToken) {
      return;
    }
    setIdToken(storedToken);
    void loadDecks(storedToken).then((success) => {
      if (!success) {
        setIdToken(null);
        try {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        } catch {
          // Ignore storage errors.
        }
      }
    });
  }, [googleClientId, idToken, loadDecks]);

  useEffect(() => {
    if (!googleClientId || idToken) {
      return;
    }

    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled) return;
        const googleApi = (window as Window & { google?: GoogleApi }).google;
        if (!googleApi?.accounts?.id) {
          setAuthError('Google sign-in is unavailable.');
          return;
        }
        googleApiRef.current = googleApi;
        if (!hasInitRef.current) {
          googleApi.accounts.id.initialize({
            client_id: googleClientId,
            callback: (response: GoogleCredentialResponse) => {
              handleCredentialResponse(response.credential);
            }
          });
          hasInitRef.current = true;
        }
        renderGoogleButton(buttonEl);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Google sign-in failed to load.';
        setAuthError(message);
      });

    return () => {
      cancelled = true;
    };
  }, [googleClientId, idToken, buttonEl, handleCredentialResponse, renderGoogleButton]);

  const previewDeck = async (deckUrl: string): Promise<DeckPreviewResult> => {
    if (!headers) {
      const message = 'Sign in with Google to load decks.';
      setDeckError(message);
      return { error: message };
    }
    try {
      const response = await fetch(buildApiUrl('/api/decks/preview'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ deckUrl })
      });
      const payload = await readPayload<{ success?: boolean; error?: string; deck?: DeckPreview }>(response);
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to load deck.');
      }
      return { deck: payload.deck };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load deck.';
      return { error: message };
    }
  };

  const previewBulkDecks = async (profileUrl: string): Promise<DeckImportPreviewResult> => {
    if (!headers) {
      const message = 'Sign in with Google to load decks.';
      setDeckError(message);
      return { error: message };
    }
    try {
      const response = await fetch(buildApiUrl('/api/decks/bulk/preview'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ profileUrl })
      });
      const payload = await readPayload<{ success?: boolean; error?: string; decks?: DeckImportCandidate[] }>(response);
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to load decks.');
      }
      return { decks: payload.decks ?? [] };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load decks.';
      return { error: message };
    }
  };

  const importBulkDecks = async (deckUrls: string[]): Promise<DeckImportResult> => {
    if (!headers) {
      const message = 'Sign in with Google to import decks.';
      setDeckError(message);
      return { success: false, error: message };
    }
    setLoading(true);
    resetDeckMessages();
    try {
      const response = await fetch(buildApiUrl('/api/decks/bulk'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ deckUrls })
      });
      const payload = await readPayload<{
        success?: boolean;
        error?: string;
        decks?: DeckEntry[];
        failures?: Array<{ deckUrl: string; error: string }>;
      }>(response);
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to import decks.');
      }
      setDecks(Array.isArray(payload.decks) ? payload.decks : []);
      return { success: true, failures: payload.failures ?? [] };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to import decks.';
      setDeckError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const createDeck = async (input: DeckFormInput): Promise<boolean> => {
    if (!headers) {
      setDeckError('Sign in with Google to add decks.');
      return false;
    }
    setLoading(true);
    resetDeckMessages();
    try {
      const response = await fetch(buildApiUrl('/api/decks/manual'), {
        method: 'POST',
        headers,
        body: JSON.stringify(input)
      });
      const payload = await readPayload<{ success?: boolean; error?: string; decks?: DeckEntry[] }>(response);
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to add deck.');
      }
      setDecks(Array.isArray(payload.decks) ? payload.decks : []);
      setStatusMessage('Deck saved.');
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to add deck.';
      setDeckError(message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateDeck = async (deckId: string, input: DeckFormInput): Promise<boolean> => {
    if (!headers) {
      setDeckError('Sign in with Google to manage decks.');
      return false;
    }
    setLoading(true);
    resetDeckMessages();
    try {
      const response = await fetch(buildApiUrl(`/api/decks/${deckId}`), {
        method: 'PUT',
        headers,
        body: JSON.stringify(input)
      });
      const payload = await readPayload<{ success?: boolean; error?: string; decks?: DeckEntry[] }>(response);
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to update deck.');
      }
      setDecks(Array.isArray(payload.decks) ? payload.decks : []);
      setStatusMessage('Deck updated.');
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to update deck.';
      setDeckError(message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const removeDeck = async (deckId: string) => {
    if (!headers) {
      setDeckError('Sign in with Google to manage decks.');
      return;
    }
    setLoading(true);
    resetDeckMessages();
    try {
      const response = await fetch(buildApiUrl(`/api/decks/${deckId}`), {
        method: 'DELETE',
        headers
      });
      const payload = await readPayload<{ success?: boolean; error?: string; decks?: DeckEntry[] }>(response);
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to remove deck.');
      }
      setDecks(Array.isArray(payload.decks) ? payload.decks : []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to remove deck.';
      setDeckError(message);
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    setIdToken(null);
    setUser(null);
    setDecks([]);
    setAuthError(null);
    setDeckError(null);
    setStatusMessage('Signed out.');
    try {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  };

  const refreshDecks = useCallback(async () => {
    if (!idToken) return;
    await loadDecks(idToken);
  }, [idToken, loadDecks]);

  return {
    googleClientId,
    idToken,
    user,
    decks,
    loading,
    authError,
    deckError,
    statusMessage,
    buttonRef,
    previewDeck,
    previewBulkDecks,
    createDeck,
    updateDeck,
    removeDeck,
    importBulkDecks,
    signOut,
    refreshDecks
  };
}
