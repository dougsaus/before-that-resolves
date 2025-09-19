# Before That Resolves - Session History

## Overview
This document tracks the development sessions for "Before That Resolves," a project where the developer (you) learns the @openai/agents SDK by building a fully-functional MTG Commander/EDH assistant.

---

## Session 1: Initial SDK Learning & Examples
**Date**: September 18, 2025
**Model**: Claude Opus 4.1
**Focus**: Building a learning workspace for the @openai/agents SDK with GPT-5 codex integration

### Context
- Started with an existing TypeScript project structure for learning agentic AI
- Discovered the user has access to GPT-5 via the `codex` CLI tool
- Needed to learn the new @openai/agents SDK (version 0.1.3) which was beyond Claude's training data

### Key Accomplishments

#### 1. Infrastructure Setup
- **Created Agent Configuration**: Built `ai-config/claude/agents/openai-agents-sdk.md`
  - Proactive agent that combines embedded SDK knowledge with GPT-5 reasoning
  - Auto-activates on SDK-related keywords
  - Executes codex commands for complex SDK patterns
- **Verified Codex CLI**: Confirmed access to GPT-5 model via `codex -m gpt-5-codex exec`
- **Installed Dependencies**: Added `@openai/agents` and `zod@3` to the workspace

#### 2. Working Examples Developed

##### Basic Agent (`src/examples/basic-agent-sdk.ts`)
- Demonstrates fundamental SDK concepts
- Calculator and web search tools with Zod validation
- Interactive mode for testing
- Pattern: `createAgent()`, `tool()`, `runAgent()`

##### Multi-Agent Swarm (`src/examples/multi-agent-swarm.ts`)
- Five specialized agents with distinct roles:
  - **Planner**: Breaks down complex requests
  - **Coordinator**: Manages task execution
  - **Researcher**: Gathers information
  - **Analyst**: Analyzes data
  - **Reviewer**: Quality control and summarization
- Shared state management via `SwarmState` class
- Dynamic handoffs between agents
- Task queue system for coordination

##### Advanced Tools (`src/examples/advanced-tools-zod.ts`)
- Complex Zod schema patterns:
  - Email, phone, URL validation
  - Nested object schemas
  - Discriminated unions for variant types
  - Custom validation rules with `.refine()`
- Five sophisticated tools:
  - Person management (CRUD operations)
  - Product catalog (multiple product types)
  - File operations (with safety checks)
  - API requests (simulated)
  - Data transformation and validation
- Type inference from schemas using `z.infer<>`

#### 3. Documentation
- **Learnings Document** (`docs/learnings-agents-sdk.md`):
  - SDK architecture breakdown
  - Core concepts (Agents, Tools, Handoffs)
  - Discovered patterns and best practices
  - Codex CLI integration strategies
  - Migration guide from traditional OpenAI SDK
  - Performance considerations
  - Testing strategies

### Key Patterns Discovered

1. **Tool Creation Pattern**:
```typescript
const myTool = tool({
  name: 'toolName',
  description: 'Clear description',
  parameters: z.object({ /* Zod schema */ }),
  execute: async (params) => { /* implementation */ }
});
```

2. **Agent Handoff Pattern**:
```typescript
agent.handoff = [
  handoff({
    agent: targetAgent,
    description: 'When to hand off'
  })
];
```

3. **Shared State Pattern**:
- Centralized state management for multi-agent coordination
- Tools that read/write to shared state
- Task queue for work distribution

### Technical Insights

1. **SDK Structure**:
   - `@openai/agents-core`: Core functionality
   - `@openai/agents-openai`: OpenAI provider
   - `@openai/agents-realtime`: Voice capabilities

2. **Zod Integration**:
   - Replaces JSON Schema for parameter validation
   - Provides TypeScript type inference
   - Enables complex validation rules

3. **Codex CLI Usage**:
   - Access to GPT-5 model for advanced reasoning
   - Pattern: `echo "prompt" | codex -m gpt-5-codex exec`
   - Useful for verifying implementations and getting SDK guidance

