# ⚔️ Before That Resolves - Developer Learning Plan

**Master @openai/agents SDK by Building a Commander/EDH Assistant**

> 📚 **IMPORTANT**: This is a learning project for YOU, the developer. The goal is to teach you the OpenAI Agents SDK through practical implementation. While you're learning agent patterns, your users will simply see a powerful MTG Commander assistant with no exposure to SDK concepts.

## Project Overview

**Before That Resolves** is a developer learning project designed to teach you the OpenAI Agents SDK through practical implementation. By building a fully-functional MTG Commander assistant, you'll progressively learn agent patterns, from basic tool creation to complex multi-agent orchestration.

**Your Learning Journey**: Each MTG feature you implement teaches specific SDK concepts.
**The End Product**: A legitimate Commander deck builder and strategy tool (with no SDK concepts exposed to users).

The name serves dual purpose: it's the iconic MTG phrase for stack interaction, and a perfect metaphor for the agent handoff patterns you'll master.

## Your SDK Learning Objectives

Through building this MTG assistant, you will learn to:

1. **Create Specialized Agents** - Build domain experts with specific capabilities
2. **Master Zod Validation** - Implement complex schemas for data validation
3. **Manage Agent State** - Persist and share context across agent calls
4. **Orchestrate External APIs** - Wrap third-party services as agent tools
5. **Implement Agent Logic** - Build reasoning systems for strategic decisions
6. **Handle Errors Gracefully** - Create robust fallback and retry patterns
7. **Deploy Production Systems** - Build scalable, maintainable agent architectures

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: Zustand for global state, React Context for UI
- **Agent SDK**: @openai/agents + Zod validation
- **APIs**: Scryfall, EDHREC, TCGPlayer
- **Backend**: Express.js API server for agent execution
- **Database**: PostgreSQL for deck storage (Supabase)
- **Deployment**: Frontend on Vercel, API on Railway

## Your 10-Lesson SDK Learning Path

### **Level 1: SDK Fundamentals** (Lessons 1-3)
- [ ] **Lesson 1**: Card Oracle Agent
  - **You Learn**: Basic agent creation, tool implementation, API wrapping
  - **You Build**: Card lookup and rulings service
  - **SDK Concepts**: `createAgent()`, `tool()`, Zod parameter schemas

- [ ] **Lesson 2**: Commander Legality Tool
  - **You Learn**: Complex validation schemas, constraint systems
  - **You Build**: Color identity and ban list validator
  - **SDK Concepts**: Nested Zod schemas, `.refine()`, type inference

- [ ] **Lesson 3**: Mana Base Calculator
  - **You Learn**: Advanced schema composition, computed properties
  - **You Build**: Mana curve and land optimization tool
  - **SDK Concepts**: `z.union()`, `z.discriminatedUnion()`, transforms

### **Level 2: Advanced Patterns** (Lessons 4-6)
- [ ] **Lesson 4**: Streaming Deck Analysis
  - **You Learn**: Real-time streaming responses, progressive updates
  - **You Build**: Live feedback system as deck is built
  - **SDK Concepts**: Streaming responses, chunked data handling

- [ ] **Lesson 5**: Budget Optimizer
  - **You Learn**: Error handling, retry logic, graceful degradation
  - **You Build**: Price-conscious card alternative finder
  - **SDK Concepts**: Try/catch patterns, exponential backoff, fallbacks

- [ ] **Lesson 6**: Synergy Orchestra
  - **You Learn**: Multi-tool coordination, parallel execution
  - **You Build**: Card synergy and combo discoverer
  - **SDK Concepts**: Promise.all(), tool composition, result aggregation

### **Level 3: Multi-Agent Systems** (Lessons 7-9)
- [ ] **Lesson 7**: Power Level Assessment
  - **You Learn**: Agent handoffs, delegation patterns
  - **You Build**: Deck strength evaluator (1-10 scale)
  - **SDK Concepts**: `handoff()`, agent specialization, result passing

- [ ] **Lesson 8**: Politics Advisor Swarm
  - **You Learn**: Multi-agent coordination, consensus systems
  - **You Build**: Multiplayer threat assessment system
  - **SDK Concepts**: Agent swarms, shared context, voting mechanisms

- [ ] **Lesson 9**: Combo Detective
  - **You Learn**: Recursive analysis, state persistence
  - **You Build**: Infinite combo and win condition finder
  - **SDK Concepts**: Recursive tools, state management, memoization

### **Level 4: Production Mastery** (Lesson 10)
- [ ] **Lesson 10**: Complete Commander Companion
  - **You Learn**: System integration, performance optimization, deployment
  - **You Build**: Full-featured assistant combining all agents
  - **SDK Concepts**: Agent orchestration, caching, production patterns

