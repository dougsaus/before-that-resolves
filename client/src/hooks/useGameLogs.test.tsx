import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApiUrl } from '../utils/api';
import { useGameLogs } from './useGameLogs';

describe('useGameLogs', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads logs when a token is provided', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        logs: [
          {
            id: 'log-1',
            deckId: 'deck-1',
            deckName: 'Test Deck',
            playedAt: '2025-02-14',
            opponentsCount: 2,
            opponents: [],
            result: 'win',
            goodGame: true,
            createdAt: '2025-02-14T00:00:00.000Z'
          }
        ]
      })
    });

    const { result } = renderHook(() => useGameLogs('token-123'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        buildApiUrl('/api/game-logs'),
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer token-123',
            'Content-Type': 'application/json'
          }
        })
      );
    });

    expect(result.current.logs).toHaveLength(1);
  });

  it('adds a log and updates the list', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, logs: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          logs: [
            {
              id: 'log-2',
              deckId: 'deck-2',
              deckName: 'Second Deck',
              playedAt: '2025-03-01',
              opponentsCount: 1,
              opponents: [],
              result: 'loss',
              goodGame: false,
              createdAt: '2025-03-01T00:00:00.000Z'
            }
          ]
        })
      });

    const { result } = renderHook(() => useGameLogs('token-456'));

    await waitFor(() => {
      expect(result.current.logs).toHaveLength(0);
    });

    await act(async () => {
      await result.current.addLog({
        deckId: 'deck-2',
        datePlayed: '2025-03-01',
        opponentsCount: 1,
        opponents: [{ commander: 'Atraxa', colorIdentity: 'WUBG' }],
        result: 'loss',
        goodGame: false
      });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      buildApiUrl('/api/game-logs'),
      expect.objectContaining({
        method: 'POST'
      })
    );
    expect(result.current.logs).toHaveLength(1);
  });
});