### File Structure Created
```
agentic-ai-workspace/
├── src/
│   └── examples/
│       ├── basic-agent-sdk.ts       # Fundamental concepts
│       ├── multi-agent-swarm.ts     # Orchestration patterns
│       └── advanced-tools-zod.ts    # Complex tool integration
├── docs/
│   ├── project-plan.md              # Original project plan
│   ├── learnings-agents-sdk.md      # SDK learnings and patterns
│   └── sessions.md                  # This file
└── package.json                     # Updated with @openai/agents

ai-config/
└── claude/
    └── agents/
        └── openai-agents-sdk.md    # Specialized agent config
```

### Environment Details
- **Node.js**: v24.8.0
- **npm**: 11.6.0
- **TypeScript**: 5.9.2
- **@openai/agents**: 0.1.3
- **zod**: 3.25.76
- **codex CLI**: 0.36.0

### Future Work Opportunities

1. **Realtime Agents**: Explore voice-enabled agents with WebRTC
2. **Guardrails**: Implement input/output validation systems
3. **Production Deployment**: Add monitoring, logging, and error recovery
4. **Dynamic Tool Creation**: Agents that generate their own tools
5. **Cross-Provider Integration**: Connect multiple AI providers

### Key Takeaways

1. **Knowledge Bridge Strategy**: Successfully used GPT-5 via codex CLI to learn an SDK beyond Claude's training data
2. **Pattern-Based Learning**: Built progressively complex examples to understand SDK capabilities
3. **Documentation-Driven Development**: Created comprehensive documentation alongside code
4. **Agent Configuration as Knowledge**: Embedded SDK expertise in reusable agent configurations

### Commands for Quick Start
```bash
# Test basic agent
npx ts-node src/examples/basic-agent-sdk.ts

# Run interactive mode
npx ts-node src/examples/basic-agent-sdk.ts --interactive

# Test multi-agent swarm
npx ts-node src/examples/multi-agent-swarm.ts

# Test advanced tools
npx ts-node src/examples/advanced-tools-zod.ts

# Get SDK help via codex
echo "Explain [concept] in @openai/agents SDK" | codex -m gpt-5-codex exec
```

---

## Next Session Planning

### Potential Topics
- [ ] Implement realtime voice agents
- [ ] Build production-ready error handling
- [ ] Create agent monitoring dashboard
- [ ] Explore agent memory systems
- [ ] Implement agent-to-agent communication protocols

### Context to Remember
- Codex CLI provides GPT-5 access for advanced reasoning
- Agent configurations in `ai-config/claude/agents/` are reusable
- The workspace is set up for TypeScript development with hot reload
- Examples follow a progression from basic to advanced

---

## Session 2: Initial Domain Planning - BoardGame Brain
**Date**: September 19, 2025 (Morning)
**Model**: Claude Opus 4.1
**Focus**: First pivot to domain-driven learning with BoardGameGeek

### Context from Previous Work
- Established comprehensive agent configuration system in `ai-config`
- Created `openai-agents-sdk` expert agent with GPT-5 codex integration
- Built initial SDK examples (now archived)
- Discovered effective patterns for multi-agent coordination

### Key Decisions

#### Initial Project Pivot
- **From**: Generic SDK learning examples
- **To**: BoardGame Brain - board game discovery platform
- **Rationale**: Real-world context makes learning more engaging

#### Architecture Choices
1. **Next.js 14 with App Router** for modern React patterns
2. **BoardGameGeek API** as real-world data source
3. **Progressive concept unlock** for guided learning
4. **Specialized agents** for different game analysis tasks

### BoardGame Brain Overview

#### Core Concept
An interactive web app where users learn @openai/agents SDK by building AI agents that help with board game discovery, recommendations, and game night planning.

#### Learning Path (10 Concepts)
1. **Basic Agent** - Simple game info responses
2. **Search Tool** - BGG API integration
3. **Zod Validation** - Complex parameter schemas
4. **Streaming** - Real-time responses
5. **Error Handling** - API limits and retries
6. **Multi-Tool** - Orchestrating multiple tools
7. **Agent Handoffs** - Specialist collaboration
8. **Swarms** - Coordinated agent systems
9. **Shared State** - Memory across agents
10. **Production** - Complete game advisor

#### Specialized Agents Planned
- **Game Finder** - Search and discovery
- **Mechanics Analyst** - Complexity analysis
- **Social Gaming** - Group recommendations
- **Collection Curator** - Personal library management
- **Game Night Coordinator** - Session planning