## Seven Specialized Agents (Your Learning Exercises)

Each agent you build teaches different SDK techniques through practical MTG functionality:

### ⚖️ **Rules Arbiter Agent** (Lesson 1 Extension)
```typescript
tools: [getOracleText, checkColorIdentity, validateCommander, explainInteraction]
```
**What You Learn**: Tool creation patterns, external API integration, response formatting
**MTG Feature**: Resolve rules disputes and explain complex interactions
**Example Query**: "Can I use Fierce Guardianship if my commander is phased out?"
**SDK Deep Dive**: Creating tools with complex parameter validation, handling API rate limits

### 🎨 **Deck Architect Agent** (Lesson 2-3 Extension)
```typescript
tools: [validateSingleton, optimizeManaBase, balanceCategories, checkCMC]
```
**What You Learn**: Complex nested validation, schema composition, type safety
**MTG Feature**: Build legal, balanced Commander decks
**Example Query**: "Build a Prosper, Tome-Bound deck focused on exile synergies"
**SDK Deep Dive**: Advanced Zod patterns, discriminated unions, custom validators

### 💰 **Budget Optimizer Agent** (Lesson 5 Focus)
```typescript
tools: [findBudgetAlternatives, trackPrices, compareVersions, calculateTCG]
```
**What You Learn**: Error boundaries, retry strategies, fallback patterns
**MTG Feature**: Maximize deck power within budget constraints
**Example Query**: "Replace expensive cards in this deck with budget alternatives under $5"
**SDK Deep Dive**: Handling API failures, exponential backoff, cache strategies

### 🔍 **Combo Detective Agent** (Lesson 9 Focus)
```typescript
tools: [findCombos, detectInfinites, analyzeWincons, checkRedundancy]
```
**What You Learn**: Recursive tool calls, pattern matching, memoization
**MTG Feature**: Identify win conditions and combo lines
**Example Query**: "What infinite combos exist in my Kinnan deck?"
**SDK Deep Dive**: Building recursive analysis tools, avoiding infinite loops, state persistence

### 🎭 **Politics Advisor Agent** (Lesson 8 Focus)
```typescript
tools: [assessThreats, predictAlliances, suggestDeals, evaluateBoard]
```
**What You Learn**: Multi-agent coordination, shared context, consensus algorithms
**MTG Feature**: Navigate multiplayer dynamics
**Example Query**: "Who should I target? Player 2 has Rhystic Study but Player 3 has more creatures"
**SDK Deep Dive**: Agent swarms, voting systems, context sharing between agents

### 📊 **Power Scout Agent** (Lesson 7 Focus)
```typescript
tools: [calculatePowerLevel, compareToMeta, analyzeSpeed, checkStax]
```
**What You Learn**: Fuzzy logic implementation, weighted scoring, delegation
**MTG Feature**: Assess deck strength (1-10 scale)
**Example Query**: "Rate my deck's power level for a casual pod"
**SDK Deep Dive**: Agent handoffs, specialized sub-agents, result aggregation

### 🏆 **Meta Analyst Agent** (Bonus Advanced)
```typescript
tools: [getTopCommanders, analyzeArchetypes, trackBans, predictShifts]
```
**What You Learn**: Data aggregation, caching strategies, trend analysis
**MTG Feature**: Understand competitive EDH (cEDH) landscape
**Example Query**: "What's the best Dimir commander for a stax strategy?"
**SDK Deep Dive**: Efficient data fetching, cache invalidation, statistical analysis tools

## Key Features

### **Deck Builder Interface**
```
Commander: Atraxa, Praetors' Voice        Power Level: 7.5/10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Categories                 │ Mana Curve        │ Stack Assistant
─────────────────────────│──────────────────│─────────────
✓ Ramp (10/10)           │ 0: ▓▓             │ "Before that resolves,
✓ Card Draw (8/10)       │ 1: ▓▓▓▓▓          │  consider adding
✓ Removal (7/8)          │ 2: ▓▓▓▓▓▓▓▓▓▓     │  more instant-speed
⚠ Board Wipes (2/4)     │ 3: ▓▓▓▓▓▓▓▓       │  interaction"
✓ Win Conditions (3/3)   │ 4: ▓▓▓▓▓▓         │
```

### **Stack Interaction Visualizer**
Shows the stack resolving with agent responses at each priority pass:
```
┌─────────────────────────┐
│ TOP OF STACK            │
│ Lightning Bolt → You    │ ← "Before that resolves..."
│ ─────────────────────── │
│ Rhystic Study Trigger   │ ← Politics Advisor: "Pay the 1"
│ ─────────────────────── │
│ Doubling Season ETB     │
└─────────────────────────┘
```

