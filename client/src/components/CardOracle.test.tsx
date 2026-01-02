import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import { DevModeProvider } from '../contexts/DevModeContext';
import { CardOracle } from './CardOracle';

vi.mock('axios', () => ({
  default: {
    post: vi.fn()
  }
}));

const mockedAxios = axios as unknown as { post: ReturnType<typeof vi.fn> };
let createdAnchor: HTMLAnchorElement | null = null;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderCardOracle() {
  return render(
    <DevModeProvider>
      <CardOracle />
    </DevModeProvider>
  );
}

describe('CardOracle chat UI', () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:chat');
    globalThis.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    createdAnchor = null;
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
      if (tagName === 'a') {
        createdAnchor = element as HTMLAnchorElement;
      }
      return element as HTMLElement;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders deck loader and chat input', () => {
    renderCardOracle();

    expect(screen.getByText('Deck list URL to discuss with The Oracle')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://archidekt.com/decks/...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type a question to the Oracle...')).toBeInTheDocument();
  });

  it('shows a thinking bubble and disables input while loading', async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<any>();

    mockedAxios.post.mockReturnValue(deferred.promise);

    renderCardOracle();

    const input = screen.getByPlaceholderText('Type a question to the Oracle...');
    await user.type(input, 'What is Sol Ring?');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(input).toBeDisabled();
    expect(screen.getByText('Thinking')).toBeInTheDocument();

    deferred.resolve({
      data: {
        success: true,
        response: 'Sol Ring is a powerful mana rock.'
      }
    });

    await waitFor(() => {
      expect(screen.queryByText('Thinking')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Sol Ring is a powerful mana rock.')).toBeInTheDocument();
  });

  it('renders errors inside the chat window', async () => {
    const user = userEvent.setup();
    mockedAxios.post.mockRejectedValue({
      response: { data: { error: 'Server unavailable' } }
    });

    renderCardOracle();

    const input = screen.getByPlaceholderText('Type a question to the Oracle...');
    await user.type(input, 'What is Black Lotus?');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(screen.getByText('Server unavailable')).toBeInTheDocument();
    });
  });

  it('clears the input after sending a message', async () => {
    const user = userEvent.setup();
    mockedAxios.post.mockResolvedValue({
      data: {
        success: true,
        response: 'Response'
      }
    });

    renderCardOracle();

    const input = screen.getByPlaceholderText('Type a question to the Oracle...');
    await user.type(input, 'Hello');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('does not add a user message when loading a deck', async () => {
    const user = userEvent.setup();
    mockedAxios.post
      .mockResolvedValueOnce({ data: { success: true } })
      .mockResolvedValueOnce({ data: { success: true } });

    renderCardOracle();

    const deckInput = screen.getByPlaceholderText('https://archidekt.com/decks/...');
    await user.type(deckInput, 'https://archidekt.com/decks/17352990/the_world_is_a_vampire');
    await user.click(screen.getByRole('button', { name: 'Load Deck' }));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:3001/api/deck/cache',
        {
          deckUrl: 'https://archidekt.com/decks/17352990/the_world_is_a_vampire'
        }
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Analyze Deck' })).toBeEnabled();
    });

    expect(screen.queryByText(/Analyze this Commander deck/i)).not.toBeInTheDocument();
  });

  it('includes selected deck analysis sections in order', async () => {
    const user = userEvent.setup();
    mockedAxios.post
      .mockResolvedValueOnce({ data: { success: true } })
      .mockResolvedValueOnce({ data: { success: true } })
      .mockResolvedValueOnce({
        data: {
          success: true,
          response: 'Deck analysis response'
        }
      });

    renderCardOracle();

    const deckInput = screen.getByPlaceholderText('https://archidekt.com/decks/...');
    await user.type(deckInput, 'https://archidekt.com/decks/17352990/the_world_is_a_vampire');
    await user.click(screen.getByRole('button', { name: 'Load Deck' }));
    const analyzeButton = screen.getByRole('button', { name: 'Analyze Deck' });
    await waitFor(() => {
      expect(analyzeButton).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: 'Analyze Deck' }));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalled();
    });

    const [, payload] = mockedAxios.post.mock.calls[2];
    const query = payload.query as string;
    const summaryIndex = query.indexOf('Summarize the deck');
    const winConsIndex = query.indexOf('Win Conditions');
    const bracketIndex = query.indexOf('Provide an assessment of what bracket');
    const weaknessesIndex = query.indexOf('Find potential weaknesses of the deck');

    expect(summaryIndex).toBeGreaterThan(-1);
    expect(winConsIndex).toBeGreaterThan(summaryIndex);
    expect(bracketIndex).toBeGreaterThan(winConsIndex);
    expect(weaknessesIndex).toBeGreaterThan(bracketIndex);
  });

  it('builds a goldfish prompt with selected metrics', async () => {
    const user = userEvent.setup();
    mockedAxios.post
      .mockResolvedValueOnce({ data: { success: true } })
      .mockResolvedValueOnce({ data: { success: true } })
      .mockResolvedValueOnce({
        data: {
          success: true,
          response: 'Goldfish response'
        }
      });

    renderCardOracle();

    const deckInput = screen.getByPlaceholderText('https://archidekt.com/decks/...');
    await user.type(deckInput, 'https://archidekt.com/decks/17352990/the_world_is_a_vampire');
    await user.click(screen.getByRole('button', { name: 'Load Deck' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Goldfish Deck' })).toBeEnabled();
    });

    const gamesInput = screen.getByLabelText('Games') as HTMLInputElement;
    await user.clear(gamesInput);
    await user.type(gamesInput, '3');

    const turnsInput = screen.getByLabelText('Turns') as HTMLInputElement;
    await user.clear(turnsInput);
    await user.type(turnsInput, '7');

    await user.click(screen.getByLabelText('Damage generated'));
    await user.click(screen.getByRole('button', { name: 'Goldfish Deck' }));

    const [, payload] = mockedAxios.post.mock.calls[2];
    const query = payload.query as string;

    expect(query).toContain('Goldfish this deck.');
    expect(query).toContain('Simulate 3 games going 7 turns.');
    expect(query).toContain('Track the following metrics: mana generation, commander cast turn, extra cards drawn (do not count upkeep and opening hand).');
    expect(query).toContain('Summarize the results of the simulations.');
  });

  it('omits metrics section when none selected', async () => {
    const user = userEvent.setup();
    mockedAxios.post
      .mockResolvedValueOnce({ data: { success: true } })
      .mockResolvedValueOnce({ data: { success: true } })
      .mockResolvedValueOnce({
        data: {
          success: true,
          response: 'Goldfish response'
        }
      });

    renderCardOracle();

    const deckInput = screen.getByPlaceholderText('https://archidekt.com/decks/...');
    await user.type(deckInput, 'https://archidekt.com/decks/17352990/the_world_is_a_vampire');
    await user.click(screen.getByRole('button', { name: 'Load Deck' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Goldfish Deck' })).toBeEnabled();
    });

    await user.click(screen.getByLabelText('Mana generation'));
    await user.click(screen.getByLabelText('Commander cast turn'));
    await user.click(screen.getByLabelText('Damage generated'));
    await user.click(screen.getByLabelText('Extra cards drawn'));

    await user.click(screen.getByRole('button', { name: 'Goldfish Deck' }));

    const [, payload] = mockedAxios.post.mock.calls[2];
    const query = payload.query as string;

    expect(query).toContain('Goldfish this deck.');
    expect(query).toContain('Simulate 1 games going 7 turns.');
    expect(query).not.toContain('Track the following metrics:');
  });

  it('renders markdown emphasis in agent messages', async () => {
    const user = userEvent.setup();
    mockedAxios.post.mockResolvedValue({
      data: {
        success: true,
        response: 'This is **bold** text.'
      }
    });

    renderCardOracle();

    const input = screen.getByPlaceholderText('Type a question to the Oracle...');
    await user.type(input, 'Test markdown');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    const boldText = await screen.findByText('bold');
    expect(boldText.tagName.toLowerCase()).toBe('strong');
  });

  it('renders markdown links with card name only and new tab behavior', async () => {
    const user = userEvent.setup();
    mockedAxios.post.mockResolvedValue({
      data: {
        success: true,
        response: '[Sol Ring](https://scryfall.com/search?q=!%22Sol%20Ring%22)'
      }
    });

    renderCardOracle();

    const input = screen.getByPlaceholderText('Type a question to the Oracle...');
    await user.type(input, 'Link test');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    const link = await screen.findByRole('link', { name: 'Sol Ring' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('normalizes multi-line markdown links in agent messages', async () => {
    const user = userEvent.setup();
    mockedAxios.post.mockResolvedValue({
      data: {
        success: true,
        response: '[Rhox\\n Faithmender](https://scryfall.com/search?q=!\"Rhox\\n Faithmender\")'
      }
    });

    renderCardOracle();

    const input = screen.getByPlaceholderText('Type a question to the Oracle...');
    await user.type(input, 'Link normalize');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    const link = await screen.findByRole('link', { name: 'Rhox Faithmender' });
    expect(link).toHaveAttribute(
      'href',
      'https://scryfall.com/search?q=!%22Rhox%20Faithmender%22'
    );
  });

  it('exports the chat window as a PDF with a default filename', async () => {
    const user = userEvent.setup();
    mockedAxios.post
      .mockResolvedValueOnce({
        data: {
          success: true,
          response: 'Export me'
        }
      })
      .mockResolvedValueOnce({
        data: new Blob(['pdf'], { type: 'application/pdf' })
      });

    renderCardOracle();

    const input = screen.getByPlaceholderText('Type a question to the Oracle...');
    await user.type(input, 'Export test');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await screen.findByText('Export me');

    await user.click(screen.getByRole('button', { name: 'Export conversation to pdf' }));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:3001/api/chat/export-pdf',
        expect.objectContaining({
          title: 'Before That Resolves',
          subtitle: 'Commander Deck Analyzer & Strategy Assistant',
          deckUrl: undefined,
          messages: expect.any(Array)
        }),
        { responseType: 'blob' }
      );
    });

    expect(createdAnchor?.download).toBe('before-that-resolves-conversation.pdf');
  });

  it('uses the deck slug for the exported filename', async () => {
    const user = userEvent.setup();
    mockedAxios.post
      .mockResolvedValueOnce({ data: { success: true } })
      .mockResolvedValueOnce({ data: { success: true } })
      .mockResolvedValueOnce({
        data: {
          success: true,
          response: 'Deck ready'
        }
      })
      .mockResolvedValueOnce({ data: new Blob(['pdf'], { type: 'application/pdf' }) });

    renderCardOracle();

    const deckInput = screen.getByPlaceholderText('https://archidekt.com/decks/...');
    await user.type(deckInput, 'https://archidekt.com/decks/17524661/ms_badonkadonk');
    await user.click(screen.getByRole('button', { name: 'Load Deck' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Analyze Deck' })).toBeEnabled();
    });

    const input = screen.getByPlaceholderText('Type a question to the Oracle...');
    await user.type(input, 'Hello');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Deck ready');

    await user.click(screen.getByRole('button', { name: 'Export conversation to pdf' }));

    expect(createdAnchor?.download).toBe('ms_badonkadonk.pdf');
  });
});
