# Interaction Flows

This document captures key user flows with sequence diagrams.

## Load Deck and Analyze

```mermaid
sequenceDiagram
  actor User
  participant UI as Web Client
  participant API as Express API
  participant Deck as Deck Cache
  participant Archidekt as Archidekt API
  participant Moxfield as Moxfield API
  participant Agent as Card Oracle Agent
  participant LLM as OpenAI or Anthropic API

  User->>UI: Enter Archidekt or Moxfield URL
  User->>UI: Click Load Deck
  UI->>API: POST /api/deck/cache
  alt Archidekt deck
    API->>Archidekt: GET /api/decks/:id/
    Archidekt-->>API: Deck JSON
  else Moxfield deck
    API->>Moxfield: GET /v3/decks/all/:id
    Moxfield-->>API: Deck JSON
  end
  API->>Deck: Store cached deck
  API-->>UI: { success: true }

  User->>UI: Select provider, model, and analysis options
  User->>UI: Click Analyze Deck
  UI->>API: POST /api/agent/query { provider, model, ... }<br/>(x-openai-key or x-anthropic-key header)
  API->>Agent: executeCardOracle(query, modelSelection)
  Agent->>LLM: run() with tools
  LLM-->>Agent: response
  Agent-->>API: response text
  API-->>UI: response payload
```

## Goldfish Simulation

```mermaid
sequenceDiagram
  actor User
  participant UI as Web Client
  participant API as Express API
  participant Agent as Card Oracle Agent
  participant SubAgent as Goldfish Agent
  participant Tools as Goldfish Tools
  participant Deck as Deck Cache
  participant LLM as OpenAI or Anthropic API

  User->>UI: Choose goldfish options
  User->>UI: Click Goldfish Deck
  UI->>API: POST /api/agent/query { provider, model, ... }<br/>(x-openai-key or x-anthropic-key header)
  API->>Agent: executeCardOracle(query, modelSelection)
  Agent->>LLM: run() with tools
  Agent->>SubAgent: commander_goldfish_expert (same provider)
  SubAgent->>Tools: loadDeck()
  Tools->>Deck: read cached deck
  SubAgent->>Tools: reset/draw/move/peek...
  SubAgent-->>Agent: summarized results
  Agent-->>API: response text
  API-->>UI: response payload
```

## Export Conversation to PDF

```mermaid
sequenceDiagram
  actor User
  participant UI as Web Client
  participant API as Express API
  participant PDF as PDF Service

  User->>UI: Click Export conversation to pdf
  UI->>API: POST /api/chat/export-pdf
  API->>PDF: render PDF
  PDF-->>API: PDF bytes
  API-->>UI: PDF response
  UI->>User: Download file
```