### **MTG Application Features** (What Users See)
- **Deck Builder**: 100-card singleton deck construction with real-time validation
- **Strategy Assistant**: Power level assessment and optimization suggestions
- **Rules Engine**: Complex interaction resolution and legality checking
- **Budget Tools**: Find alternatives within price constraints
- **Meta Analysis**: Track competitive trends and popular strategies

### **Commander-Specific Tools**
- **Opening Hand Simulator**: Mulligan decisions with probability
- **Combo Line Tracker**: Visual paths to victory
- **Threat Assessment Matrix**: Evaluate all players' boards
- **Political Deal Maker**: Suggest beneficial negotiations
- **Rule 0 Conversation**: Power level pre-game discussion

## Implementation Phases (Your Learning Journey)

### **Phase 1: SDK Foundation** (Lessons 1-3)
**What You'll Learn**: Basic agent patterns, tool creation, Zod validation
- [ ] Set up development environment (React + Express + TypeScript)
- [ ] Learn basic agent creation with Card Oracle Agent
- [ ] Master Zod schemas with Commander Legality Tool
- [ ] Practice complex validation with Mana Base Calculator
- [ ] Implement Scryfall API as agent tools
- [ ] Build simple UI to test your agents
**Outcome**: You'll understand core SDK concepts and have working card lookup agents

### **Phase 2: Advanced Patterns** (Lessons 4-6)
**What You'll Learn**: Streaming, error handling, multi-tool orchestration
- [ ] Implement streaming responses in Deck Analysis
- [ ] Master error handling with Budget Optimizer
- [ ] Learn tool coordination with Synergy Orchestra
- [ ] Add EDHREC integration with retry logic
- [ ] Practice graceful degradation patterns
- [ ] Build interactive deck builder UI
**Outcome**: You'll handle real-world API constraints and complex tool interactions

### **Phase 3: Multi-Agent Systems** (Lessons 7-9)
**What You'll Learn**: Agent handoffs, swarms, recursive analysis
- [ ] Build agent delegation with Power Level Assessment
- [ ] Create agent swarms for Politics Advisor
- [ ] Implement recursive patterns in Combo Detective
- [ ] Master shared state management
- [ ] Practice consensus algorithms
- [ ] Design complex interaction flows
**Outcome**: You'll orchestrate multiple specialized agents working together

### **Phase 4: Production Mastery** (Lesson 10)
**What You'll Learn**: System integration, optimization, deployment
- [ ] Combine all agents into Complete Commander Companion
- [ ] Implement caching and performance optimization
- [ ] Add production error handling and logging
- [ ] Deploy to cloud platforms
- [ ] Monitor agent performance
- [ ] Document your SDK learnings
**Outcome**: You'll have production-ready agent system knowledge

## Project Structure
```
before-that-resolves/
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── deck/
│   │   │   │   ├── DeckBuilder.tsx
│   │   │   │   ├── ManaCurve.tsx
│   │   │   │   └── CategoryTracker.tsx
│   │   │   ├── game/
│   │   │   │   ├── StackVisualizer.tsx
│   │   │   │   ├── BoardState.tsx
│   │   │   │   └── PriorityTimer.tsx
│   │   │   ├── agents/
│   │   │   │   ├── AgentChat.tsx
│   │   │   │   ├── AgentVisualizer.tsx
│   │   │   │   └── ToolTimeline.tsx
│   │   │   └── learning/
│   │   │       ├── ConceptProgress.tsx
│   │   │       ├── CodePlayground.tsx
│   │   │       └── StackPuzzle.tsx
│   │   ├── pages/
│   │   │   ├── Learn.tsx      # SDK learning mode
│   │   │   ├── Build.tsx      # Deck builder
│   │   │   ├── Analyze.tsx    # Deck analysis
│   │   │   └── Game.tsx       # Game assistant
│   │   ├── hooks/
│   │   │   ├── useAgent.ts
│   │   │   ├── useDeck.ts
│   │   │   └── useStack.ts
│   │   ├── stores/
│   │   │   ├── deckStore.ts   # Zustand store
│   │   │   └── gameStore.ts
│   │   ├── utils/
│   │   │   ├── manaParser.ts
│   │   │   └── colorIdentity.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   └── package.json
├── server/                     # Express API
│   ├── src/
│   │   ├── agents/
│   │   │   ├── rulesArbiter.ts
│   │   │   ├── deckArchitect.ts
│   │   │   ├── budgetOptimizer.ts
│   │   │   ├── comboDetective.ts
│   │   │   ├── politicsAdvisor.ts
│   │   │   ├── powerScout.ts
│   │   │   └── metaAnalyst.ts
│   │   ├── tools/
│   │   │   ├── scryfall/
│   │   │   │   ├── search.ts
│   │   │   │   ├── rulings.ts
│   │   │   │   └── symbols.ts
│   │   │   ├── edhrec/
│   │   │   │   ├── recommendations.ts
│   │   │   │   └── synergies.ts
│   │   │   └── prices/
│   │   │       └── tcgplayer.ts
│   │   ├── schemas/
│   │   │   ├── commander.ts    # Color identity validation
│   │   │   ├── deck.ts        # 100-card singleton rules
│   │   │   ├── combo.ts       # Combo pattern detection
│   │   │   └── mana.ts        # Mana cost parsing
│   │   ├── routes/
│   │   │   ├── agents.ts
│   │   │   ├── decks.ts
│   │   │   └── cards.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   └── rateLimit.ts
│   │   └── index.ts
│   └── package.json
├── shared/                     # Shared types
│   └── types/
│       ├── card.ts
│       ├── deck.ts
│       └── agent.ts
├── docs/
│   ├── project-plan.md        # This file
│   ├── sessions.md            # Development history
│   └── learning-content/      # SDK tutorials
└── package.json               # Root package.json for scripts
```

