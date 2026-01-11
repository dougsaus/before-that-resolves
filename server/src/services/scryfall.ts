import axios, { AxiosInstance, isAxiosError } from 'axios';
import { Card } from '../types/shared';

/**
 * Scryfall API Service
 *
 * This service wraps the Scryfall API for MTG card data.
 * Scryfall is free but has rate limits (10 requests per second).
 * We'll add delays between requests to be respectful.
 *
 * Documentation: https://scryfall.com/docs/api
 */
export class ScryfallService {
  private client: AxiosInstance;
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 100; // 100ms between requests (10 per second max)

  constructor() {
    this.client = axios.create({
      baseURL: process.env.SCRYFALL_API_URL || 'https://api.scryfall.com',
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
      }
    });
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (isAxiosError(error)) {
      return error.message || fallback;
    }
    if (error instanceof Error) {
      return error.message || fallback;
    }
    return fallback;
  }

  /**
   * Ensures we don't exceed rate limits
   */
  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Search for cards by name (fuzzy match)
   */
  async searchCardByName(name: string): Promise<Card | null> {
    try {
      await this.respectRateLimit();

      // Use the /cards/named endpoint for fuzzy name matching
      const response = await this.client.get('/cards/named', {
        params: {
          fuzzy: name
        }
      });

      return this.transformScryfallCard(response.data as ScryfallCard);
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status === 404) {
        // Card not found
        return null;
      }
      const message = this.getErrorMessage(error, 'Scryfall request failed');
      console.error('Scryfall API error:', message);
      throw new Error(`Failed to search for card: ${message}`);
    }
  }

  /**
   * Search for multiple cards with a query
   */
  async searchCards(query: string, limit: number = 10): Promise<Card[]> {
    try {
      await this.respectRateLimit();

      const response = await this.client.get('/cards/search', {
        params: {
          q: query,
          limit
        }
      });

      const data = response.data as ScryfallSearchResponse;
      return data.data.map((card) => this.transformScryfallCard(card));
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status === 404) {
        // No cards found
        return [];
      }
      const message = this.getErrorMessage(error, 'Scryfall request failed');
      console.error('Scryfall API error:', message);
      throw new Error(`Failed to search cards: ${message}`);
    }
  }

  /**
   * Fetch a collection of specific cards by name
   */
  async getCardCollection(names: string[]): Promise<{ cards: Card[]; notFound: string[] }> {
    try {
      await this.respectRateLimit();

      const response = await this.client.post('/cards/collection', {
        identifiers: names.map((name) => ({ name }))
      });

      const cards: Card[] = [];
      const notFound: string[] = [];

      const data = response.data as ScryfallCollectionResponse;
      for (const item of data.data || []) {
        if (item.object === 'card') {
          cards.push(this.transformScryfallCard(item));
        } else if (item.object === 'not_found' && item.name) {
          notFound.push(item.name);
        }
      }

      return { cards, notFound };
    } catch (error: unknown) {
      const message = this.getErrorMessage(error, 'Scryfall request failed');
      console.error('Scryfall API error:', message);
      throw new Error(`Failed to fetch card collection: ${message}`);
    }
  }

  /**
   * Get a random commander (legendary creature)
   */
  async getRandomCommander(): Promise<Card | null> {
    try {
      await this.respectRateLimit();

      const response = await this.client.get('/cards/random', {
        params: {
          q: 'is:commander'
        }
      });

      return this.transformScryfallCard(response.data as ScryfallCard);
    } catch (error: unknown) {
      const message = this.getErrorMessage(error, 'Scryfall request failed');
      console.error('Scryfall API error:', message);
      throw new Error(`Failed to get random commander: ${message}`);
    }
  }

  /**
   * Get card rulings
   */
  async getCardRulings(cardId: string): Promise<string[]> {
    try {
      await this.respectRateLimit();

      const response = await this.client.get(`/cards/${cardId}/rulings`);

      const data = response.data as ScryfallRulingsResponse;
      return data.data.map((ruling) => `[${ruling.published_at}] ${ruling.comment}`);
    } catch (error: unknown) {
      const message = this.getErrorMessage(error, 'Scryfall request failed');
      console.error('Scryfall API error:', message);
      return [];
    }
  }

  /**
   * Transform Scryfall API response to our Card type
   */
  private transformScryfallCard(scryfallCard: ScryfallCard): Card {
    const imageUris =
      scryfallCard.image_uris ||
      (Array.isArray(scryfallCard.card_faces) ? scryfallCard.card_faces[0]?.image_uris : undefined);
    const cardFaces = Array.isArray(scryfallCard.card_faces)
      ? scryfallCard.card_faces.map((face) => ({
        name: face.name,
        mana_cost: face.mana_cost,
        type_line: face.type_line,
        oracle_text: face.oracle_text,
        colors: face.colors,
        power: face.power,
        toughness: face.toughness,
        loyalty: face.loyalty,
        image_uris: face.image_uris
      }))
      : undefined;
    return {
      id: scryfallCard.id,
      name: scryfallCard.name,
      layout: scryfallCard.layout,
      mana_cost: scryfallCard.mana_cost,
      type_line: scryfallCard.type_line,
      oracle_text: scryfallCard.oracle_text,
      colors: scryfallCard.colors,
      color_identity: scryfallCard.color_identity,
      power: scryfallCard.power,
      toughness: scryfallCard.toughness,
      loyalty: scryfallCard.loyalty,
      image_uris: imageUris,
      card_faces: cardFaces
    };
  }
}

type ScryfallCard = {
  id: string;
  name: string;
  layout?: string;
  mana_cost?: string;
  type_line: string;
  oracle_text?: string;
  colors?: string[];
  color_identity: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  image_uris?: Record<string, string>;
  card_faces?: ScryfallCardFace[];
};

type ScryfallCardFace = {
  name?: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  colors?: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  image_uris?: Record<string, string>;
};

type ScryfallSearchResponse = {
  data: ScryfallCard[];
};

type ScryfallCollectionResponse = {
  data: Array<ScryfallCard & { object: string; name?: string }>;
};

type ScryfallRulingsResponse = {
  data: Array<{ published_at: string; comment: string }>;
};

// Export a singleton instance
export const scryfallService = new ScryfallService();
