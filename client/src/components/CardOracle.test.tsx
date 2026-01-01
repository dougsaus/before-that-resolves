import { beforeEach, describe, expect, it, vi } from 'vitest';
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

    expect(screen.getByText('Loading deck...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:3001/api/deck/cache',
        {
          deckUrl: 'https://archidekt.com/decks/17352990/the_world_is_a_vampire'
        }
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Deck loaded and ready to analyze.')).toBeInTheDocument();
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
});