### Implementation Plan

#### Phase 1: Foundation (Week 1)
- Next.js setup with TypeScript
- BGG API wrapper service
- First 3 concepts implementation
- Basic UI with shadcn/ui

#### Phase 2: Advanced Features (Week 2)
- Streaming support
- Concepts 4-6
- Agent visualization tools
- Interactive playground

#### Phase 3: Multi-Agent (Week 3)
- Concepts 7-9
- Conversation UI
- State management
- Debug tools

#### Phase 4: Production (Week 4)
- Concept 10
- Authentication
- Persistence
- Deployment

### Technical Insights

#### BGG API Integration Strategy
- XML to JSON conversion layer
- Aggressive caching (2 req/sec limit)
- Error handling for incomplete data
- Mock data for development

#### Learning Enhancement Features
- **Visual debugging** - See agent decision process
- **Code playground** - Modify agents in real-time
- **Progress tracking** - Unlock concepts sequentially
- **Export templates** - Take working code with you

### Files Modified
- **Renamed**: `package.json` to BoardGame Brain
- **Removed**: `src/examples/` (old SDK examples)
- **Updated**: `docs/project-plan.md` with new architecture
- **Updated**: `docs/sessions.md` (this file)

### Key Takeaways

1. **Domain-driven learning** is more engaging than abstract examples
2. **Board games** provide rich, relatable context for agent specialization
3. **Progressive disclosure** helps manage complexity
4. **Visual tools** are essential for understanding agent behavior
5. **Real API constraints** teach practical error handling

### Next Steps

#### Immediate Actions
1. Initialize Next.js 14 project
2. Set up Tailwind CSS and shadcn/ui
3. Create BGG API wrapper
4. Build first concept (Basic Agent)

#### Future Considerations
- Mobile responsiveness
- Community agent sharing
- Voice interaction
- Discord bot integration

### Session Summary (BoardGame Brain Phase)

Initial pivot to domain-specific learning established the value of real-world context for SDK education.

---

## Session 3: Final Pivot to "Before That Resolves"
**Date**: September 19, 2025 (Afternoon)
**Model**: Claude Opus 4.1
**Session Cost**: $15.60
**Focus**: Refined to Magic: The Gathering Commander format with React

### Evolution of Concept
1. **Started**: Generic SDK examples
2. **First Pivot**: BoardGame Brain (BGG integration)
3. **Final Form**: Before That Resolves (MTG Commander)

### Key Refinements

#### Domain Selection: Why Commander?
- **Deeper Complexity**: Stack interactions, priority, phases
- **Clearer Constraints**: 100-card singleton, color identity
- **Richer Learning**: Politics, threat assessment, combo detection
- **Cultural Resonance**: "Before that resolves" as perfect metaphor

#### Technical Stack Changes
- **From**: Next.js 14 (App Router)
- **To**: React 18 with Vite
- **Backend**: Express.js API server
- **State**: Zustand + React Context
- **Rationale**: Better separation of concerns, more flexible architecture

### Project Name: "Before That Resolves"
- **MTG Reference**: What players say when responding to spells
- **Agent Metaphor**: Each agent acts "before that resolves"
- **Learning Moment**: The pause where understanding happens
- **Personal Touch**: Inside joke with weekly Commander pod

### Enhanced Learning Path

#### Refined Concepts (1-10)
1. **Card Oracle** - Basic lookups and rulings
2. **Commander Legality** - Color identity validation
3. **Mana Base Calculator** - Complex Zod schemas
4. **Streaming Analysis** - Real-time deck feedback
5. **Budget Optimizer** - Error handling with price APIs
6. **Synergy Orchestra** - Multi-tool coordination
7. **Power Assessment** - Agent handoffs for metrics
8. **Politics Advisor** - Multiplayer threat analysis
9. **Combo Detective** - Infinite loop detection
10. **Complete Companion** - Full production system

#### Specialized Agents Created
- **Rules Arbiter** - Complex interaction judge
- **Deck Architect** - 100-card deck builder
- **Budget Optimizer** - Price-conscious alternatives
- **Combo Detective** - Win condition finder
- **Politics Advisor** - Multiplayer strategist
- **Power Scout** - Deck strength evaluator
- **Meta Analyst** - cEDH landscape tracker

