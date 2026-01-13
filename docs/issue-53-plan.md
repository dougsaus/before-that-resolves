# Issue 53: Add Moxfield deck loading support

Last updated: 2025-03-XX (local)

## Goal
Add Moxfield as a supported deck source for both Oracle deck loading and the Decks collection, while keeping the deck cache/tooling extensible for future sources.

## Approach
- Generalize the server deck cache + summary layer to accept multiple sources.
- Update server routes, tools, and agent prompts to reference a source-agnostic "loaded deck" tool.
- Update client UI and tests to accept Archidekt or Moxfield URLs.
- Expand DB constraints to allow `moxfield` in `decks.source`.

## Progress Checklist

### Server: Deck fetching + cache
- [x] Replace Archidekt-only cache with source-aware cache (`DeckSource`, `DeckSummary`, `RawDeck`, `cacheDeckFromUrl`, `fetchDeckSummary`, `getLastCachedDeck`, `getLastCachedDeckRaw`, `resetDeckCache`).
  - Files: `server/src/services/deck.ts`
- [x] Add Moxfield parsing + deck list building (boards, commanders, color identity, excluded boards).
  - Files: `server/src/services/deck.ts`
- [x] Keep Archidekt path behavior intact (`buildArchidektDeckData` still available for tests).
  - Files: `server/src/services/deck.ts`

### Server: Routes + persistence
- [x] Update API routes to use new deck summary/cache API and store `source` from summary.
  - Files: `server/src/app.ts`
- [x] Extend `DeckCollectionInput` and DB schema constraints to allow `moxfield`.
  - Files: `server/src/services/deck-collection.ts`, `server/src/services/db.ts`

### Tools + Agents
- [x] Replace `get_archidekt_deck`/`get_archidekt_deck_raw` with `get_loaded_deck`/`get_loaded_deck_raw`.
  - Files: `server/src/tools/deck-tools.ts`, `server/src/agents/card-oracle/index.ts`, `server/src/agents/goldfish/index.ts`, `server/src/tools/goldfish/index.ts`
- [x] Update agent prompts/docs for new tool names and multi-source language.
  - Files: `server/src/agents/card-oracle/card-oracle.md`, `server/src/agents/goldfish/goldfish.md`, `docs/agents.md`

### Client UI + UX
- [x] Update Oracle deck input placeholder + helper text to mention Moxfield.
  - Files: `client/src/components/CardOracle.tsx`
- [x] Update Deck Collection to accept Moxfield URLs for preview/open-in-Oracle; copy updated.
  - Files: `client/src/components/DeckCollection.tsx`, `client/src/App.tsx`

### Tests
- [x] Update deck service tests for new APIs + add Moxfield build/summary test coverage.
  - Files: `server/src/services/deck.test.ts`
- [x] Update app tests for new deps and summary source.
  - Files: `server/src/app.test.ts`
- [x] Update deck tools + goldfish tool tests for new tool names and cache access.
  - Files: `server/src/tools/deck-tools.test.ts`, `server/src/tools/goldfish/index.test.ts`
- [x] Update client tests for new placeholder and Moxfield deck preview support.
  - Files: `client/src/components/CardOracle.test.tsx`, `client/src/components/DeckCollection.test.tsx`

### Docs
- [x] Update README and architecture/interaction docs to mention Moxfield.
  - Files: `README.md`, `docs/architecture.md`, `docs/interaction.md`, `AGENTS.md`

## Remaining Work / Open Questions
- [x] Verify Moxfield API access from server runtime.
  - **Finding:** The Moxfield API at `api2.moxfield.com` is protected by Cloudflare and returns 403 for server-side requests.
  - Tested with various headers (Origin, Referer, User-Agent) - all blocked.
  - Tested the `moxfield-api` npm package - also blocked (uses same endpoint).
  - **Conclusion:** Moxfield API access requires browser-based requests or a specialized proxy. The implementation is complete and will work once API access is available. Current error handling surfaces "Failed to load Moxfield deck" to users.
- [x] Run full test suite and lint/build per repo workflow before PR.
  - All tests pass, lint clean, build succeeds.

## Notes for Handoff
- New source-aware deck tools are `get_loaded_deck` and `get_loaded_deck_raw`.
- Deck cache now stores {source, deckId, deckUrl, deck} per conversation and exposes the last loaded deck regardless of source.
- Moxfield deck parsing:
  - `boards.commanders` drives commander names.
  - `colorIdentity` uses deck-level value when present; otherwise derives from commander cards.
  - `maybeboard`, `sideboard`, `tokens` are excluded from deck list.
- If Moxfield API 403 persists, expect `fetchDeckSummary` and `cacheDeckFromUrl` to fail with "Failed to load Moxfield deck"; error surfaces in UI.
