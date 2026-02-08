import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeckCollection, type DeckEntry } from './DeckCollection';
import { buildApiUrl } from '../utils/api';

const baseDeck = (overrides: Partial<DeckEntry> = {}): DeckEntry => ({
  id: 'deck-1',
  name: 'Alpha',
  url: null,
  commanderNames: [],
  commanderLinks: [],
  colorIdentity: null,
  source: 'manual',
  addedAt: '2025-01-01T00:00:00.000Z',
  stats: null,
  ...overrides
});

const defaultProps = {
  enabled: true,
  authStatus: 'authenticated' as const,
  authError: null,
  authButtonRef: vi.fn(),
  onAuthExpired: vi.fn(),
  decks: [] as DeckEntry[],
  loading: false,
  deckError: null,
  onCreateDeck: vi.fn().mockResolvedValue(true),
  onUpdateDeck: vi.fn().mockResolvedValue(true),
  onPreviewDeck: vi.fn().mockResolvedValue({ deck: undefined, error: 'Not found' }),
  onPreviewBulkDecks: vi.fn().mockResolvedValue({ decks: [] }),
  onRemoveDeck: vi.fn(),
  onBulkImportDecks: vi.fn().mockResolvedValue({ success: true, failures: [] })
};

describe('DeckCollection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  const getDeckOrder = () =>
    screen
      .getAllByRole('button', { name: /^Edit / })
      .map((button) => (button.getAttribute('aria-label') || '').replace(/^Edit /, ''));

  it('shows the deck count in the header', () => {
    const decks = [baseDeck({ id: 'deck-1' }), baseDeck({ id: 'deck-2', name: 'Beta' })];

    render(<DeckCollection {...defaultProps} decks={decks} />);

    expect(screen.getByText('2 total')).toBeInTheDocument();
  });

  it('shows 32 challenge collapsed by default and expands with progress/details', async () => {
    const user = userEvent.setup();
    const decks = [
      baseDeck({ id: 'deck-w-1', name: 'White One', commanderNames: ['Giada'], colorIdentity: ['W'] }),
      baseDeck({ id: 'deck-w-2', name: 'White Two', commanderNames: ['Adeline'], colorIdentity: ['W'] }),
      baseDeck({ id: 'deck-ub', name: 'Dimir Deck', commanderNames: ['Yuriko'], colorIdentity: ['U', 'B'] }),
      baseDeck({ id: 'deck-c', name: 'Colorless Deck', commanderNames: ['Kozilek'], colorIdentity: [] }),
      baseDeck({ id: 'deck-unknown', name: 'Unknown Colors', commanderNames: ['Mystery'], colorIdentity: null })
    ];

    render(<DeckCollection {...defaultProps} decks={decks} />);

    expect(screen.queryByText('3 of 32 colors completed')).not.toBeInTheDocument();
    expect(screen.queryByText('White One — Giada')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /32 Deck Challenge \(3\/32\)/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /32 Deck Challenge \(3\/32\)/ }));

    expect(screen.getByText('3 of 32 colors completed')).toBeInTheDocument();
    expect(screen.getByText('White One — Giada')).toBeInTheDocument();
    expect(screen.getByText('White Two — Adeline')).toBeInTheDocument();
    expect(screen.getByText('Dimir Deck — Yuriko')).toBeInTheDocument();
    expect(screen.getByText('Colorless Deck — Kozilek')).toBeInTheDocument();
  });

  it('renders sort controls and sorts cards', async () => {
    const user = userEvent.setup();
    const decks = [
      baseDeck({ id: 'deck-1', name: 'Beta', commanderNames: ['Abe'], colorIdentity: ['R'] }),
      baseDeck({ id: 'deck-2', name: 'Alpha', commanderNames: ['Zed'], colorIdentity: ['G'] })
    ];

    render(<DeckCollection {...defaultProps} decks={decks} />);

    const sortSelect = screen.getByLabelText('Sort');
    expect(sortSelect).toBeInTheDocument();

    let deckNames = getDeckOrder();
    expect(deckNames[0]).toBe('Alpha');

    await user.selectOptions(sortSelect, 'commander');

    deckNames = getDeckOrder();
    expect(deckNames[0]).toBe('Beta');

    await user.click(screen.getByRole('button', { name: /Sort descending/ }));

    deckNames = getDeckOrder();
    expect(deckNames[0]).toBe('Alpha');
  });

  it('sorts by game stats', async () => {
    const user = userEvent.setup();
    const decks = [
      baseDeck({
        id: 'deck-1',
        name: 'Low Stats',
        stats: { totalGames: 2, wins: 1, losses: 1, winRate: 0.5, lastPlayed: '2024-01-10' }
      }),
      baseDeck({
        id: 'deck-2',
        name: 'High Stats',
        stats: { totalGames: 9, wins: 7, losses: 2, winRate: 0.78, lastPlayed: '2024-02-20' }
      })
    ];

    render(<DeckCollection {...defaultProps} decks={decks} />);

    const sortSelect = screen.getByLabelText('Sort');
    await user.selectOptions(sortSelect, 'games');

    let deckNames = getDeckOrder();
    expect(deckNames[0]).toBe('High Stats');

    await user.selectOptions(sortSelect, 'lastPlayed');

    deckNames = getDeckOrder();
    expect(deckNames[0]).toBe('High Stats');
  });

  it('restores saved sort preferences', () => {
    localStorage.setItem('btr:deck-sort', JSON.stringify({ key: 'games', dir: 'desc' }));
    const decks = [
      baseDeck({
        id: 'deck-1',
        name: 'Low Stats',
        stats: { totalGames: 2, wins: 1, losses: 1, winRate: 0.5, lastPlayed: '2024-01-10' }
      }),
      baseDeck({
        id: 'deck-2',
        name: 'High Stats',
        stats: { totalGames: 9, wins: 7, losses: 2, winRate: 0.78, lastPlayed: '2024-02-20' }
      })
    ];

    render(<DeckCollection {...defaultProps} decks={decks} />);

    const sortSelect = screen.getByLabelText('Sort') as HTMLSelectElement;
    expect(sortSelect.value).toBe('games');

    const deckNames = getDeckOrder();
    expect(deckNames[0]).toBe('High Stats');
  });

  it('falls back to wins/losses when total games is zero', () => {
    const decks = [
      baseDeck({
        id: 'deck-1',
        name: 'Fallback Stats',
        stats: { totalGames: 0, wins: 2, losses: 1, winRate: 0.66, lastPlayed: '2024-02-20' }
      })
    ];

    render(<DeckCollection {...defaultProps} decks={decks} />);

    const gamesLabel = screen.getByText('Games');
    expect(gamesLabel.parentElement).toHaveTextContent('Games 3');
  });

  it('opens the deck modal and validates required fields', async () => {
    const user = userEvent.setup();
    const onCreateDeck = vi.fn().mockResolvedValue(true);

    render(<DeckCollection {...defaultProps} onCreateDeck={onCreateDeck} />);

    await user.click(screen.getByRole('button', { name: /\+\s*Deck/ }));

    expect(screen.getByText('Add deck')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add Deck' }));
    expect(screen.getByText('Deck name is required.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Deck name (required)'), 'My Manual Deck');
    await user.click(screen.getByRole('button', { name: 'Add Deck' }));

    await waitFor(() => {
      expect(onCreateDeck).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'My Manual Deck' })
      );
    });

    await waitFor(() => {
      expect(screen.queryByText('Add deck')).not.toBeInTheDocument();
    });
  });

  it('allows adding a second commander name', async () => {
    const user = userEvent.setup();
    const onCreateDeck = vi.fn().mockResolvedValue(true);

    render(<DeckCollection {...defaultProps} onCreateDeck={onCreateDeck} />);

    await user.click(screen.getByRole('button', { name: /\+\s*Deck/ }));
    await user.type(screen.getByLabelText('Deck name (required)'), 'Two Commanders');

    await user.click(screen.getByRole('button', { name: '+ Commander' }));

    const commanderInputs = screen.getAllByLabelText('Commander name');
    expect(commanderInputs).toHaveLength(2);

    await user.type(commanderInputs[0], 'Tymna the Weaver');
    await user.type(commanderInputs[1], 'Kraum');

    await user.click(screen.getByRole('button', { name: 'Add Deck' }));

    await waitFor(() => {
      expect(onCreateDeck).toHaveBeenCalledWith(
        expect.objectContaining({ commanderNames: ['Tymna the Weaver', 'Kraum'] })
      );
    });
  });

  it('loads deck details from a deck link', async () => {
    const user = userEvent.setup();
    const onPreviewDeck = vi.fn().mockResolvedValue({
      deck: {
        id: 'deck-42',
        name: 'Deck Preview',
        url: 'https://archidekt.com/decks/42/preview',
        commanderNames: ['Giada, Font of Hope'],
        colorIdentity: ['W'],
        source: 'archidekt'
      }
    });

    render(<DeckCollection {...defaultProps} onPreviewDeck={onPreviewDeck} />);

    await user.click(screen.getByRole('button', { name: /\+\s*Deck/ }));

    const loadButton = screen.getByRole('button', { name: 'Load deck' });
    expect(loadButton).toBeDisabled();

    await user.type(
      screen.getByLabelText('Deck link (optional)'),
      'https://archidekt.com/decks/42/preview'
    );

    await waitFor(() => {
      expect(loadButton).toBeEnabled();
    });

    await user.click(loadButton);

    await waitFor(() => {
      expect(onPreviewDeck).toHaveBeenCalledWith('https://archidekt.com/decks/42/preview');
    });

    expect(screen.getByLabelText('Deck name (required)')).toHaveValue('Deck Preview');
    expect(screen.getByLabelText('Commander(s) (optional)')).toHaveValue('Giada, Font of Hope');
  });

  it('loads bulk import candidates and submits selected decks', async () => {
    const user = userEvent.setup();
    const onPreviewBulkDecks = vi.fn().mockResolvedValue({
      decks: [
        {
          id: 'deck-1',
          name: 'Bulk One',
          url: 'https://archidekt.com/decks/1',
          format: null,
          source: 'archidekt'
        },
        {
          id: 'deck-2',
          name: 'Bulk Two',
          url: 'https://moxfield.com/decks/2',
          format: 'commander',
          source: 'moxfield'
        }
      ]
    });
    const onBulkImportDecks = vi.fn().mockResolvedValue({ success: true, failures: [] });

    render(
      <DeckCollection
        {...defaultProps}
        onPreviewBulkDecks={onPreviewBulkDecks}
        onBulkImportDecks={onBulkImportDecks}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Bulk import' }));
    await user.type(screen.getByLabelText('Profile link'), 'https://archidekt.com/u/bulk');
    await user.click(screen.getByRole('button', { name: 'Load decks' }));

    await waitFor(() => {
      expect(onPreviewBulkDecks).toHaveBeenCalledWith('https://archidekt.com/u/bulk');
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);

    await user.click(screen.getByRole('button', { name: 'Import selected' }));

    await waitFor(() => {
      expect(onBulkImportDecks).toHaveBeenCalledWith(['https://archidekt.com/decks/1']);
    });
  });

  it('loads deck details from a Moxfield link', async () => {
    const user = userEvent.setup();
    const onPreviewDeck = vi.fn().mockResolvedValue({
      deck: {
        id: 'deck-99',
        name: 'Moxfield Preview',
        url: 'https://moxfield.com/decks/abc123',
        commanderNames: ["Atraxa, Praetors' Voice"],
        colorIdentity: ['W', 'U', 'B', 'G'],
        source: 'moxfield'
      }
    });

    render(<DeckCollection {...defaultProps} onPreviewDeck={onPreviewDeck} />);

    await user.click(screen.getByRole('button', { name: /\+\s*Deck/ }));

    const loadButton = screen.getByRole('button', { name: 'Load deck' });
    expect(loadButton).toBeDisabled();

    await user.type(
      screen.getByLabelText('Deck link (optional)'),
      'https://moxfield.com/decks/abc123'
    );

    await waitFor(() => {
      expect(loadButton).toBeEnabled();
    });

    await user.click(loadButton);

    await waitFor(() => {
      expect(onPreviewDeck).toHaveBeenCalledWith('https://moxfield.com/decks/abc123');
    });

    expect(screen.getByLabelText('Deck name (required)')).toHaveValue('Moxfield Preview');
    expect(screen.getByLabelText('Commander(s) (optional)')).toHaveValue("Atraxa, Praetors' Voice");
  });

  it('opens edit modal and saves updates', async () => {
    const user = userEvent.setup();
    const onUpdateDeck = vi.fn().mockResolvedValue(true);
    const decks = [
      baseDeck({
        id: 'deck-1',
        name: 'Alpha',
        url: 'https://example.com/deck',
        commanderNames: ['Niv-Mizzet'],
        colorIdentity: ['U', 'R']
      })
    ];

    render(<DeckCollection {...defaultProps} decks={decks} onUpdateDeck={onUpdateDeck} />);

    await user.click(screen.getByRole('button', { name: 'Edit Alpha' }));

    expect(screen.getByText('Edit deck')).toBeInTheDocument();
    expect(screen.getByLabelText('Deck name (required)')).toHaveValue('Alpha');

    await user.clear(screen.getByLabelText('Deck name (required)'));
    await user.type(screen.getByLabelText('Deck name (required)'), 'Alpha Updated');
    await user.click(screen.getByRole('button', { name: 'Save Deck' }));

    await waitFor(() => {
      expect(onUpdateDeck).toHaveBeenCalledWith(
        'deck-1',
        expect.objectContaining({ name: 'Alpha Updated' })
      );
    });
  });

  it('only shows Oracle button for supported deck links', () => {
    const onOpenInOracle = vi.fn();
    const decks = [
      baseDeck({ id: 'deck-1', name: 'Manual Link', url: 'https://example.com/deck' }),
      baseDeck({ id: 'deck-2', name: 'Archidekt Link', url: 'https://archidekt.com/decks/12/test' }),
      baseDeck({ id: 'deck-3', name: 'Moxfield Link', url: 'https://moxfield.com/decks/abc123' })
    ];

    render(<DeckCollection {...defaultProps} decks={decks} onOpenInOracle={onOpenInOracle} />);

    expect(screen.queryByRole('button', { name: 'Open Manual Link in Oracle' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open Archidekt Link in Oracle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Moxfield Link in Oracle' })).toBeInTheDocument();
  });

  it('confirms before removing a deck', async () => {
    const user = userEvent.setup();
    const onRemoveDeck = vi.fn().mockResolvedValue(undefined);
    const decks = [baseDeck({ id: 'deck-1', name: 'Delete Me' })];

    render(<DeckCollection {...defaultProps} decks={decks} onRemoveDeck={onRemoveDeck} />);

    await user.click(screen.getByRole('button', { name: 'Remove Delete Me' }));
    expect(screen.getByText('Remove deck?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onRemoveDeck).not.toHaveBeenCalled();
    expect(screen.queryByText('Remove deck?')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Delete Me' }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(onRemoveDeck).toHaveBeenCalledWith('deck-1');
    });
  });

  it('opens the log modal and saves a game log', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, logs: [] })
    });
    vi.stubGlobal('fetch', fetchMock);
    const decks = [baseDeck({ id: 'deck-1', name: 'Alpha' })];

    render(<DeckCollection {...defaultProps} decks={decks} />);

    await user.click(screen.getByRole('button', { name: 'Log game for Alpha' }));

    expect(screen.getByText('Log a game')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save log' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        buildApiUrl('/api/game-logs'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