### Technical Insights

#### Stack as Teaching Tool
The MTG stack perfectly mirrors async programming:
- LIFO resolution = Promise chain
- Priority passes = await points
- Instant speed = interrupt handlers
- State-based actions = event loop

#### Commander Constraints as Validation
- Singleton rule = unique constraint validation
- Color identity = complex type checking
- Command zone = special state management
- Partner commanders = multi-agent coordination

### Implementation Architecture

#### Frontend (React + Vite)
```
client/
├── components/
│   ├── deck/        # Deck building UI
│   ├── game/        # Stack visualizer
│   ├── agents/      # Agent interaction
│   └── learning/    # SDK tutorials
├── pages/           # Main app sections
├── hooks/           # Custom React hooks
└── stores/          # Zustand state
```

#### Backend (Express + OpenAI SDK)
```
server/
├── agents/          # Agent implementations
├── tools/           # API integrations
├── schemas/         # Zod validations
└── routes/          # REST endpoints
```

### Key Features Designed

#### Stack Visualizer
```
┌─────────────────────────┐
│ Lightning Bolt → You    │ ← Active
│ ─────────────────────── │
│ Rhystic Study Trigger   │ ← Waiting
│ ─────────────────────── │
│ Sol Ring                │ ← Resolved
└─────────────────────────┘
```

#### Political Decision Matrix
- Threat assessment scores
- Alliance predictions
- Deal recommendations
- Attack optimizations

#### Combo Line Tracker
- Visual combo paths
- Redundancy analysis
- Protection requirements
- Mana requirements

### Files Updated
- `package.json` → "before-that-resolves"
- `docs/project-plan.md` → Complete rewrite for MTG
- `docs/sessions.md` → Added Session 3
- Removed old BoardGame Brain references

### Key Achievements

1. **Found Perfect Domain**: Commander complexity ideal for SDK teaching
2. **Cultural Connection**: Name resonates with MTG players
3. **Clear Architecture**: React + Express provides clean separation
4. **Progressive Complexity**: Stack fundamentals → Political mastery
5. **Practical Value**: Solves real Commander player problems

### Next Steps

#### Immediate (Session 4)
1. Initialize React with Vite
2. Set up Express.js server
3. Implement Scryfall integration
4. Build Card Oracle Agent

#### Future Considerations
- WebSocket for real-time updates
- Deck sharing community
- Discord bot integration
- Mobile responsive design
- Voice commands ("Hey, before that resolves...")

### Session Summary

Successfully refined the project from a generic board game assistant to a focused Commander/EDH tool. "Before That Resolves" captures both MTG culture and the essence of agent interruption patterns. The React + Express architecture provides flexibility for complex state management while the Commander format offers perfect complexity progression for teaching @openai/agents SDK concepts.

The project is now positioned as both an educational platform for developers learning agent orchestration and a genuinely useful tool for Commander players managing the complexity of multiplayer Magic.

---

## Session 4: Critical Reframing & Clean Implementation Start
**Date**: September 19, 2025 (Late Afternoon)
**Model**: Claude Opus 4.1
**Focus**: Understanding true project purpose and beginning clean implementation

### Critical Clarification

**Key Realization**: This project is for teaching the DEVELOPER (you) the OpenAI Agents SDK, NOT for teaching app users about AI. The MTG Commander app is the vehicle for learning, but users only see MTG features.

### Major Accomplishments

#### 1. Documentation Reframing
- **Updated README.md**:
  - Explicitly states this is a developer learning project
  - Separated "What You Learn" (SDK patterns) from "What Users See" (MTG features)
  - Removed all user-facing "learning mode" features

- **Updated project-plan.md**:
  - Renamed "concepts" to "lessons" throughout
  - Each lesson now shows SDK learning objectives vs. MTG features built
  - Success metrics track developer learning milestones
  - Added clear note: "This is a learning project for YOU, the developer"

#### 2. Clean Slate Implementation
- **Removed Old Code**:
  - Deleted generic `src/` directory with non-MTG agent code
  - Removed old `package.json`, `tsconfig.json`, and `node_modules`
  - Started completely fresh to avoid confusion

- **Created New Structure**:
  ```
  before-that-resolves/
  ├── client/       # React + Vite frontend
  ├── server/       # Express + OpenAI SDK backend
  ├── shared/       # Shared TypeScript types
  └── docs/         # Developer learning documentation
  ```

