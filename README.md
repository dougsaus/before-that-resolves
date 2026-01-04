# Before That Resolves

Before That Resolves is a local web app that lets you chat with a Magic: The Gathering assistant. It can look up cards and rules, check commander legality, explain interactions, and summarize Commander decklists from Archidekt.

The app runs entirely on your machine and calls OpenAI’s API for answers, so you will need your own OpenAI API key.

## How It Works

- You open the app in a browser and chat with “The Oracle.”
- The Oracle uses Scryfall for real card data and can load decklists from Archidekt.
- Responses include Scryfall links that show a card image on hover.
- You can choose which OpenAI model to use and (for supported models) set reasoning and text verbosity.

## Requirements

- Node.js 18+ and npm
- An OpenAI API key

### Install Node.js and npm (macOS + Homebrew)

If you don’t already have Node.js and npm installed, Homebrew is the easiest way:

```bash
brew install node
```

This installs both `node` and `npm`. You can verify:

```bash
node -v
npm -v
```

## Get an API Key

1. Create an OpenAI account at https://platform.openai.com
2. Create an API key in your account
3. Keep it private

## Create an OpenAI Account (ChatGPT + API)

1. Visit https://chat.openai.com and create a ChatGPT account (or sign in if you already have one).
2. Visit https://platform.openai.com and sign in with the same account.
3. Go to “API keys” and create a new key.
4. Copy the key somewhere safe and keep it private.

## Set the API Key

The app always uses a user-provided key from the UI.

1. Start the app and open the sidebar section titled "OpenAI API key".
2. Paste your key.
3. Optionally check "Store this key in this browser" to keep it in local storage.

The key is sent with each request to the local server and is never stored server-side.

## Run Locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

PDF export (optional):

```bash
npx playwright install chromium
```

## Container Deploys (Docker)

For local Docker or Cloud Run container notes, see `docs/container-docker.md`.

## Common Tasks

- Start frontend and backend together: `npm run dev`
- Start frontend only: `npm run dev:client`
- Start backend only: `npm run dev:server`

## Troubleshooting

- If you see “OpenAI API key is required,” paste a key in the UI and try again.
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

Live integration tests (calls the OpenAI API; uses a key only for these tests):

```bash
export OPENAI_API_KEY="your_api_key_here"
npm run test:live --workspace=server
```
