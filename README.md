# Before That Resolves

Before That Resolves is a local web app that lets you chat with a Magic: The Gathering assistant. It can look up cards and rules, check commander legality, explain interactions, and summarize Commander decklists from Archidekt or Moxfield.

The app runs entirely on your machine and uses an LLM provider for answers. It supports both **OpenAI** and **Anthropic Claude** — you supply your own API key for whichever provider you choose.

## How It Works

- You open the app in a browser and chat with “The Oracle.”
- The Oracle uses Scryfall for real card data and can load decklists from Archidekt or Moxfield.
- Responses include Scryfall links that show a card image on hover.
- You choose a provider (OpenAI or Anthropic) and model in the AI Options panel. Each provider uses its own API key stored locally in your browser.

## Requirements

- Node.js 18+ and npm
- An API key for either OpenAI or Anthropic (or both)

### Install Node.js and npm

**macOS (Homebrew):**

```bash
brew install node
```

**Windows:**

Download and run the installer from https://nodejs.org (LTS version recommended), or use winget:

```powershell
winget install OpenJS.NodeJS.LTS
```

Verify either way:

```bash
node -v
npm -v
```

## Get an API Key

### OpenAI

1. Visit https://platform.openai.com and sign in (or create an account).
2. Go to “API keys” and create a new key.
3. Copy the key somewhere safe — it starts with `sk-`.

### Anthropic Claude

1. Visit https://console.anthropic.com and sign in (or create an account).
2. Go to “API keys” and create a new key.
3. Copy the key somewhere safe — it starts with `sk-ant-`.

## Set the API Key

The app always uses a user-provided key from the UI — keys are never stored server-side.

1. Start the app and open the **AI Options** section in the sidebar.
2. Select your provider (OpenAI or Anthropic) using the toggle at the top.
3. Paste your key for that provider into the key field.
4. Optionally check “Store this key in this browser” to persist it in local storage.

Switching providers shows the key input for that provider only. Each key is stored independently.

## Run Locally

```bash
npm install
docker compose -f deploy/docker-compose.yml up -d
npm run dev
```

Then open http://localhost:5173 in your browser.

Required env (example):

**macOS/Linux:**
```bash
export DATABASE_URL=postgresql://btr:btr@localhost:5432/btr
```

**Windows (PowerShell):**
```powershell
$env:DATABASE_URL="postgresql://btr:btr@localhost:5432/btr"
```

**Windows (Command Prompt):**
```cmd
set DATABASE_URL=postgresql://btr:btr@localhost:5432/btr
```

PDF export (optional):

```bash
npx playwright install chromium
```

## Container Deploys (Docker)

For local Docker or Cloud Run container notes, see `deploy/README.md`.

## Common Tasks

- Start frontend and backend together: `npm run dev`
- Start frontend only: `npm run dev:client`
- Start backend only: `npm run dev:server`

## Troubleshooting

- If you see “OpenAI API key is required” or “Anthropic API key is required,” paste the correct key for your selected provider in the AI Options panel and try again.
- If the app can’t connect, make sure the server is running on port 3001.

## Running Tests

Frontend unit tests:

```bash
npm run test --workspace=client
```

Backend unit tests:

```bash
npm run test --workspace=server
```

Backend integration tests (requires Docker, uses Testcontainers):

```bash
npm run test:integration --workspace=server
```

Live integration tests — OpenAI (calls the OpenAI API):

**macOS/Linux:**
```bash
export OPENAI_API_KEY="your_openai_key"
npm run test:live --workspace=server
```

**Windows (PowerShell):**
```powershell
$env:OPENAI_API_KEY="your_openai_key"
npm run test:live --workspace=server
```

Live integration tests — Anthropic (calls the Anthropic API; not run in default CI):

**macOS/Linux:**
```bash
export ANTHROPIC_API_KEY="your_anthropic_key"
RUN_ANTHROPIC_LIVE_TESTS=1 npm run test:live --workspace=server
```

**Windows (PowerShell):**
```powershell
$env:ANTHROPIC_API_KEY="your_anthropic_key"
$env:RUN_ANTHROPIC_LIVE_TESTS="1"
npm run test:live --workspace=server
```
