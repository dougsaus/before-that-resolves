import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeckCollection, type DeckEntry } from './DeckCollection';
import { buildApiUrl } from '../utils/api';

const baseDeck = (overrides: Partial<DeckEntry> = {}): DeckEntry => ({
  id: 'deck-1',
  name: 'Alpha',
  url: null,
  format: null,
  commanderNames: [],
  colorIdentity: null,
  source: 'manual',
  addedAt: '2025-01-01T00:00:00.000Z',
  ...overrides
});

const defaultProps = {
  enabled: true,
  idToken: 'token-123',
  decks: [] as DeckEntry[],
  loading: false,
  deckError: null,
  onAddArchidektDeck: vi.fn(),
  onAddManualDeck: vi.fn().mockResolvedValue(true),
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

  it('opens manual deck modal and validates required fields', async () => {
    const user = userEvent.setup();
    const onAddManualDeck = vi.fn().mockResolvedValue(true);

    render(<DeckCollection {...defaultProps} onAddManualDeck={onAddManualDeck} />);

    await user.click(screen.getByRole('button', { name: 'Add Deck Manually' }));

    expect(screen.getByText('Add manual deck')).toBeInTheDocument();

    const addButtons = screen.getAllByRole('button', { name: 'Add Deck' });
    const modalAddButton = addButtons[addButtons.length - 1];

    await user.click(modalAddButton);
    expect(screen.getByText('Deck name is required.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Deck name (required)'), 'My Manual Deck');
    await user.click(modalAddButton);

    await waitFor(() => {
      expect(onAddManualDeck).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'My Manual Deck' })
      );
    });

    await waitFor(() => {
      expect(screen.queryByText('Add manual deck')).not.toBeInTheDocument();
    });
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
