# ⚔️ Before That Resolves

**Learn @openai/agents SDK by Building a Commander/EDH Assistant**

## Overview

This is a **developer learning project** for mastering the OpenAI Agents SDK through practical implementation. By building a fully-functional Magic: The Gathering Commander assistant, you'll learn agent orchestration, tool development, complex state management, and production patterns.

**For Developers**: Each feature you implement teaches a new SDK concept through hands-on coding.
**For End Users**: They get a powerful Commander deck builder and strategy tool (no SDK knowledge exposed).

## Project Status

🚧 **In Development** - Foundation Phase

## Learning Approach

This project teaches YOU (the developer) the @openai/agents SDK incrementally:
- Start with simple agent creation and basic tools
- Progress through complex validation schemas and error handling
- Master multi-agent orchestration and state management
- End with production-ready patterns and optimizations

Each MTG feature is carefully chosen to demonstrate specific SDK patterns. The Commander format's complexity provides perfect real-world scenarios for learning.

## The Name

"Before that resolves..." - The phrase MTG players say when responding to spells on the stack. It's also a perfect metaphor for agent handoffs and interruption patterns you'll learn to implement.

## What You'll Build (And Learn)

### 🎴 MTG Features (What Users See)
- 100-card singleton deck validation
- Color identity and legality checking
- Mana curve optimization
- Budget-friendly alternatives
- Power level assessment (1-10 scale)
- Combo detection and win conditions
- Multiplayer political advice
- Meta analysis and trends

### 🎯 SDK Skills (What You Learn)
- **Basic Agents**: Create agents with tools and Zod schemas
- **API Integration**: Wrap external APIs as agent tools
- **Complex Validation**: Build nested schemas with constraints
- **Streaming Responses**: Implement real-time feedback
- **Error Handling**: Graceful degradation and retry logic
- **Tool Orchestration**: Coordinate multiple tools efficiently
- **Agent Handoffs**: Delegate tasks between specialized agents
- **Multi-Agent Systems**: Build coordinated agent swarms
- **State Persistence**: Share context across agent calls
- **Production Patterns**: Deploy scalable agent systems

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js API server
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: Zustand + React Context
- **Agent SDK**: @openai/agents + Zod
- **External APIs**: Scryfall, EDHREC, TCGPlayer

## Your Learning Path

### Phase 1: Foundation (SDK Basics)
1. **Lesson 1: Card Oracle Agent**
   - Learn: Basic agent creation, tool implementation
   - Build: Card search and rulings lookup

2. **Lesson 2: Commander Legality Tool**
   - Learn: Zod validation schemas, constraints
   - Build: Deck legality checker

3. **Lesson 3: Mana Base Calculator**
   - Learn: Complex nested schemas, type inference
   - Build: Land optimization tool

### Phase 2: Intermediate (Advanced Patterns)
4. **Lesson 4: Streaming Deck Analysis**
   - Learn: Real-time streaming responses
   - Build: Live deck feedback as cards are added

5. **Lesson 5: Budget Optimizer**
   - Learn: Error handling, retry logic, fallbacks
   - Build: Price-conscious card alternatives

6. **Lesson 6: Synergy Orchestra**
   - Learn: Multi-tool coordination, parallel execution
   - Build: Combo and synergy finder

### Phase 3: Advanced (Multi-Agent Systems)
7. **Lesson 7: Power Level Assessment**
   - Learn: Agent handoffs, delegation patterns
   - Build: Deck strength evaluator

8. **Lesson 8: Politics Advisor Swarm**
   - Learn: Multi-agent coordination, shared context
   - Build: Multiplayer threat assessment

9. **Lesson 9: Combo Detective**
   - Learn: Recursive analysis, state persistence
   - Build: Infinite combo detector

### Phase 4: Production (Complete System)
10. **Lesson 10: Complete Commander Companion**
    - Learn: Production patterns, optimization, deployment
    - Build: Full-featured assistant combining all agents

## Getting Started

```bash
# Clone the repository
git clone [repository-url]

# Install dependencies
npm install

# Start development servers (client + server)
npm run dev
```

## Project Structure

```
before-that-resolves/
├── client/          # React frontend (what users see)
├── server/          # Express + Agents (what you learn)
│   ├── agents/      # Your agent implementations
│   ├── tools/       # API integrations as tools
│   └── schemas/     # Zod validation schemas
├── shared/          # Shared TypeScript types
└── docs/           # Your learning documentation
```

## Documentation

- [Learning Plan](docs/project-plan.md) - Detailed SDK learning roadmap
- [Session History](docs/sessions.md) - Your development progress

## Why This Project?

The Commander format's complexity makes it perfect for learning the SDK:
- **The Stack** → Async operation ordering (like Promise chains)
- **Instant Speed** → Interruption and handoff patterns
- **Multiplayer Politics** → Multi-agent coordination
- **100-card Singleton** → Complex validation rules
- **Combo Detection** → Recursive pattern analysis

## Contributing

This is a learning project designed to teach the @openai/agents SDK. Feel free to fork and follow along with your own implementation!

## License

MIT

---

*"Before that resolves..."* - Where learning happens 🎴

A project for developers who want to master agent orchestration through practical MTG implementation.