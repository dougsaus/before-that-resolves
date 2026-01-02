import { describe, expect, it } from 'vitest';
import { extractScryfallCardNames } from './pdf';

describe('pdf service', () => {
  it('extracts unique card names from scryfall markdown links', () => {
    const messages = [
      {
        role: 'agent' as const,
        content:
          'Cards like [Sol Ring](https://scryfall.com/search?q=!%22Sol%20Ring%22) and [Sol  Ring](https://scryfall.com/search?q=!%22Sol%20Ring%22) are strong.'
      },
      {
        role: 'agent' as const,
        content: '[Rhox\\n Faithmender](https://scryfall.com/search?q=!%22Rhox%20Faithmender%22)'
      }
    ];

    const names = extractScryfallCardNames(messages);

    expect(names).toEqual(['Sol Ring', 'Rhox Faithmender']);
  });
});
