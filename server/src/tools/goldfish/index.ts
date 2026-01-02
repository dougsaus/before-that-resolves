import { z } from 'zod';
import { tool } from '@openai/agents';
import { getLastCachedArchidektDeck } from '../../services/deck';

type CardRef = {
  id: string;
  name: string;
};

type Zone = 'library' | 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'command' | 'revealed';

type DeckCard = {
  name: string;
  quantity: number;
  section?: string;
};

const zones = {
  library: [] as CardRef[],
  hand: [] as CardRef[],
  battlefield: [] as CardRef[],
  graveyard: [] as CardRef[],
  exile: [] as CardRef[],
  command: [] as CardRef[],
  revealed: [] as CardRef[]
};

let deckList: DeckCard[] | null = null;
let commanderName: string | null = null;
let cardIdCounter = 1;
let gameIdCounter = 1;
let rng = Math.random;

function createCardRef(name: string): CardRef {
  const id = `card_${cardIdCounter++}`;
  return { id, name };
}

function resetZones() {
  zones.library = [];
  zones.hand = [];
  zones.battlefield = [];
  zones.graveyard = [];
  zones.exile = [];
  zones.command = [];
  zones.revealed = [];
}

function setSeed(seed?: number) {
  if (seed === undefined || seed === null) {
    rng = Math.random;
    return;
  }

  let state = seed >>> 0;
  rng = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleArray<T>(input: T[]) {
  for (let i = input.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [input[i], input[j]] = [input[j], input[i]];
  }
}

function expandDeckList(list: DeckCard[]): CardRef[] {
  const cards: CardRef[] = [];
  list.forEach((card) => {
    for (let i = 0; i < card.quantity; i += 1) {
      cards.push(createCardRef(card.name));
    }
  });
  return cards;
}

function computeZoneCounts() {
  return {
    libraryCount: zones.library.length,
    handCount: zones.hand.length,
    battlefieldCount: zones.battlefield.length,
    graveyardCount: zones.graveyard.length,
    exileCount: zones.exile.length,
    commandCount: zones.command.length,
    revealedCount: zones.revealed.length
  };
}

function removeFirstByName(cards: CardRef[], name: string): CardRef | null {
  const index = cards.findIndex((card) => card.name === name);
  if (index === -1) return null;
  const [removed] = cards.splice(index, 1);
  return removed;
}

function findZone(zone: Zone) {
  return zones[zone];
}

function canMoveToLibrary(zone: Zone, toLibraryPosition?: 'top' | 'bottom') {
  return zone !== 'library' || !!toLibraryPosition;
}

export const loadDeck = tool({
  name: 'loadDeck',
  description: 'Load the currently loaded Archidekt deck into the goldfish tool state',
  parameters: z.object({}).strict(),
  execute: async () => {
    console.log('🧪 Loading goldfish deck from current Archidekt cache.');
    try {
      resetZones();
      deckList = null;
      commanderName = null;
      cardIdCounter = 1;
      const cachedDeck = getLastCachedArchidektDeck();
      if (!cachedDeck) {
        console.warn('⚠️ No loaded Archidekt deck available for goldfish.');
        return { ok: false, error: 'No Archidekt deck is loaded.' };
      }
      const commanderEntry = cachedDeck.cards.find((card) =>
        (card.section || '').toLowerCase().includes('commander')
      );
      if (!commanderEntry) {
        console.warn('⚠️ No commander card found in loaded deck.');
        return { ok: false, error: 'No commander found in loaded deck.' };
      }
      commanderName = commanderEntry.name;
      const cards = cachedDeck.cards.map((card) => ({
        name: card.name,
        quantity: card.quantity,
        section: card.section
      }));
      deckList = cards;

      const total = cards.reduce((sum, card) => sum + card.quantity, 0);
      if (total !== 100) {
        deckList = null;
        console.warn(`⚠️ Goldfish deck invalid card count: ${total}`);
        return { ok: false, error: 'Deck list must contain exactly 100 cards.' };
      }

      console.log(`👑 Goldfish commander: ${commanderName}`);
      console.log(`✅ Goldfish deck loaded (${total} cards).`);
      return { ok: true, cardCount: total };
    } catch (error: any) {
      deckList = null;
      console.error('❌ Goldfish deck load failed:', error?.message || error);
      return { ok: false, error: error?.message || 'Failed to load deck.' };
    }
  }
});

export const reset = tool({
  name: 'reset',
  description: 'Reset game state and shuffle the deck',
  parameters: z.object({
    seed: z.number().optional().nullable(),
    mulliganRules: z.enum(['commander_london', 'none']).optional().nullable()
  }),
  execute: async ({ seed }) => {
    if (!deckList) {
      console.warn('⚠️ Goldfish reset requested with no deck loaded.');
      return { ok: false, error: 'No deck loaded. Use loadDeck first.' };
    }
    if (!commanderName) {
      console.warn('⚠️ Goldfish reset requested with no commander set.');
      return { ok: false, error: 'No commander found in loaded deck.' };
    }

    resetZones();
    cardIdCounter = 1;
    setSeed(seed);

    const library = expandDeckList(deckList);
    const removedCommander = removeFirstByName(library, commanderName);
    if (!removedCommander) {
      console.warn('⚠️ Commander card missing from library.');
      return { ok: false, error: 'Commander card not found in deck list.' };
    }
    const commanderCard = removedCommander;
    zones.command.push(commanderCard);
    zones.library = library;

    shuffleArray(zones.library);

    console.log(`🔄 Goldfish reset complete (seed: ${seed ?? 'none'}).`);
    return {
      gameId: `game_${gameIdCounter++}`,
      zones: computeZoneCounts()
    };
  }
});

export const shuffle = tool({
  name: 'shuffle',
  description: 'Shuffle the library',
  parameters: z.object({}),
  execute: async () => {
    console.log('🔀 Goldfish shuffle library.');
    shuffleArray(zones.library);
    return { ok: true };
  }
});

export const draw = tool({
  name: 'draw',
  description: 'Draw cards from the top of the library',
  parameters: z.object({
    n: z.number().min(1),
    toZone: z.enum(['hand', 'battlefield', 'graveyard', 'exile', 'revealed']).optional().nullable()
  }),
  execute: async ({ n, toZone }) => {
    const destination: Zone = toZone || 'hand';
    if (zones.library.length < n) {
      console.warn(`⚠️ Goldfish draw failed: requested ${n}, available ${zones.library.length}.`);
      return { ok: false, error: 'Not enough cards in library.' };
    }

    const drawn = zones.library.splice(0, n);
    zones[destination].push(...drawn);

    console.log(
      `🎴 Goldfish drew ${n} card(s) to ${destination}: ${drawn.map((card) => card.name).join(', ')}`
    );
    return {
      cards: drawn,
      libraryCount: zones.library.length
    };
  }
});

export const peek = tool({
  name: 'peek',
  description: 'Peek at the top cards of the library without drawing',
  parameters: z.object({
    n: z.number().min(1)
  }),
  execute: async ({ n }) => {
    console.log(
      `👀 Goldfish peek top ${n} card(s): ${zones.library
        .slice(0, n)
        .map((card) => card.name)
        .join(', ')}`
    );
    return {
      cards: zones.library.slice(0, n)
    };
  }
});

export const zoneContents = tool({
  name: 'zoneContents',
  description: 'Return the contents of a zone (non-library)',
  parameters: z.object({
    zone: z.enum(['hand', 'battlefield', 'graveyard', 'exile', 'command', 'revealed'])
  }),
  execute: async ({ zone }) => {
    console.log(
      `📦 Goldfish zoneContents: ${zone}: ${findZone(zone)
        .map((card) => card.name)
        .join(', ')}`
    );
    return {
      cards: [...findZone(zone)]
    };
  }
});

export const moveById = tool({
  name: 'moveById',
  description: 'Move a card between zones by card id',
  parameters: z.object({
    cardId: z.string(),
    fromZone: z.enum(['library', 'hand', 'battlefield', 'graveyard', 'exile', 'command', 'revealed']),
    toZone: z.enum(['library', 'hand', 'battlefield', 'graveyard', 'exile', 'command', 'revealed']),
    toLibraryPosition: z.enum(['top', 'bottom']).optional().nullable()
  }),
  execute: async ({ cardId, fromZone, toZone, toLibraryPosition }) => {
    const destination = toZone as Zone;
    if (!canMoveToLibrary(toZone, toLibraryPosition)) {
      console.warn(`⚠️ Goldfish moveById invalid library position for ${cardId}.`);
      return { ok: false };
    }

    const source = findZone(fromZone);
    const index = source.findIndex((card) => card.id === cardId);
    if (index === -1) {
      console.warn(`⚠️ Goldfish moveById could not find ${cardId} in ${fromZone}.`);
      return { ok: false };
    }

    const [card] = source.splice(index, 1);

    if (destination === 'library') {
      if (toLibraryPosition === 'top') {
        zones.library.unshift(card);
      } else {
        zones.library.push(card);
      }
    } else {
      zones[destination].push(card);
    }

    console.log(`➡️ Goldfish moveById ${card.name} from ${fromZone} to ${destination}.`);
    return { ok: true };
  }
});

export const findAndMoveByName = tool({
  name: 'findAndMoveByName',
  description: 'Find a card by name in a zone and move it to another zone',
  parameters: z.object({
    cardName: z.string(),
    fromZone: z.enum(['library', 'hand', 'graveyard', 'exile', 'command']).optional().nullable(),
    toZone: z.enum(['hand', 'battlefield', 'graveyard', 'exile', 'revealed', 'library']).optional().nullable(),
    toLibraryPosition: z.enum(['top', 'bottom']).optional().nullable(),
    shuffleLibraryAfter: z.boolean().optional().nullable()
  }),
  execute: async ({ cardName, fromZone, toZone, toLibraryPosition, shuffleLibraryAfter }) => {
    const sourceZone = (fromZone ?? 'library') as Zone;
    const destination = (toZone ?? 'hand') as Zone;
    const shouldShuffle = shuffleLibraryAfter ?? true;

    if (!canMoveToLibrary(destination, toLibraryPosition)) {
      console.warn(`⚠️ Goldfish findAndMoveByName invalid library position for ${cardName}.`);
      return { ok: false, movedCard: null };
    }

    const source = findZone(sourceZone);
    const index = source.findIndex((card) => card.name === cardName);
    if (index === -1) {
      console.warn(`⚠️ Goldfish findAndMoveByName could not find ${cardName} in ${sourceZone}.`);
      return { ok: false, movedCard: null };
    }

    const [card] = source.splice(index, 1);

    if (destination === 'library') {
      if (toLibraryPosition === 'top') {
        zones.library.unshift(card);
      } else {
        zones.library.push(card);
      }
    } else {
      zones[destination].push(card);
    }

    if (sourceZone === 'library' && shouldShuffle) {
      shuffleArray(zones.library);
    }

    console.log(`➡️ Goldfish findAndMoveByName ${cardName} from ${sourceZone} to ${destination}.`);
    return { ok: true, movedCard: card };
  }
});

export const goldfishTools = [
  loadDeck,
  reset,
  shuffle,
  draw,
  peek,
  zoneContents,
  moveById,
  findAndMoveByName
];
