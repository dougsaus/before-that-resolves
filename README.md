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

## Set the API Key

You can set the key in your shell or in a `.env` file.

Option A: Shell (temporary, for the current terminal)

```bash
export OPENAI_API_KEY="your_api_key_here"
```

Option B: `.env` file (recommended)

```bash
cp .env.example .env
```

Then open `.env` and add:

```
OPENAI_API_KEY=your_api_key_here
```

## Run Locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

## Common Tasks

- Start frontend and backend together: `npm run dev`
- Start frontend only: `npm run dev:client`
- Start backend only: `npm run dev:server`

## Troubleshooting

- If you see “OPENAI_API_KEY not found,” double‑check your `.env` file or terminal export.
- If the app can’t connect, make sure the server is running on port 3001.