#### 3. Development Environment Setup
- **Frontend (client/)**:
  - React 18 + TypeScript + Vite initialized
  - Tailwind CSS configured with MTG-themed colors
  - Basic app shell created showing project status

- **Backend (server/)**:
  - Express server with TypeScript
  - Placeholder endpoints for future agent implementation
  - CORS and middleware configured

- **Shared Types (shared/)**:
  - Basic `Card` and `DeckList` interfaces
  - `AgentQuery` and `AgentResponse` types
  - Foundation for type-safe development

#### 4. Dependency Management
- Monorepo setup with npm workspaces
- All packages installed including `@openai/agents` SDK
- Build verification: All packages compile successfully

### Key Insights from This Session

1. **Learning Focus Clarity**: The project's purpose is YOUR education in the SDK, not user education about AI
2. **Clean Start Value**: Removing old code prevented conceptual confusion
3. **Progressive Learning Path**: 10 lessons, each teaching specific SDK patterns through MTG features
4. **Separation of Concerns**: Users see Commander assistant, developer learns agent orchestration

### Technical Details

#### Installed Key Dependencies
- **Frontend**: React, React Router, Zustand, Axios, Tailwind CSS
- **Backend**: Express, @openai/agents, Zod, CORS, dotenv
- **Dev Tools**: TypeScript, Vite, nodemon, ESLint

#### Project Configuration
- TypeScript strict mode enabled
- Tailwind with MTG color palette
- Environment variables documented in `.env.example`
- Workspace linking for shared types

### The 10-Lesson Learning Path (Clarified)

1. **Card Oracle Agent** → Learn basic agent creation
2. **Commander Legality** → Learn Zod validation
3. **Mana Base Calculator** → Learn complex schemas
4. **Streaming Analysis** → Learn real-time responses
5. **Budget Optimizer** → Learn error handling
6. **Synergy Orchestra** → Learn tool coordination
7. **Power Assessment** → Learn agent handoffs
8. **Politics Advisor** → Learn multi-agent systems
9. **Combo Detective** → Learn recursive patterns
10. **Complete Companion** → Learn production deployment

### Next Steps (Ready for Lesson 1)

When returning from lunch, we'll begin **Lesson 1: Card Oracle Agent** where you'll:
- Build your first agent using the @openai/agents SDK
- Create tools with Zod parameter validation
- Integrate Scryfall API as agent tools
- Learn the fundamental patterns: `createAgent()`, `tool()`, `runAgent()`

### Development Commands Ready

```bash
# Install dependencies (✅ completed)
npm install

# Run development servers
npm run dev  # Runs both client and server

# Build commands
npm run build  # Builds all packages
```

### Session Summary

This session achieved critical clarity: the project teaches YOU the SDK through building a real MTG app. With old code removed and fresh structure in place, we're ready for hands-on SDK learning. The development environment is verified and working. Lesson 1 (Card Oracle Agent) is ready to begin.

---

## Session 5: Lesson 1 - Card Oracle Agent Implementation
**Date**: September 19, 2025 (Evening)
**Model**: Claude Opus 4.1
**Session Cost**: $31.60 (Claude statusline) + ~$5-10 (estimated SDK agent/codex calls) = ~$37-42 total
**Focus**: Implementing first agent with @openai/agents SDK v0.1.3

### Learning Objectives Achieved

Successfully completed **Lesson 1: Card Oracle Agent**, learning:
- Basic agent creation with `new Agent()`
- Tool implementation with `tool()` and Zod schemas
- External API integration (Scryfall)
- Proper SDK v0.1.3 patterns

### Major Accomplishments

#### 1. Scryfall API Integration
- **Created `scryfall.ts` service**:
  - Rate limiting (100ms between requests)
  - Card search by name (fuzzy matching)
  - Advanced search with complex queries
  - Random commander suggestions
  - Card rulings retrieval

#### 2. Tool Creation with Zod
- **Built 5 MTG card tools** (`card-tools.ts`):
  - `searchCardTool` - Basic card lookup
  - `advancedSearchTool` - Complex queries with filters
  - `getCardRulingsTool` - Official rulings
  - `randomCommanderTool` - Commander suggestions
  - `checkCommanderLegalityTool` - Legality validation

