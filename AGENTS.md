# AGENTS.md

This file provides guidance to coding agents working in this repository.

## Project Overview

Before That Resolves is a Magic: The Gathering assistant web app. Users chat with "The Oracle" to look up cards, check commander legality, explain interactions, analyze decks, and track game logs/deck collections.

Primary integrations:
- OpenAI API (agent responses)
- Scryfall API (card data)
- Archidekt/Moxfield APIs (deck loading/import)
- PostgreSQL (auth sessions, deck collections, game logs)

## Monorepo Structure

This is an npm workspaces monorepo with two packages:
- **`/client`** - React 19 frontend (Vite, TypeScript, Tailwind CSS v4)
- **`/server`** - Express 5 backend (TypeScript, PostgreSQL, OpenAI Agents SDK)

Key directories/files:
- `client/src/components/CardOracle.tsx` - main chat UI
- `client/src/utils/api.ts` - API base URL + URL builder
- `server/src/app.ts` - Express app, routes, dependency injection entrypoint
- `server/src/agents/card-oracle/index.ts` - main agent orchestration
- `server/src/services/deck.ts` - Archidekt/Moxfield loading + in-memory deck cache
- `server/src/utils/conversation-store.ts` - conversation state (`lastResponseId`) storage
- `server/src/services/db.ts` - Postgres pool + schema initialization
- `docs/architecture.md`, `docs/agents.md`, `docs/interaction.md` - architecture and flows

## Common Commands

```bash
# Development
npm install
docker compose -f deploy/docker-compose.yml up -d   # Start PostgreSQL
npm run dev                                          # Client (5173) + server (3001)

# Testing
npm test                                             # Server + client tests
npm run test --workspace=client
npm run test --workspace=server
npm run test:integration --workspace=server          # RUN_INTEGRATION_TESTS=1
npm run test:live --workspace=server                 # RUN_LIVE_TESTS=1, requires OPENAI_API_KEY

# Single test file
npx vitest run path/to/file.test.ts --workspace=client
npx vitest run path/to/file.test.ts --workspace=server

# Build & lint
npm run build
npm run lint
```

## Environment Setup

Core env for local development:
```bash
export DATABASE_URL=postgresql://btr:btr@localhost:5432/btr
```

Important env behavior:
- App chat requests use per-request `x-openai-key` from the UI; server does not require a global `OPENAI_API_KEY` for normal local usage.
- `OPENAI_API_KEY` is still needed for server live tests and standalone test scripts.
- `MOXFIELD_USER_AGENT` must be set for Moxfield deck fetch/import endpoints.
- `GOOGLE_CLIENT_ID` is required for Google auth flows.

See `.env.example` for full list.

## Architecture

**Agent System:**
- Card Oracle agent is the main entry point.
- Direct tools include card lookup/search/rulings and loaded-deck tools.
- Sub-agents exposed as tools:
  - Commander Bracket Expert
  - Goldfish Expert

**Core data flow:**
1. Client sends query to `/api/agent/query`.
2. Server resolves/creates `conversationId` and forwards to Card Oracle.
3. Agent runs tools (Scryfall, deck cache access, sub-agents).
4. Server returns response plus `conversationId`; conversation history uses `lastResponseId`.

**State model:**
- Conversation state is in-memory and keyed by `conversationId`.
- Deck cache is also in-memory and keyed by `conversationId`.
- `/api/agent/reset` clears both conversation state and deck cache for that conversation.

## API Surface (High Value Routes)

- `POST /api/agent/query` - main oracle chat endpoint (`x-openai-key` supported)
- `POST /api/agent/reset` - reset conversation + deck cache for `conversationId`
- `POST /api/deck/cache` - cache deck for a conversation
- `POST /api/chat/export-pdf` - export chat transcript PDF
- Auth/deck/game-log routes in `server/src/app.ts` back persisted features (Google auth, deck collection, logs, sharing)

## Testing Patterns

- Unit tests colocated with source (`.test.ts` / `.test.tsx`)
- Server app uses dependency injection via `createApp(deps)` in `server/src/app.ts`
- Integration tests use Testcontainers + PostgreSQL and are gated by `RUN_INTEGRATION_TESTS=1`
- Live OpenAI tests are gated by `RUN_LIVE_TESTS=1` and require `OPENAI_API_KEY`

## Domain Conventions

- Color identity order is WUBRG: `W|U|B|R|G`
- Date-only strings (e.g. `2025-01-10`) should be parsed as local time, not UTC
- Deck and conversation runtime state are conversation-scoped and in-memory

## Workflow Rules

- Work in a branch from `main`; sync `main` first
- Add/adjust tests for behavior changes
- Before commit/PR: run `npm test`, `npm run build`, and `npm run lint`
- Create PR and wait for explicit approval before merge
- Rebase on latest `main` before merging
- Delete branch after merge
- Close related issues with a note referencing the resolving PR/commit

## Agent Working Notes (/init-style)

When starting a task:
1. Confirm scope by locating affected files with `rg`.
2. Read tests near changed code first.
3. Prefer minimal, targeted edits consistent with existing patterns.
4. Validate with the smallest relevant test command, then full required checks.

When touching these areas, run at least:
- Agent/query/deck tools: `npm run test --workspace=server`
- Client UI/state/hooks: `npm run test --workspace=client`
- DB/auth/game logs/deck collection: `npm run test:integration --workspace=server` (Docker required)

Operational gotchas:
- Moxfield calls fail without `MOXFIELD_USER_AGENT`.
- In-memory caches reset on server restart; persistent behavior should be implemented in DB services.
- Keep date handling local-time safe to avoid off-by-one-day regressions.