## Example User Journeys

### **New Commander Player**
"I just got the Lathril precon, how do I upgrade it?"
1. Deck Architect analyzes current list
2. Budget Optimizer suggests upgrades under $50
3. Synergy Orchestra finds elf tribal synergies
4. Power Scout confirms it stays casual-friendly
5. Visual deck diff shows changes

### **Rules Interaction**
"Someone cast Cyclonic Rift, I want to respond with Teferi's Protection"
1. Stack Visualizer shows current stack
2. Rules Arbiter confirms it's a legal response
3. Explains the resolution order
4. Shows final board state after resolution
5. "Before that resolves..." moment captured perfectly

### **Political Decision**
"It's turn 5, who should I attack?"
1. Politics Advisor evaluates all boards
2. Threat assessment matrix shows dangers
3. Suggests optimal attack pattern
4. Predicts likely responses
5. Recommends political deals

## Success Metrics

### Your Learning Milestones
- [ ] Can create agents with custom tools from scratch
- [ ] Understand and implement complex Zod validation schemas
- [ ] Successfully handle API errors and implement retry logic
- [ ] Can orchestrate multiple agents with handoffs
- [ ] Implement streaming responses for real-time feedback
- [ ] Build recursive analysis tools without infinite loops
- [ ] Deploy production-ready agent systems

### MTG App Quality (Validates Your Learning)
- [ ] Successfully validates Commander deck legality
- [ ] Accurately assesses power levels (±1 on 1-10 scale)
- [ ] Finds infinite combos reliably
- [ ] Provides useful multiplayer advice
- [ ] Handles Scryfall rate limits gracefully

### Technical Benchmarks
- [ ] Agent response time < 200ms for simple queries
- [ ] Proper error recovery from API failures
- [ ] Efficient caching reduces API calls by 70%+
- [ ] Multi-agent tasks complete without deadlocks

## Development Notes

### Scryfall API
- Rate limit: 10 requests/second
- Implement exponential backoff
- Cache card data aggressively
- Use bulk data for initial load

### EDHREC Integration
- No official API, web scraping required
- Cache recommendations for 24 hours
- Fallback to local synergy database

### React Architecture
- Use React Query for API calls
- Implement optimistic updates for deck changes
- Virtual scrolling for large card lists
- Code splitting by route

### Agent Communication
- WebSocket for real-time streaming
- Queue system for agent handoffs
- Shared context for multi-agent tasks
- Transaction rollback on errors

## Why "Before That Resolves"?

The name is perfect for YOUR learning journey:
1. **MTG Reference** - Instantly recognizable to Commander players (your users)
2. **Agent Pattern** - Represents handoffs and interruptions (what you're learning)
3. **Learning Metaphor** - The pause where you understand a new concept
4. **Stack Analogy** - MTG's stack mirrors async agent orchestration patterns

## Progress Tracking

### Current Status: Planning Phase
- [x] Project renamed to "Before That Resolves"
- [x] Shifted from Next.js to React
- [x] Commander/EDH focus established
- [x] Project plan created
- [ ] React setup pending
- [ ] API server setup pending
- [ ] First agent implementation pending

### Session Log
- **Session 1**: Initial SDK learning with generic examples
- **Session 2**: Pivoted to BoardGame Brain concept
- **Session 3** (Current): Refined to "Before That Resolves" Commander assistant
- **Session 4** (Upcoming): Foundation implementation
- **Session 5** (Future): Deck building features

---

*Last Updated: September 19, 2025*
*Status: Planning Complete - Ready for Implementation*
*Priority: Hold for the 1, respond at instant speed*