#### 3. Card Oracle Agent Implementation
- **Learned correct SDK v0.1.3 patterns**:
  - Used `new Agent()` not `createAgent()`
  - Used `run()` not `runAgent()`
  - Learned run() takes string or array, not `{messages: []}`
  - Created helper functions for response extraction

#### 4. Critical SDK Learning
- **Used openai-agents-sdk specialized agent**:
  - Got correct v0.1.3 API patterns
  - Fixed TypeScript compilation errors
  - Learned actual result structure differs from docs
  - Agent class doesn't support `temperature` property

#### 5. Testing Infrastructure
- **Created test components**:
  - Server test script (`test-agent.ts`)
  - React component (`CardOracleTest.tsx`)
  - Connected frontend to backend API
  - Verified with real MTG queries

### Technical Challenges & Solutions

1. **SDK API Mismatch**:
   - **Issue**: Initial implementation used wrong API patterns
   - **Solution**: Used SDK specialized agent to get correct v0.1.3 patterns
   - **Learning**: Always verify actual SDK exports when docs unclear

2. **TypeScript Compilation**:
   - **Issue**: Result structure didn't match expected types
   - **Solution**: Created helper functions to handle actual structure
   - **Learning**: SDK returns `result.output` array, not `result.messages`

3. **Environment Variables**:
   - **Issue**: Assumed .env file needed
   - **Solution**: System environment variable works directly
   - **Learning**: System env vars take precedence, more secure

### Code Structure Created

```
server/
├── agents/
│   └── card-oracle-agent.ts    # First agent implementation
├── tools/
│   └── card-tools.ts          # 5 Zod-validated tools
├── services/
│   └── scryfall.ts            # External API wrapper
├── utils/
│   └── agent-helpers.ts       # SDK helper functions
├── config/
│   └── openai.ts              # OpenAI configuration
└── test-agent.ts              # Direct testing script

client/
└── components/
    └── CardOracleTest.tsx     # UI for testing agent
```

### Working Examples Tested

Successfully tested queries:
- "What is Lightning Bolt?" → Detailed card info
- "Can Atraxa be my commander?" → Legality check with explanation
- "Find blue instant spells" → Advanced search results
- "What are the rulings for Thassa's Oracle?" → Official rulings
- "Is Sol Ring legal in Commander?" → Clarified card vs commander legality

### Key SDK Patterns Learned

1. **Agent Creation**:
```typescript
const agent = new Agent({
  name: 'Card Oracle',           // Optional
  model: 'gpt-4o',               // Required
  instructions: 'You are...',     // Required
  tools: [tool1, tool2]          // Tools array
});
```

2. **Running Agent**:
```typescript
const result = await run(agent, [
  { role: 'user', content: query }
]);
const response = extractResponseText(result);
```

3. **Tool Pattern**:
```typescript
const tool = tool({
  name: 'tool_name',
  description: 'What it does',
  parameters: z.object({ ... }),
  execute: async (params) => { ... }
});
```

### Session Summary

Lesson 1 successfully completed! Built a working Card Oracle Agent that answers MTG questions using the Scryfall API. Learned fundamental @openai/agents SDK patterns through practical implementation. The agent works with system environment variables (no .env needed) and provides detailed, accurate responses about Magic cards. Ready to commit and push to GitHub repository.

---

## Session 6: UI Enhancement with MTG Symbols & Developer Mode
**Date**: September 19, 2025 (Late Evening)
**Model**: Claude Opus 4.1
**Focus**: Professional UI improvements with real MTG symbols and developer mode

### Major Accomplishments

#### 1. UI Cleanup & Developer Mode
- **Removed all learning references from user interface**:
  - Eliminated "Lesson 1" text and learning objectives
  - Renamed components to production names (CardOracleTest → CardOracle)
  - Created clean separation between user and developer experiences

- **Implemented Developer Mode**:
  - Toggle via `Ctrl+Shift+D`, URL parameter `?dev=true`, or env variable
  - Created `DevModeContext` for state management
  - Built `DevPanel` component for agent metadata display
  - Shows tool calls, execution time, and detailed parameters

