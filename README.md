# ⚔️ Before That Resolves

**AI-Powered Commander/EDH Assistant for Magic: The Gathering**

## Overview

Before That Resolves is an intelligent Commander assistant that helps Magic: The Gathering players build better decks, understand complex rules interactions, and make strategic decisions. Powered by OpenAI's GPT models, it provides instant access to comprehensive card knowledge, deck optimization suggestions, and multiplayer political advice.

## Features

### 🎴 Currently Available
- **Card Oracle** - Instant card lookups with detailed information
- **Rules Clarification** - Get official rulings and interaction explanations
- **Commander Legality** - Check if any card can be your commander
- **Advanced Search** - Find cards by color, type, and complex criteria
- **Random Commander** - Discover new commanders to build around

### 🚧 Coming Soon
- **Deck Builder** - 100-card singleton deck construction with validation
- **Power Level Assessment** - Rate your deck on the 1-10 scale
- **Budget Optimizer** - Find powerful cards within your price range
- **Combo Detection** - Identify infinite combos and win conditions
- **Political Advisor** - Multiplayer threat assessment and strategy
- **Meta Analysis** - Track competitive trends and popular strategies

## The Name

"Before that resolves..." - The iconic phrase every Commander player knows when someone wants to respond to a spell on the stack. Perfect for an assistant that's always ready to help at instant speed.

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- OpenAI API key (get one at [platform.openai.com](https://platform.openai.com))

### Installation

```bash
# Clone the repository
git clone https://github.com/dougsaus/before-that-resolves.git
cd before-that-resolves

# Install dependencies
npm install

# Set up environment
export OPENAI_API_KEY=your_api_key_here
# Or create a .env file from the example
cp .env.example .env
# Edit .env and add your OpenAI API key
```

### Running the App

```bash
# Start both frontend and backend
npm run dev

# Or run separately:
npm run dev:client  # Frontend at http://localhost:5173
npm run dev:server  # Backend at http://localhost:3001
```

### Testing the Card Oracle

1. Open http://localhost:5173 in your browser
2. Try queries like:
   - "What is Lightning Bolt?"
   - "Can Atraxa be my commander?"
   - "Find all blue instant spells"
   - "What are the rulings for Doubling Season?"
   - "Suggest a random commander"

## Tech Stack

### Frontend
- **React 18** with TypeScript for type-safe UI
- **Vite** for lightning-fast development
- **Tailwind CSS** for styling with MTG-themed colors
- **Axios** for API communication
- **Zustand** for state management (coming soon)

### Backend
- **Express.js** API server
- **OpenAI GPT-4o** for intelligent responses
- **@openai/agents SDK** for agent orchestration
- **Zod** for runtime type validation
- **TypeScript** for type safety

### External APIs
- **Scryfall** - Comprehensive card database
- **EDHREC** - Deck recommendations (coming soon)
- **TCGPlayer** - Price data (coming soon)

## Project Structure

```
before-that-resolves/
├── client/          # React frontend
│   └── src/
│       ├── components/   # UI components
│       └── App.tsx       # Main application
├── server/          # Express backend
│   └── src/
│       ├── agents/      # AI agent implementations
│       ├── tools/       # Card search and rules tools
│       ├── services/    # External API integrations
│       └── utils/       # Helper functions
├── shared/          # Shared TypeScript types
└── docs/           # Project documentation
```

## API Endpoints

### Currently Available
- `GET /health` - Health check
- `POST /api/agent/query` - Send queries to the Card Oracle
- `GET /api/examples` - Get example queries

### Request Example
```json
{
  "query": "What is Sol Ring?"
}
```

### Response Example
```json
{
  "success": true,
  "response": "Sol Ring is an artifact that costs {1} and taps for {C}{C}...",
  "toolCalls": 1
}
```

## Development

```bash
# Run tests
npm test  # Coming soon

# Build for production
npm run build

# Type checking
npx tsc --noEmit
```

## Roadmap

- [x] Card Oracle with Scryfall integration
- [ ] Deck builder with validation
- [ ] Power level calculator
- [ ] Budget optimization
- [ ] Combo detection
- [ ] Political advice system
- [ ] Deck import/export
- [ ] Community deck sharing
- [ ] Mobile app

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

MIT

## Acknowledgments

- [Scryfall](https://scryfall.com) for their comprehensive card API
- [EDHREC](https://edhrec.com) for Commander meta data
- The Magic: The Gathering community

---

*"Before that resolves..."* - Always ready to respond at instant speed 🎴

Built with ❤️ for the Commander community.