import axios, { AxiosInstance } from 'axios';
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

      return this.transformScryfallCard(response.data);
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Card not found
        return null;
      }
      console.error('Scryfall API error:', error.message);
      throw new Error(`Failed to search for card: ${error.message}`);
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

      return response.data.data.map((card: any) => this.transformScryfallCard(card));
    } catch (error: any) {
      if (error.response?.status === 404) {
        // No cards found
        return [];
      }
      console.error('Scryfall API error:', error.message);
      throw new Error(`Failed to search cards: ${error.message}`);
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

      for (const item of response.data.data || []) {
        if (item.object === 'card') {
          cards.push(this.transformScryfallCard(item));
        } else if (item.object === 'not_found' && item.name) {
          notFound.push(item.name);
        }
      }

      return { cards, notFound };
    } catch (error: any) {
      console.error('Scryfall API error:', error.message);
      throw new Error(`Failed to fetch card collection: ${error.message}`);
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

      return this.transformScryfallCard(response.data);
    } catch (error: any) {
      console.error('Scryfall API error:', error.message);
      throw new Error(`Failed to get random commander: ${error.message}`);
    }
  }

  /**
   * Get card rulings
   */
  async getCardRulings(cardId: string): Promise<string[]> {
    try {
      await this.respectRateLimit();

      const response = await this.client.get(`/cards/${cardId}/rulings`);

      return response.data.data.map((ruling: any) =>
        `[${ruling.published_at}] ${ruling.comment}`
      );
    } catch (error: any) {
      console.error('Scryfall API error:', error.message);
      return [];
    }
  }

  /**
   * Transform Scryfall API response to our Card type
   */
  private transformScryfallCard(scryfallCard: any): Card {
    const imageUris =
      scryfallCard.image_uris ||
      (Array.isArray(scryfallCard.card_faces) ? scryfallCard.card_faces[0]?.image_uris : undefined);
    return {
      id: scryfallCard.id,
      name: scryfallCard.name,
      mana_cost: scryfallCard.mana_cost,
      type_line: scryfallCard.type_line,
      oracle_text: scryfallCard.oracle_text,
      colors: scryfallCard.colors,
      color_identity: scryfallCard.color_identity,
      power: scryfallCard.power,
      toughness: scryfallCard.toughness,
      loyalty: scryfallCard.loyalty,
      image_uris: imageUris
    };
  }
}

// Export a singleton instance
export const scryfallService = new ScryfallService();