#### 2. Real MTG Symbol Implementation
- **Installed Mana Font** (andrewgioia/mana-font):
  - Professional MTG symbols via icon font
  - Supports all mana colors, hybrid, Phyrexian, and special symbols
  - Scalable vector icons that look crisp at any size

- **Created Symbol Components**:
  - `ManaSymbol.tsx` - Renders individual mana symbols
  - `ManaCost.tsx` - Parses and displays complete mana costs
  - Maps text notation (`{R}`, `{U}`, etc.) to visual symbols

#### 3. Rich Text Rendering
- **Built RichMTGText Component**:
  - Converts mana symbols (`{R}` → 🔴, `{U}` → 🔵, etc.)
  - Handles markdown formatting (**bold**, *italic*, ### headers)
  - Preserves line breaks and formatting
  - Authentic card text display matching printed cards

- **Enhanced Response Formatting**:
  - Mana costs display as actual symbols
  - Tap symbol (`{T}`) renders properly
  - Headers format correctly (### becomes proper headings)
  - Color words remain as text (authentic to cards)

#### 4. Developer Info Section
- **Created DeveloperInfo Component**:
  - Shows aggregated tool statistics (name × count)
  - Displays execution timing per tool
  - Collapsible detail view for individual calls
  - Only visible in developer mode
  - Clean, non-intrusive design

#### 5. Agent Behavior Improvements
- **Enforced Tool Usage**:
  - Modified instructions to prohibit using training knowledge
  - Agent now MUST use tools for all card information
  - Results in consistent tool tracking and metadata
  - Better demonstration of SDK capabilities

### Technical Implementation

#### Component Architecture
```
client/src/
├── components/
│   ├── CardOracle.tsx        # Main card query component
│   ├── ManaSymbol.tsx        # Symbol rendering
│   ├── RichMTGText.tsx       # Text formatting
│   ├── DeveloperInfo.tsx     # Tool statistics
│   └── DevPanel.tsx          # Developer mode panel
└── contexts/
    └── DevModeContext.tsx     # Developer mode state
```

#### Symbol Mapping
```typescript
'{W}' → White mana symbol
'{U}' → Blue mana symbol
'{B}' → Black mana symbol
'{R}' → Red mana symbol
'{G}' → Green mana symbol
'{C}' → Colorless mana
'{T}' → Tap symbol
'{X}' → Variable mana
```

### Bug Fixes & Improvements

1. **Fixed Tool Tracking**:
   - SDK agent corrected `getToolCallDetails` to use `newItems`
   - Tool calls now properly captured with arguments and results
   - Metadata correctly displays in developer mode

2. **Fixed Text Processing**:
   - Proper regex patterns for markdown and symbols
   - Headers now render as HTML elements
   - Removed color word replacement (keeping authentic to cards)

3. **TypeScript Fixes**:
   - Resolved compilation errors in agent-helpers.ts
   - Type assertions for SDK result structures
   - Proper handling of RunItem types

### Visual Improvements

#### Before
- Plain text: "Mana Cost: {2}{U}{B}"
- No formatting for headers
- Basic tool count display

#### After
- Rich display: "Mana Cost: ②🔵⚫"
- Proper headings and formatting
- Detailed tool execution metrics
- Professional MTG appearance

### Testing Results

Successfully tested with various cards:
- Lightning Bolt: `{R}` displays as red mana symbol
- Atraxa: `{G}{W}{U}{B}` shows all four color symbols
- Nicol Bolas: Complex costs like `{4}{U}{B}{B}{R}` render correctly
- Llanowar Elves: `{T}: Add {G}` shows tap and green symbols

### Key Learnings

1. **Icon fonts provide professional appearance** without custom graphics
2. **Developer mode separation** keeps production UI clean
3. **Context-aware rendering** preserves authentic card text style
4. **Tool enforcement** creates better learning examples

### Session Summary

Transformed the UI from a learning prototype to a professional MTG tool. Real mana symbols via the Mana font create an authentic Magic experience. Developer mode provides valuable debugging without cluttering the user interface. The app now looks and feels like a genuine Commander assistant while maintaining its educational value for SDK learning.

---

*Last Updated: September 19, 2025*
*Primary Author: Claude (Opus 4.1) with human collaboration*
*Status: UI complete with MTG symbols - "Before that resolves... we made it beautiful!"*