# @openai/agents v0.1.3 API Reference

## Correct API Usage

### 1. Agent Constructor

```typescript
import { Agent } from '@openai/agents';

const agent = new Agent({
  name: 'Agent Name',           // Optional
  model: 'gpt-4o',              // Required
  instructions: 'You are...',    // Required
  tools: []                      // Optional array of tools
  // Note: temperature is NOT a valid property in v0.1.3
});
```

**Valid Properties:**
- `name`: string (optional)
- `model`: string (required)
- `instructions`: string (required)
- `tools`: array (optional)

**Invalid Properties:**
- `temperature` ❌ (not supported in v0.1.3)

### 2. Run Function

```typescript
import { run } from '@openai/agents';

// Option 1: String input
const result = await run(agent, "user query");

// Option 2: Array of input items
const result = await run(agent, [
  { role: 'user', content: 'user query' }
]);

// WRONG: This does NOT work in v0.1.3
// const result = await run(agent, { messages: [...] }); ❌
```

### 3. Result Structure

The `run()` function returns a `RunResult` object with this structure:

```typescript
interface RunResult {
  state: RunState;  // Contains the conversation state
  output: AgentOutputItem[];  // Array of output items (getter property)
}
```

**Important:**
- `result.output` is accessed via a getter (not visible in Object.keys())
- There is NO `result.messages` property
- The state contains `_modelResponses` (with underscore), not `modelResponses`

### 4. Extracting Response Text

```typescript
function extractResponseText(result: RunResult<any, any>): string {
  if (!result.output || !Array.isArray(result.output)) {
    return '';
  }

  // Find the last assistant message
  for (let i = result.output.length - 1; i >= 0; i--) {
    const item = result.output[i] as any;

    if (item && item.type === 'message' && item.role === 'assistant') {
      // Handle content array structure
      if (item.content && Array.isArray(item.content)) {
        const texts = item.content
          .filter((c: any) => c.type === 'output_text' || c.type === 'text')
          .map((c: any) => c.text || '');
        return texts.join('\n');
      }
      // Handle string content
      else if (typeof item.content === 'string') {
        return item.content;
      }
    }
  }

  return '';
}
```

### 5. Counting Tool Calls

```typescript
function countToolCalls(result: RunResult<any, any>): number {
  const state = result.state as any;

  if (!state || !state._modelResponses || !Array.isArray(state._modelResponses)) {
    return 0;
  }

  return state._modelResponses
    .filter((r: any) => r.toolCalls && r.toolCalls.length > 0)
    .reduce((count: number, r: any) => count + (r.toolCalls?.length || 0), 0);
}
```

### 6. Tool Definition with Zod

**Important:** All optional fields must also be nullable for OpenAI's structured outputs.

```typescript
import { tool } from '@openai/agents';
import { z } from 'zod';

const myTool = tool({
  name: 'tool_name',
  description: 'What the tool does',
  parameters: z.object({
    required_field: z.string().describe('Required parameter'),

    // CORRECT: optional fields must also be nullable
    optional_field: z.string().optional().nullable().describe('Optional parameter'),

    // WRONG: optional without nullable
    // bad_field: z.string().optional() ❌
  }),
  execute: async (params) => {
    // Tool implementation
    return { success: true, data: 'result' };
  }
});
```

## Complete Working Example

```typescript
import { Agent, run } from '@openai/agents';
import { tool } from '@openai/agents';
import { z } from 'zod';

// Define a tool
const searchTool = tool({
  name: 'search',
  description: 'Search for information',
  parameters: z.object({
    query: z.string().describe('Search query'),
    limit: z.number().optional().nullable().describe('Max results')
  }),
  execute: async ({ query, limit }) => {
    // Implementation
    return { results: [`Result for ${query}`] };
  }
});

// Create agent
const agent = new Agent({
  name: 'Search Assistant',
  model: 'gpt-4o',
  instructions: 'You are a helpful search assistant.',
  tools: [searchTool]
});

// Execute agent
async function executeAgent(userQuery: string) {
  try {
    // Run the agent
    const result = await run(agent, [
      { role: 'user', content: userQuery }
    ]);

    // Extract response
    const response = extractResponseText(result);
    const toolCalls = countToolCalls(result);

    return {
      success: true,
      response,
      toolCalls
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
```

## Common Mistakes to Avoid

1. **DON'T** pass `temperature` to Agent constructor
2. **DON'T** use `{ messages: [...] }` format with run()
3. **DON'T** try to access `result.messages` (doesn't exist)
4. **DON'T** use `.optional()` without `.nullable()` in Zod schemas
5. **DON'T** access `state.modelResponses` (use `state._modelResponses`)

## TypeScript Types

For better type safety, consider using these helper types:

```typescript
import { RunResult, Agent } from '@openai/agents';

type AgentResponse = {
  success: boolean;
  response?: string;
  toolCalls?: number;
  error?: string;
};

async function runAgent(
  agent: Agent<any, any>,
  query: string
): Promise<AgentResponse> {
  // Implementation
}
```