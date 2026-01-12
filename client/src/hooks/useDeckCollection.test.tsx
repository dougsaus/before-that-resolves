import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildApiUrl } from '../utils/api';
import { useDeckCollection } from './useDeckCollection';

const TOKEN_STORAGE_KEY = 'btr_google_id_token';

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleIdApi = {
  initialize: (config: { callback?: (response: GoogleCredentialResponse) => void }) => void;
  renderButton: (element: HTMLElement) => void;
};

type GoogleApi = {
  accounts: {
    id: GoogleIdApi;
  };
};

function HookHarness() {
  const { idToken, user, buttonRef, signOut } = useDeckCollection();
  return (
    <div>
      <div data-testid="token">{idToken ?? ''}</div>
      <div data-testid="user">{user?.id ?? ''}</div>
      <div ref={buttonRef} />
      <button type="button" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}

const mockJsonResponse = (payload: unknown, ok: boolean = true) => ({
  ok,
  text: async () => JSON.stringify(payload)
});

describe('useDeckCollection', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let credentialCallback: ((response: { credential?: string }) => void) | null = null;

  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-id');
    window.localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const script = document.createElement('script');
    script.id = 'google-identity-service';
    document.head.appendChild(script);

    credentialCallback = null;
    (window as Window & { google?: GoogleApi }).google = {
      accounts: {
        id: {
          initialize: vi.fn((config: { callback?: (response: GoogleCredentialResponse) => void }) => {
            credentialCallback = config.callback ?? null;
          }),
          renderButton: vi.fn()
        }
      }
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    window.localStorage.clear();
    document.getElementById('google-identity-service')?.remove();
    delete (window as Window & { google?: GoogleApi }).google;
  });

  it('restores a stored token and loads decks', async () => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, 'token-123');
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ success: true, user: { id: 'user-1' }, decks: [] }));

    render(<HookHarness />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        buildApiUrl('/api/decks'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer token-123' }
        })
      );
    });

    expect(screen.getByTestId('token').textContent).toBe('token-123');
    expect(screen.getByTestId('user').textContent).toBe('user-1');
  });

  it('persists token after Google login callback', async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ success: true, user: { id: 'user-2' }, decks: [] }));

    render(<HookHarness />);

    await waitFor(() => {
      expect(credentialCallback).not.toBeNull();
    });
    await act(async () => {
      credentialCallback?.({ credential: 'token-abc' });
    });

    await waitFor(() => {
      expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('token-abc');
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        buildApiUrl('/api/decks'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer token-abc' }
        })
      );
    });
  });

  it('clears a stored token if loading decks fails', async () => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, 'token-bad');
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ success: false, error: 'Invalid token' }, false));

    render(<HookHarness />);

    await waitFor(() => {
      expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    });

    expect(screen.getByTestId('token').textContent).toBe('');
  });

  it('clears token on sign out', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(TOKEN_STORAGE_KEY, 'token-321');
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ success: true, user: { id: 'user-3' }, decks: [] }));

    render(<HookHarness />);

    await waitFor(() => {
      expect(screen.getByTestId('token').textContent).toBe('token-321');
    });

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    });

    expect(screen.getByTestId('token').textContent).toBe('');
  });
});
