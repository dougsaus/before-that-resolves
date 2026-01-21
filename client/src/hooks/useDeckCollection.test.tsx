import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildApiUrl } from '../utils/api';
import { useDeckCollection } from './useDeckCollection';

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
  const { sessionStatus, user, authError, buttonRef, signOut } = useDeckCollection();
  return (
    <div>
      <div data-testid="status">{sessionStatus}</div>
      <div data-testid="user">{user?.id ?? ''}</div>
      <div data-testid="auth-error">{authError ?? ''}</div>
      <div ref={buttonRef} />
      <button type="button" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}

const mockJsonResponse = (payload: unknown, ok: boolean = true, status?: number) => ({
  ok,
  status: status ?? (ok ? 200 : 400),
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

  it('loads decks when a session is valid', async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ success: true, user: { id: 'user-1' }, decks: [] }));

    render(<HookHarness />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        buildApiUrl('/api/decks'),
        expect.objectContaining({
          credentials: 'include'
        })
      );
    });

    expect(screen.getByTestId('status').textContent).toBe('authenticated');
    expect(screen.getByTestId('user').textContent).toBe('user-1');
  });

  it('exchanges Google credentials for a session', async () => {
    fetchMock
      .mockResolvedValueOnce(mockJsonResponse({
        success: false,
        error: 'Authentication required.',
        code: 'auth_required'
      }, false, 401))
      .mockResolvedValueOnce(mockJsonResponse({ success: true, user: { id: 'user-2' } }))
      .mockResolvedValueOnce(mockJsonResponse({ success: true, user: { id: 'user-2' }, decks: [] }));

    render(<HookHarness />);

    await waitFor(() => {
      expect(credentialCallback).not.toBeNull();
    });
    await act(async () => {
      credentialCallback?.({ credential: 'token-abc' });
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        buildApiUrl('/api/auth/google'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include'
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('authenticated');
      expect(screen.getByTestId('user').textContent).toBe('user-2');
    });
  });

  it('marks the session as expired when the server returns auth_expired', async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({
      success: false,
      error: 'Session expired. Please sign in again.',
      code: 'auth_expired'
    }, false, 401));

    render(<HookHarness />);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('expired');
    });
    expect(screen.getByTestId('auth-error').textContent).toBe('Session expired. Please sign in again.');
  });

  it('signs out and clears the session state', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(mockJsonResponse({ success: true, user: { id: 'user-3' }, decks: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ success: true }));

    render(<HookHarness />);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('authenticated');
    });

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        buildApiUrl('/api/auth/logout'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include'
        })
      );
    });

    expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
  });
});
