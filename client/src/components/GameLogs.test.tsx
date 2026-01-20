import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameLogs } from './GameLogs';
import type { GameLogEntry } from '../hooks/useGameLogs';

const mockUseGameLogs = vi.fn();
const mockUseOpponentUsers = vi.fn();
const mockUseOpponentDecks = vi.fn();

vi.mock('../hooks/useGameLogs', () => ({
  useGameLogs: (idToken: string | null) => mockUseGameLogs(idToken)
}));

vi.mock('../hooks/useOpponentUsers', () => ({
  useOpponentUsers: (idToken: string | null) => mockUseOpponentUsers(idToken)
}));

vi.mock('../hooks/useOpponentDecks', () => ({
  useOpponentDecks: (idToken: string | null) => mockUseOpponentDecks(idToken)
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
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation(async (input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/decks/preview')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            deck: { commanderNames: ['Atraxa, Praetors\' Voice'], colorIdentity: ['W', 'U', 'B', 'G'] }
          })
        } as Response;
      }
      if (url.includes('/api/scryfall/lookup')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            card: { name: 'Atraxa, Praetors\' Voice', scryfallUrl: 'https://scryfall.com/card/2xm/205/atraxa-praetors-voice' }
          })
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ success: true })
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    mockUseGameLogs.mockReturnValue({
      logs: [],
      loading: false,
      error: null,
      removeLog: vi.fn(),
      updateLog: vi.fn()
    });
    mockUseOpponentUsers.mockReturnValue({
      recentOpponents: [],
      recentError: null,
      recentLoading: false,
      searchResults: [],
      searchError: null,
      searchLoading: false,
      loadRecentOpponents: vi.fn(),
      searchOpponents: vi.fn().mockResolvedValue([]),
      clearSearch: vi.fn()
    });
    mockUseOpponentDecks.mockReturnValue({
      decksByUserId: {},
      loadingByUserId: {},
      errorByUserId: {},
      loadOpponentDecks: vi.fn().mockResolvedValue([])
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('sets opponent commanders from a selected deck', async () => {
    const user = userEvent.setup();
    const updateLog = vi.fn();
    mockUseGameLogs.mockReturnValue({
      logs: [
        baseLog({
          opponentsCount: 1,
          opponents: [{
            userId: null,
            name: 'Opponent',
            email: null,
            deckId: null,
            deckName: null,
            deckUrl: null,
            commanderNames: [],
            commanderLinks: [],
            colorIdentity: null
          }]
        })
      ],
      loading: false,
      error: null,
      removeLog: vi.fn(),
      updateLog
    });
    const searchOpponents = vi.fn().mockResolvedValue([{ id: 'user-42', name: 'Opponent', email: 'opp@test.dev' }]);
    mockUseOpponentUsers.mockReturnValue({
      recentOpponents: [],
      recentError: null,
      recentLoading: false,
      searchResults: [],
      searchError: null,
      searchLoading: false,
      loadRecentOpponents: vi.fn(),
      searchOpponents,
      clearSearch: vi.fn()
    });
    mockUseOpponentDecks.mockReturnValue({
      decksByUserId: {
        'user-42': [
          {
            id: 'deck-99',
            name: 'Nightmare',
            url: 'https://moxfield.com/decks/xyz',
            commanderNames: ['Atraxa, Praetors\' Voice'],
            commanderLinks: ['https://scryfall.com/card/2xm/205/atraxa-praetors-voice'],
            colorIdentity: ['W', 'U', 'B', 'G']
          }
        ]
      },
      loadingByUserId: { 'user-42': false },
      errorByUserId: { 'user-42': null },
      loadOpponentDecks: vi.fn().mockResolvedValue([])
    });

    render(<GameLogs enabled idToken="token-123" />);

    await user.click(screen.getByRole('button', { name: /Edit Alpha Deck/i }));

    const searchButton = screen.getByRole('button', { name: 'Search' });
    await user.click(searchButton);

    const deckSelect = await screen.findByLabelText('Opponent deck');
    expect(deckSelect).toHaveTextContent('Nightmare — Atraxa, Praetors\' Voice');

    await user.selectOptions(deckSelect, 'deck-99');

    const commanderInput = screen.getByPlaceholderText('Commander 1') as HTMLInputElement;
    expect(commanderInput.value).toBe('Atraxa, Praetors\' Voice');
    expect(screen.getByText("Atraxa, Praetors' Voice on Scryfall")).toBeInTheDocument();
  });

  it('shows opponent deck name as a link in the log list', () => {
    mockUseGameLogs.mockReturnValue({
      logs: [
        baseLog({
          opponentsCount: 1,
          opponents: [
            {
              userId: 'user-7',
              name: 'Opponent',
              email: 'opp@test.dev',
              deckId: 'deck-7',
              deckName: 'Chaos Brew',
              deckUrl: 'https://archidekt.com/decks/7/chaos-brew',
              commanderNames: ['Norin the Wary'],
              commanderLinks: [null],
              colorIdentity: ['R']
            }
          ]
        })
      ],
      loading: false,
      error: null,
      removeLog: vi.fn(),
      updateLog: vi.fn()
    });

    render(<GameLogs enabled idToken="token-123" />);

    const deckLink = screen.getByRole('link', { name: 'Chaos Brew' });
    expect(deckLink).toHaveAttribute('href', 'https://archidekt.com/decks/7/chaos-brew');
    expect(screen.getByText('Norin the Wary')).toBeInTheDocument();
  });
});
