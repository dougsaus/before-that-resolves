import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApiUrl } from '../utils/api';
import { useGameLogs } from './useGameLogs';

describe('useGameLogs', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const mockJsonResponse = (payload: unknown, ok: boolean = true, status?: number) => ({
    ok,
    status: status ?? (ok ? 200 : 400),
    text: async () => JSON.stringify(payload)
  });

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads logs when a token is provided', async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({
      success: true,
      logs: [
        {
          id: 'log-1',
          deckId: 'deck-1',
          deckName: 'Test Deck',
          commanderNames: [],
          commanderLinks: [],
          playedAt: '2025-02-14',
          turns: null,
          durationMinutes: null,
          opponentsCount: 2,
          opponents: [],
          result: null,
          tags: [],
          createdAt: '2025-02-14T00:00:00.000Z'
        }
      ]
    }));

    const { result } = renderHook(() => useGameLogs({ authStatus: 'authenticated' }));

    await waitFor(() => {
      expect(result.current.logs).toHaveLength(1);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      buildApiUrl('/api/game-logs'),
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })
    );
  });

  it('adds a log and updates the list', async () => {
    fetchMock
      .mockResolvedValueOnce(mockJsonResponse({ success: true, logs: [] }))
      .mockResolvedValueOnce(mockJsonResponse({
        success: true,
        logs: [
          {
            id: 'log-2',
            deckId: 'deck-2',
            deckName: 'Second Deck',
            commanderNames: [],
            commanderLinks: [],
            playedAt: '2025-03-01',
            turns: null,
            durationMinutes: null,
            opponentsCount: 1,
            opponents: [],
            result: null,
            tags: [],
            createdAt: '2025-03-01T00:00:00.000Z'
          }
        ]
      }));

    const { result } = renderHook(() => useGameLogs({ authStatus: 'authenticated' }));

    await waitFor(() => {
      expect(result.current.logs).toHaveLength(0);
    });

    await act(async () => {
      await result.current.addLog({
        deckId: 'deck-2',
        datePlayed: '2025-03-01',
        turns: null,
        durationMinutes: null,
        opponentsCount: 1,
        opponents: [{
          userId: null,
          name: 'Player 2',
          email: null,
          deckId: null,
          deckName: null,
          deckUrl: null,
          commanderNames: ['Atraxa'],
          commanderLinks: [null],
          colorIdentity: 'WUBG'
        }],
        result: null,
        tags: []
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

  it('updates a log and refreshes results', async () => {
    fetchMock
      .mockResolvedValueOnce(mockJsonResponse({
        success: true,
        logs: [
          {
            id: 'log-3',
            deckId: 'deck-3',
            deckName: 'Third Deck',
            commanderNames: [],
            commanderLinks: [],
            playedAt: '2025-03-02',
            turns: null,
            durationMinutes: null,
            opponentsCount: 3,
            opponents: [],
            result: null,
            tags: [],
            createdAt: '2025-03-02T00:00:00.000Z'
          }
        ]
      }))
      .mockResolvedValueOnce(mockJsonResponse({
        success: true,
        logs: [
          {
            id: 'log-3',
            deckId: 'deck-3',
            deckName: 'Third Deck',
            commanderNames: [],
            commanderLinks: [],
            playedAt: '2025-03-02',
            turns: null,
            durationMinutes: null,
            opponentsCount: 3,
            opponents: [],
            result: 'win',
            tags: [],
            createdAt: '2025-03-02T00:00:00.000Z'
          }
        ]
      }));

    const { result } = renderHook(() => useGameLogs({ authStatus: 'authenticated' }));

    await waitFor(() => {
      expect(result.current.logs).toHaveLength(1);
    });

    await act(async () => {
      await result.current.updateLog('log-3', {
        datePlayed: '2025-03-02',
        turns: null,
        durationMinutes: null,
        opponentsCount: 3,
        opponents: [],
        result: 'win',
        tags: []
      });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      buildApiUrl('/api/game-logs/log-3'),
      expect.objectContaining({ method: 'PATCH' })
    );
    expect(result.current.logs[0]?.result).toBe('win');
  });
});
