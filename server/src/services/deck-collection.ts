export type DeckCollectionEntry = {
  id: string;
  name: string;
  url: string;
  format: string | null;
  addedAt: string;
};

type DeckCollection = {
  decks: Map<string, DeckCollectionEntry>;
};

const collections = new Map<string, DeckCollection>();

function getCollection(userId: string): DeckCollection {
  const existing = collections.get(userId);
  if (existing) {
    return existing;
  }
  const collection: DeckCollection = { decks: new Map() };
  collections.set(userId, collection);
  return collection;
}

export function listDeckCollection(userId: string): DeckCollectionEntry[] {
  const collection = collections.get(userId);
  if (!collection) {
    return [];
  }
  return Array.from(collection.decks.values()).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

export function upsertDeckInCollection(
  userId: string,
  deck: Omit<DeckCollectionEntry, 'addedAt'>,
  addedAt: string = new Date().toISOString()
): DeckCollectionEntry[] {
  const collection = getCollection(userId);
  const entry: DeckCollectionEntry = {
    ...deck,
    addedAt
  };
  collection.decks.set(deck.id, entry);
  return listDeckCollection(userId);
}

export function removeDeckFromCollection(userId: string, deckId: string): DeckCollectionEntry[] {
  const collection = collections.get(userId);
  if (!collection) {
    return [];
  }
  collection.decks.delete(deckId);
  return listDeckCollection(userId);
}
