# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Before That Resolves is a Magic: The Gathering assistant web app. Users chat with "The Oracle" to look up cards, check commander legality, explain interactions, and analyze decklists from Archidekt. The app uses OpenAI's API for AI responses and Scryfall for card data.

## Monorepo Structure

This is an npm workspaces monorepo with two packages:
- **`/client`** - React 19 frontend (Vite, TypeScript, Tailwind CSS)
- **`/server`** - Express 5 backend (TypeScript, PostgreSQL, OpenAI Agents SDK)

## Common Commands

```bash
# Development
npm install                          # Install all dependencies
docker compose -f deploy/docker-compose.yml up -d  # Start PostgreSQL
npm run dev                          # Start client (5173) + server (3001) concurrently

# Testing
npm test                             # Run all tests (server + client)
npm run test --workspace=client      # Client tests only
npm run test --workspace=server      # Server tests only
npm run test:integration --workspace=server  # DB integration tests (requires Docker)

# Run a single test file
npx vitest run path/to/file.test.ts --workspace=client
npx vitest run path/to/file.test.ts --workspace=server

# Build & Lint
npm run build                        # Build both packages
npm run lint                         # Lint both packages
```

## Environment Setup

Required environment variable:
```bash
export DATABASE_URL=postgresql://btr:btr@localhost:5432/btr
```

## Architecture

**Agent System:** The Card Oracle agent is the main entry point. It has direct tools (card search, rulings, deck loading) and two sub-agents exposed as tools:
- Commander Bracket Expert - bracket system analysis
- Goldfish Expert - deck simulation with zone manipulation

**Data Flow:**
1. Client sends queries to `/api/agent/query`
2. Server runs the Card Oracle agent via OpenAI Agents SDK
3. Agent uses tools that call Scryfall API and read from in-memory deck cache
4. Conversation history tracked per conversation ID via `lastResponseId`

**Key Services:**
- Deck cache: In-memory storage for loaded Archidekt decks (resets on server restart)
- Conversation store: Tracks OpenAI conversation history per user
- Game logs & deck collections: PostgreSQL persistence with Google OAuth

## Testing Patterns

- Unit tests colocated with source files (`.test.ts` / `.test.tsx`)
- Server uses dependency injection in `app.ts` for testability
- Integration tests use Testcontainers for PostgreSQL
- Live tests (calling OpenAI API) require `OPENAI_API_KEY` env var

## Domain Conventions

- Color identity uses WUBRG order: `W|U|B|R|G` (White, Blue, Black, Red, Green)
- Date-only strings (e.g., "2025-01-10") should be parsed as local time, not UTC
- Deck state is conversation-scoped and cached in memory

## Workflow Rules

- **Always work in a new branch from main:** Ensure `main` is up to date before starting work
- **Add tests for new functionality:** Ensure new features or behaviors include appropriate test coverage
- **Never commit/push code that doesn't pass:** Always run `npm test`, `npm run build`, and `npm run lint` before committing
- **Stop at PR creation:** Create the PR and wait for user approval before merging
- **Ask before merging:** Always get explicit permission before merging a PR
- **Rebase before merging:** Ensure your branch is up to date with `main` before merging a PR; rebase if needed
- **Delete branches on merge:** When merging a PR, choose to delete the branch afterward
- **Close related issues:** When merging a PR that fixes an issue, close the issue with a comment mentioning the PR/commit that resolved it
