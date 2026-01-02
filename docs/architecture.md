# Architecture Overview

This document describes the main runtime components and how they connect.

## System Components

```mermaid
graph TD
  subgraph Client[Web Client]
    UI[React UI]
  end

  subgraph Server[Node/Express API]
    API[Express Routes]
    DeckCache[Archidekt Deck Cache]
    ConvStore[Conversation Store]
    PDF[PDF Export Service]
    Agents[OpenAI Agents SDK]
  end

  subgraph External[External Services]
    OpenAI[OpenAI API]
    Archidekt[Archidekt API]
    Scryfall[Scryfall API]
  end

  UI -->|POST /api/deck/cache| API
  UI -->|POST /api/agent/query| API
  UI -->|POST /api/agent/reset| API
  UI -->|POST /api/chat/export-pdf| API

  API --> DeckCache
  API --> ConvStore
  API --> PDF
  API --> Agents

  Agents --> OpenAI
  DeckCache --> Archidekt
  Agents --> Scryfall
```

## Key Runtime Responsibilities

- **Web Client**: Collects user input, triggers deck load, analysis/goldfish runs, and PDF export.
- **Express API**: Orchestrates requests, manages conversation IDs, and forwards agent runs.
- **Deck Cache**: Stores the most recently loaded Archidekt payload in memory so tools can query it.
- **Conversation Store**: Tracks `lastResponseId` per conversation for OpenAI conversation history.
- **Agents SDK**: Runs the Card Oracle agent and its tools/sub-agents.
- **PDF Export**: Renders chat transcript (and deck metadata if present) to a PDF.

## Deployment Notes

- The deck cache and conversation state are in-memory and reset on server restart.
- The client and server are expected to run locally during development.
