import { useEffect, useMemo, useRef, useState } from 'react';
import { buildApiUrl } from '../utils/api';

type DeckEntry = {
  id: string;
  name: string;
  url: string;
  format: string | null;
  addedAt: string;
};

type GoogleUser = {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
};

type DeckCollectionProps = {
  onBack?: () => void;
};

const GOOGLE_SCRIPT_ID = 'google-identity-service';

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

export function DeckCollection({ onBack }: DeckCollectionProps) {
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [decks, setDecks] = useState<DeckEntry[]>([]);
  const [deckUrl, setDeckUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const headers = useMemo(() => {
    if (!idToken) return null;
    return {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    };
  }, [idToken]);

  const resetMessages = () => {
    setErrorMessage(null);
    setStatusMessage(null);
  };

  const loadDecks = async (token: string) => {
    setLoading(true);
    resetMessages();
    try {
      const response = await fetch(buildApiUrl('/api/decks'), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to load your decks.');
      }
      setUser(payload.user || null);
      setDecks(Array.isArray(payload.decks) ? payload.decks : []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load your decks.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialResponse = (credential?: string) => {
    if (!credential) {
      setErrorMessage('Google login failed. Please try again.');
      return;
    }
    setIdToken(credential);
    loadDecks(credential);
  };

  useEffect(() => {
    if (!googleClientId || idToken) {
      return;
    }

    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled) return;
        const googleApi = (window as { google?: any }).google;
        if (!googleApi?.accounts?.id) {
          setErrorMessage('Google sign-in is unavailable.');
          return;
        }
        googleApi.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response: { credential?: string }) => {
            handleCredentialResponse(response.credential);
          }
        });
        if (buttonRef.current) {
          buttonRef.current.innerHTML = '';
          googleApi.accounts.id.renderButton(buttonRef.current, {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            width: 280
          });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Google sign-in failed to load.';
        setErrorMessage(message);
      });

    return () => {
      cancelled = true;
    };
  }, [googleClientId, idToken]);

  const handleAddDeck = async () => {
    if (!deckUrl.trim()) return;
    if (!headers) {
      setErrorMessage('Sign in with Google to add decks.');
      return;
    }
    setLoading(true);
    resetMessages();
    try {
      const response = await fetch(buildApiUrl('/api/decks'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ deckUrl: deckUrl.trim() })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to add deck.');
      }
      setDecks(Array.isArray(payload.decks) ? payload.decks : []);
      setDeckUrl('');
      setStatusMessage('Deck added.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to add deck.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDeck = async (deckId: string) => {
    if (!headers) {
      setErrorMessage('Sign in with Google to manage decks.');
      return;
    }
    setLoading(true);
    resetMessages();
    try {
      const response = await fetch(buildApiUrl(`/api/decks/${deckId}`), {
        method: 'DELETE',
        headers
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to remove deck.');
      }
      setDecks(Array.isArray(payload.decks) ? payload.decks : []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to remove deck.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    setIdToken(null);
    setUser(null);
    setDecks([]);
    setDeckUrl('');
    setStatusMessage('Signed out.');
  };

  if (!googleClientId) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-gray-900/70 border border-gray-700 rounded-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-semibold mb-3">Your Decks</h2>
        <p className="text-gray-300">
          Google login is not configured. Set `VITE_GOOGLE_CLIENT_ID` to enable deck collections.
        </p>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700"
          >
            Back
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold">Your Decks</h2>
          <p className="text-gray-300">
            Keep a personal list of Archidekt decks you want to analyze.
          </p>
        </div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700"
          >
            Back
          </button>
        )}
      </div>

      {!idToken && (
        <div className="bg-gray-900/70 border border-gray-700 rounded-2xl p-6 sm:p-8 flex flex-col gap-4">
          <p className="text-gray-200">
            Sign in with Google to start building your deck collection.
          </p>
          <div ref={buttonRef} />
          {errorMessage && <p className="text-red-400">{errorMessage}</p>}
        </div>
      )}

      {idToken && (
        <div className="bg-gray-900/70 border border-gray-700 rounded-2xl p-6 sm:p-8 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {user?.picture && (
                <img
                  src={user.picture}
                  alt={user.name || 'Google profile'}
                  className="h-12 w-12 rounded-full border border-gray-700"
                />
              )}
              <div>
                <p className="text-lg font-semibold">{user?.name || 'Signed in'}</p>
                {user?.email && <p className="text-sm text-gray-400">{user.email}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-600 text-gray-200 hover:bg-gray-800"
            >
              Sign out
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm text-gray-300" htmlFor="deck-url-input">
              Add an Archidekt deck URL
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="deck-url-input"
                type="url"
                value={deckUrl}
                onChange={(event) => setDeckUrl(event.target.value)}
                placeholder="https://archidekt.com/decks/..."
                className="flex-1 px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={handleAddDeck}
                disabled={loading}
                className="px-5 py-3 rounded-lg bg-cyan-500 text-gray-900 font-semibold hover:bg-cyan-400 disabled:opacity-60"
              >
                {loading ? 'Saving...' : 'Add Deck'}
              </button>
            </div>
            {statusMessage && <p className="text-emerald-400">{statusMessage}</p>}
            {errorMessage && <p className="text-red-400">{errorMessage}</p>}
          </div>
        </div>
      )}

      {idToken && (
        <div className="bg-gray-900/70 border border-gray-700 rounded-2xl p-6 sm:p-8">
          <h3 className="text-xl font-semibold mb-4">Saved decks</h3>
          {loading && <p className="text-gray-400">Loading...</p>}
          {!loading && decks.length === 0 && (
            <p className="text-gray-400">No decks yet. Add your first Archidekt deck URL above.</p>
          )}
          <ul className="space-y-3">
            {decks.map((deck) => (
              <li
                key={deck.id}
                className="flex flex-col gap-3 rounded-xl border border-gray-800 bg-gray-950/60 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-white">{deck.name}</p>
                  <p className="text-sm text-gray-400">
                    {deck.format ? `${deck.format} · ` : ''}
                    <a
                      href={deck.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      Open on Archidekt
                    </a>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveDeck(deck.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
