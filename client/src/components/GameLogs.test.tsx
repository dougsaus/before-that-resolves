import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameLogs } from './GameLogs';
import type { GameLogEntry } from '../hooks/useGameLogs';

const mockUseGameLogs = vi.fn();

vi.mock('../hooks/useGameLogs', () => ({
  useGameLogs: (idToken: string | null) => mockUseGameLogs(idToken)
}));

const baseLog = (overrides: Partial<GameLogEntry> = {}): GameLogEntry => ({
  id: 'log-1',
  deckId: 'deck-1',
  deckName: 'Alpha Deck',
  playedAt: '2026-01-12',
  turns: null,
  durationMinutes: null,
  opponentsCount: 0,
  opponents: [],
  result: null,
  tags: [],
  createdAt: '2026-01-12T00:00:00.000Z',
  ...overrides
});

describe('GameLogs', () => {
  beforeEach(() => {
    mockUseGameLogs.mockReturnValue({
      logs: [],
      loading: false,
      error: null,
      removeLog: vi.fn(),
      updateLog: vi.fn()
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('defaults to sorting by date played (desc)', () => {
    mockUseGameLogs.mockReturnValue({
      logs: [
        baseLog({ id: 'log-1', deckName: 'Older Deck', playedAt: '2026-01-10' }),
        baseLog({ id: 'log-2', deckName: 'Newer Deck', playedAt: '2026-01-12' })
      ],
      loading: false,
      error: null,
      removeLog: vi.fn(),
      updateLog: vi.fn()
    });

    render(<GameLogs enabled idToken="token-123" />);

    const deckNames = screen.getAllByText(/Older Deck|Newer Deck/).map((node) => node.textContent);
    expect(deckNames[0]).toBe('Newer Deck');
  });

  it('sorts by deck name and saves preferences', async () => {
    const user = userEvent.setup();
    mockUseGameLogs.mockReturnValue({
      logs: [
        baseLog({ id: 'log-1', deckName: 'Zulu Deck', playedAt: '2026-01-10' }),
        baseLog({ id: 'log-2', deckName: 'Alpha Deck', playedAt: '2026-01-12' })
      ],
      loading: false,
      error: null,
      removeLog: vi.fn(),
      updateLog: vi.fn()
    });

    render(<GameLogs enabled idToken="token-123" />);

    const sortSelect = screen.getByLabelText('Sort');
    await user.selectOptions(sortSelect, 'deckName');

    let deckNames = screen.getAllByText(/Zulu Deck|Alpha Deck/).map((node) => node.textContent);
    expect(deckNames[0]).toBe('Zulu Deck');

    await user.click(screen.getByRole('button', { name: /Sort ascending/ }));

    deckNames = screen.getAllByText(/Zulu Deck|Alpha Deck/).map((node) => node.textContent);
    expect(deckNames[0]).toBe('Alpha Deck');

    const saved = JSON.parse(localStorage.getItem('btr:game-logs-sort') || '{}') as {
      key?: string;
      dir?: string;
    };
    expect(saved.key).toBe('deckName');
    expect(saved.dir).toBe('asc');
  });

  it('sorts by win/loss', async () => {
    const user = userEvent.setup();
    mockUseGameLogs.mockReturnValue({
      logs: [
        baseLog({ id: 'log-1', deckName: 'Loss Deck', result: 'loss' }),
        baseLog({ id: 'log-2', deckName: 'Win Deck', result: 'win' })
      ],
      loading: false,
      error: null,
      removeLog: vi.fn(),
      updateLog: vi.fn()
    });

    render(<GameLogs enabled idToken="token-123" />);

    const sortSelect = screen.getByLabelText('Sort');
    await user.selectOptions(sortSelect, 'result');

    let deckNames = screen.getAllByText(/Loss Deck|Win Deck/).map((node) => node.textContent);
    expect(deckNames[0]).toBe('Win Deck');

    await user.click(screen.getByRole('button', { name: /Sort ascending/ }));
    deckNames = screen.getAllByText(/Loss Deck|Win Deck/).map((node) => node.textContent);
    expect(deckNames[0]).toBe('Loss Deck');
  });

  it('sorts by game length minutes and turns', async () => {
    const user = userEvent.setup();
    mockUseGameLogs.mockReturnValue({
      logs: [
        baseLog({ id: 'log-1', deckName: 'Short Game', durationMinutes: 45, turns: 6 }),
        baseLog({ id: 'log-2', deckName: 'Long Game', durationMinutes: 120, turns: 10 })
      ],
      loading: false,
      error: null,
      removeLog: vi.fn(),
      updateLog: vi.fn()
    });

    render(<GameLogs enabled idToken="token-123" />);

    const sortSelect = screen.getByLabelText('Sort');
    await user.selectOptions(sortSelect, 'durationMinutes');

    let deckNames = screen.getAllByText(/Short Game|Long Game/).map((node) => node.textContent);
    expect(deckNames[0]).toBe('Long Game');

    await user.selectOptions(sortSelect, 'turns');
    deckNames = screen.getAllByText(/Short Game|Long Game/).map((node) => node.textContent);
    expect(deckNames[0]).toBe('Long Game');
  });

  it('restores saved sort preferences', () => {
    localStorage.setItem('btr:game-logs-sort', JSON.stringify({ key: 'deckName', dir: 'asc' }));
    mockUseGameLogs.mockReturnValue({
      logs: [
        baseLog({ id: 'log-1', deckName: 'Zulu Deck', playedAt: '2026-01-10' }),
        baseLog({ id: 'log-2', deckName: 'Alpha Deck', playedAt: '2026-01-12' })
      ],
      loading: false,
      error: null,
      removeLog: vi.fn(),
      updateLog: vi.fn()
    });

    render(<GameLogs enabled idToken="token-123" />);

    const sortSelect = screen.getByLabelText('Sort') as HTMLSelectElement;
    expect(sortSelect.value).toBe('deckName');

    const deckNames = screen.getAllByText(/Zulu Deck|Alpha Deck/).map((node) => node.textContent);
    expect(deckNames[0]).toBe('Alpha Deck');
  });
});
