import type { RefCallback } from 'react';

type GoogleUser = {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
};

type DeckAuthPanelProps = {
  enabled: boolean;
  idToken: string | null;
  user: GoogleUser | null;
  authError: string | null;
  loading: boolean;
  buttonRef: RefCallback<HTMLDivElement>;
  onSignOut: () => void;
};

export function DeckAuthPanel({
  enabled,
  idToken,
  user,
  authError,
  loading,
  buttonRef,
  onSignOut
}: DeckAuthPanelProps) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 text-sm text-gray-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Account</span>
        {idToken && (
          <button
            type="button"
            onClick={onSignOut}
            className="text-xs text-gray-300 hover:text-white"
          >
            Sign out
          </button>
        )}
      </div>

      {!enabled && (
        <p className="text-gray-300">
          Google login isn’t configured. Set `VITE_GOOGLE_CLIENT_ID` to enable it.
        </p>
      )}

      {enabled && !idToken && (
        <div className="flex flex-col gap-3">
          <p className="text-gray-200">Sign in to save decks to your collection.</p>
          <div ref={buttonRef} />
          {authError && <p className="text-red-400 text-xs">{authError}</p>}
        </div>
      )}

      {enabled && idToken && (
        <div className="flex items-center gap-3">
          {user?.picture && (
            <img
              src={user.picture}
              alt={user.name || 'Google profile'}
              className="h-10 w-10 rounded-full border border-gray-700"
            />
          )}
          <div>
            <p className="font-semibold text-white">{user?.name || 'Signed in'}</p>
            {user?.email && <p className="text-xs text-gray-400">{user.email}</p>}
            {loading && <p className="text-xs text-gray-400">Syncing decks...</p>}
          </div>
        </div>
      )}
    </div>
  );
}
