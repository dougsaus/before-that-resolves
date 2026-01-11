import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeckCollection, type DeckEntry } from './DeckCollection';
import { buildApiUrl } from '../utils/api';

const baseDeck = (overrides: Partial<DeckEntry> = {}): DeckEntry => ({
  id: 'deck-1',
  name: 'Alpha',
  url: null,
  commanderNames: [],
  colorIdentity: null,
  source: 'manual',
  addedAt: '2025-01-01T00:00:00.000Z',
  stats: null,
  ...overrides
});

const defaultProps = {
  enabled: true,
  idToken: 'token-123',
  decks: [] as DeckEntry[],
  loading: false,
  deckError: null,
  onCreateDeck: vi.fn().mockResolvedValue(true),
  onUpdateDeck: vi.fn().mockResolvedValue(true),
  onPreviewDeck: vi.fn().mockResolvedValue({ deck: undefined, error: 'Not found' }),
  onRemoveDeck: vi.fn()
};

describe('DeckCollection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders sortable headers and sorts rows', async () => {
    const user = userEvent.setup();
    const decks = [
      baseDeck({ id: 'deck-1', name: 'Beta', commanderNames: ['Zed'], colorIdentity: ['R'] }),
      baseDeck({ id: 'deck-2', name: 'Alpha', commanderNames: ['Abe'], colorIdentity: ['G'] })
    ];

    render(<DeckCollection {...defaultProps} decks={decks} />);

    const table = screen.getByRole('table');
    expect(within(table).getByRole('button', { name: /^Deck/ })).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: /^Commander/ })).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: /^Color identity/ })).toBeInTheDocument();

    let rows = within(table).getAllByRole('row');
    expect(within(rows[1]).getByText('Alpha')).toBeInTheDocument();

    await user.click(within(table).getByRole('button', { name: /^Deck/ }));

    rows = within(table).getAllByRole('row');
    expect(within(rows[1]).getByText('Beta')).toBeInTheDocument();

    await user.click(within(table).getByRole('button', { name: /^Commander/ }));

    rows = within(table).getAllByRole('row');
    expect(within(rows[1]).getByText('Alpha')).toBeInTheDocument();
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

  it('loads deck details from an Archidekt link', async () => {
    const user = userEvent.setup();
    const onPreviewDeck = vi.fn().mockResolvedValue({
      deck: {
        id: 'deck-42',
        name: 'Archidekt Preview',
        url: 'https://archidekt.com/decks/42/preview',
        commanderNames: ['Giada, Font of Hope'],
        colorIdentity: ['W']
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

    expect(screen.getByLabelText('Deck name (required)')).toHaveValue('Archidekt Preview');
    expect(screen.getByLabelText('Commander name(s) (optional)')).toHaveValue('Giada, Font of Hope');
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

    const table = screen.getByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Edit Alpha' }));

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

  it('only shows Oracle button for Archidekt links', () => {
    const onOpenInOracle = vi.fn();
    const decks = [
      baseDeck({ id: 'deck-1', name: 'Manual Link', url: 'https://example.com/deck' }),
      baseDeck({ id: 'deck-2', name: 'Archidekt Link', url: 'https://archidekt.com/decks/12/test' })
    ];

    render(<DeckCollection {...defaultProps} decks={decks} onOpenInOracle={onOpenInOracle} />);

    const table = screen.getByRole('table');
    expect(within(table).queryByRole('button', { name: 'Open Manual Link in Oracle' })).toBeNull();
    expect(within(table).getByRole('button', { name: 'Open Archidekt Link in Oracle' })).toBeInTheDocument();
  });

  it('confirms before removing a deck', async () => {
    const user = userEvent.setup();
    const onRemoveDeck = vi.fn().mockResolvedValue(undefined);
    const decks = [baseDeck({ id: 'deck-1', name: 'Delete Me' })];

    render(<DeckCollection {...defaultProps} decks={decks} onRemoveDeck={onRemoveDeck} />);

    const table = screen.getByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Remove Delete Me' }));
    expect(screen.getByText('Remove deck?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onRemoveDeck).not.toHaveBeenCalled();
    expect(screen.queryByText('Remove deck?')).not.toBeInTheDocument();

    await user.click(within(table).getByRole('button', { name: 'Remove Delete Me' }));
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

    const table = screen.getByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Log game for Alpha' }));

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
