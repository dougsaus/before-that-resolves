# Goldfish Tool Examples

The goldfish tool simulates a static Commander deck with in-memory zones.

Example calls:

```json
{
  "tool": "loadDeck",
  "input": { "deckUrl": "https://archidekt.com/decks/123456/example" }
}
```

```json
{
  "tool": "reset",
  "input": { "seed": 1 }
}
```

```json
{
  "tool": "draw",
  "input": { "n": 7 }
}
```

Mulligan simulation (move 2 cards from hand to library bottom, then shuffle):

```json
{
  "tool": "moveById",
  "input": { "cardId": "card_12", "fromZone": "hand", "toZone": "library", "toLibraryPosition": "bottom" }
}
```

```json
{
  "tool": "moveById",
  "input": { "cardId": "card_18", "fromZone": "hand", "toZone": "library", "toLibraryPosition": "bottom" }
}
```

```json
{
  "tool": "shuffle",
  "input": {}
}
```

Turn draw:

```json
{
  "tool": "draw",
  "input": { "n": 1 }
}
```

Peek and simulate scry (peek 3, move one to revealed, then put it back on top):

```json
{
  "tool": "peek",
  "input": { "n": 3 }
}
```

```json
{
  "tool": "moveById",
  "input": { "cardId": "card_4", "fromZone": "library", "toZone": "revealed" }
}
```

```json
{
  "tool": "moveById",
  "input": { "cardId": "card_4", "fromZone": "revealed", "toZone": "library", "toLibraryPosition": "top" }
}
```
