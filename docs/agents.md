# Agent Architecture

This document explains how the main Card Oracle agent is composed, including tools and sub-agents.

## Card Oracle Agent (Main)

```mermaid
graph TD
  Oracle[Card Oracle Agent]

  subgraph Tools[Direct Tools]
    Search[search_card]
    Advanced[advanced_search]
    Collection[card_collection]
    Rulings[get_card_rulings]
    Random[random_commander]
    Legality[check_commander_legality]
    Deck[get_archidekt_deck]
    DeckRaw[get_archidekt_deck_raw]
  end

  subgraph SubAgents[Agents as Tools]
    Bracket[commander_bracket_expert]
    Goldfish[commander_goldfish_expert]
  end

  Oracle --> Search
  Oracle --> Advanced
  Oracle --> Collection
  Oracle --> Rulings
  Oracle --> Random
  Oracle --> Legality
  Oracle --> Deck
  Oracle --> DeckRaw
  Oracle --> Bracket
  Oracle --> Goldfish
```

### Notes

- The Card Oracle agent is the single entry point for user queries.
- Deck-related tools only read from the in-memory Archidekt cache; agents never fetch URLs directly.
- Two sub-agents are exposed as tools to the main agent:
  - **Commander Bracket Expert** for bracket system analysis.
  - **Goldfish Expert** for simulation-based analytics using goldfish tools.

## Goldfish Agent Toolchain

```mermaid
graph TD
  GoldfishAgent[Goldfish Agent]
  DeckTool[get_archidekt_deck]
  GoldfishTools[Goldfish Simulator Tools]
  Zones[Zones: library/hand/battlefield/graveyard/exile/command/revealed]

  GoldfishAgent --> DeckTool
  GoldfishAgent --> GoldfishTools
  GoldfishTools --> Zones
```

### Goldfish Simulator Capabilities

- Loads the cached Archidekt deck into tool state (`loadDeck`).
- Resets/shuffles with deterministic seeds (`reset`, `shuffle`).
- Draws, peeks, and moves cards between zones (`draw`, `peek`, `moveById`, `findAndMoveByName`).
- Reports zone contents and counts for analytics.

## Commander Bracket Agent

```mermaid
graph TD
  BracketAgent[Commander Bracket Agent]
  BracketTools[Bracket Expert Instructions]

  BracketAgent --> BracketTools
```

### Notes

- The bracket agent is a focused LLM tool with domain-specific instructions.
- It does not directly access card APIs or deck caches unless the main agent provides the context.
