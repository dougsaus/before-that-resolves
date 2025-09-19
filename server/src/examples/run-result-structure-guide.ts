/**
 * Complete Guide to RunResult Structure in @openai/agents v0.1.3
 *
 * This file documents the correct way to access tool call information
 * and other properties from the RunResult object.
 */

import { RunResult, Agent, run } from '@openai/agents';

/**
 * RUNRESULT STRUCTURE IN @openai/agents v0.1.3
 *
 * The RunResult object provides access to the complete execution details
 * of an agent run. Here are the key properties:
 */

interface RunResultStructure {
  // ===== PRIMARY PROPERTIES (Use These) =====

  /**
   * Array of output items that can be used as input for the next agent run.
   * Contains messages, tool results, etc. in the protocol format.
   */
  output: AgentOutputItem[];

  /**
   * Array of RunItem objects that include metadata about the agent execution.
   * This is where you find tool call details with full context.
   */
  newItems: RunItem[];

  /**
   * Raw responses from the LLM model.
   * Contains the original model responses including tool call requests.
   */
  rawResponses: ModelResponse[];

  /**
   * Combined history: original input + new output items.
   * Use this as input for continuing the conversation.
   */
  history: AgentInputItem[];

  /**
   * The original input that was provided to run().
   */
  input: string | AgentInputItem[];

  /**
   * The internal state object (use carefully - implementation details).
   */
  state: RunState<any, any>;

  /**
   * Last response ID from the model.
   */
  lastResponseId: string | undefined;

  /**
   * The last agent that was run.
   */
  lastAgent: Agent | undefined;

  /**
   * Final parsed output if outputType was specified.
   */
  finalOutput?: any;

  /**
   * Any tool approval interruptions that occurred.
   */
  interruptions?: RunToolApprovalItem[];
}

/**
 * CORRECT WAY TO ACCESS TOOL CALLS - Method 1: Using newItems (Recommended)
 *
 * The newItems array contains RunItem objects of different types:
 * - 'message_output_item': Assistant messages
 * - 'tool_call_item': Tool invocation requests
 * - 'tool_call_output_item': Tool execution results
 * - 'handoff_call_item': Agent handoff requests
 * - 'handoff_output_item': Agent handoff results
 */
export function getToolCallsFromNewItems(result: RunResult<any, any>): Array<{
  name: string;
  arguments: any;
  result?: any;
  callId?: string;
  status?: string;
}> {
  const toolCalls: any[] = [];

  if (!result.newItems || !Array.isArray(result.newItems)) {
    return toolCalls;
  }

  // Filter for tool call items
  const toolCallItems = result.newItems.filter(
    (item: any) => item.type === 'tool_call_item'
  );

  const toolOutputItems = result.newItems.filter(
    (item: any) => item.type === 'tool_call_output_item'
  );

  // Match calls with their outputs
  toolCallItems.forEach((callItem: any) => {
    const callId = callItem.rawItem?.callId;
    const outputItem = toolOutputItems.find(
      (out: any) => out.rawItem?.callId === callId
    );

    // Parse arguments if they're a JSON string
    let parsedArguments = callItem.rawItem?.arguments;
    if (typeof parsedArguments === 'string') {
      try {
        parsedArguments = JSON.parse(parsedArguments);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }

    toolCalls.push({
      name: callItem.rawItem?.name || 'unknown',
      arguments: parsedArguments || {},
      result: outputItem?.output,
      callId: callId,
      status: callItem.rawItem?.status || 'completed',
    });
  });

  return toolCalls;
}

/**
 * CORRECT WAY TO ACCESS TOOL CALLS - Method 2: Using rawResponses
 *
 * The rawResponses array contains the direct model responses,
 * which include tool call requests in the OpenAI format.
 */
export function getToolCallsFromRawResponses(result: RunResult<any, any>): Array<{
  name: string;
  arguments: any;
  callId?: string;
}> {
  const toolCalls: any[] = [];

  if (!result.rawResponses || !Array.isArray(result.rawResponses)) {
    return toolCalls;
  }

  result.rawResponses.forEach((response: any) => {
    if (response.toolCalls && Array.isArray(response.toolCalls)) {
      response.toolCalls.forEach((tc: any) => {
        let parsedArguments = tc.function?.arguments;
        if (typeof parsedArguments === 'string') {
          try {
            parsedArguments = JSON.parse(parsedArguments);
          } catch (e) {
            // Keep as string if parsing fails
          }
        }

        toolCalls.push({
          name: tc.function?.name || tc.name || 'unknown',
          arguments: parsedArguments || {},
          callId: tc.id,
        });
      });
    }
  });

  return toolCalls;
}

/**
 * COMPREHENSIVE TOOL CALL EXTRACTION
 *
 * This function combines both methods to provide the most complete
 * tool call information, including both the requests and their results.
 */
export function extractAllToolCallDetails(result: RunResult<any, any>): {
  toolCalls: Array<{
    name: string;
    arguments: any;
    result?: any;
    callId?: string;
    status?: string;
  }>;
  totalCount: number;
  hasToolCalls: boolean;
} {
  // Try Method 1 first (includes results)
  let toolCalls = getToolCallsFromNewItems(result);

  // Fallback to Method 2 if no tool calls found
  if (toolCalls.length === 0) {
    const rawToolCalls = getToolCallsFromRawResponses(result);
    toolCalls = rawToolCalls.map(tc => ({
      ...tc,
      status: 'unknown',
    }));
  }

  return {
    toolCalls,
    totalCount: toolCalls.length,
    hasToolCalls: toolCalls.length > 0,
  };
}

/**
 * EXTRACT TEXT RESPONSE
 *
 * Gets the assistant's text response from the result.
 */
export function extractTextResponse(result: RunResult<any, any>): string {
  if (!result.output || !Array.isArray(result.output)) {
    return '';
  }

  // Look for the last assistant message
  for (let i = result.output.length - 1; i >= 0; i--) {
    const item = result.output[i] as any;

    if (item?.type === 'message' && item?.role === 'assistant') {
      // Handle content array
      if (Array.isArray(item.content)) {
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

/**
 * COMPLETE ANALYSIS FUNCTION
 *
 * Provides a comprehensive analysis of the RunResult.
 */
export function analyzeRunResult(result: RunResult<any, any>): {
  response: string;
  toolCalls: Array<{
    name: string;
    arguments: any;
    result?: any;
  }>;
  metrics: {
    totalTurns: number;
    toolCallCount: number;
    messageCount: number;
    hasErrors: boolean;
  };
} {
  const toolCallDetails = extractAllToolCallDetails(result);
  const response = extractTextResponse(result);

  const state = result.state as any;

  return {
    response,
    toolCalls: toolCallDetails.toolCalls,
    metrics: {
      totalTurns: state?._currentTurn || 0,
      toolCallCount: toolCallDetails.totalCount,
      messageCount: result.newItems?.length || 0,
      hasErrors: false, // You can implement error detection logic
    },
  };
}

/**
 * FIXED VERSION OF YOUR ORIGINAL FUNCTION
 *
 * The issue with your original function was that it was trying to access
 * state._modelResponses which may not have the tool call results attached.
 * Here's the corrected version:
 */
export function getToolCallDetails(result: RunResult<any, any>): Array<{
  name: string;
  arguments: any;
  result?: any;
}> {
  const toolCalls: any[] = [];

  // First, try to get from newItems (most reliable)
  if (result.newItems && Array.isArray(result.newItems)) {
    const toolCallItems = result.newItems.filter(
      (item: any) => item.type === 'tool_call_item'
    );

    const toolOutputItems = result.newItems.filter(
      (item: any) => item.type === 'tool_call_output_item'
    );

    toolCallItems.forEach((callItem: any) => {
      const callId = callItem.rawItem?.callId;
      const outputItem = toolOutputItems.find(
        (out: any) => out.rawItem?.callId === callId
      );

      let args = callItem.rawItem?.arguments;
      if (typeof args === 'string') {
        try {
          args = JSON.parse(args);
        } catch (e) {
          // Keep as string
        }
      }

      toolCalls.push({
        name: callItem.rawItem?.name || 'unknown',
        arguments: args || {},
        result: outputItem?.output,
      });
    });

    if (toolCalls.length > 0) {
      return toolCalls;
    }
  }

  // Fallback: Try rawResponses
  if (result.rawResponses && Array.isArray(result.rawResponses)) {
    result.rawResponses.forEach((response: any) => {
      if (response.toolCalls && Array.isArray(response.toolCalls)) {
        response.toolCalls.forEach((tc: any) => {
          let args = tc.function?.arguments;
          if (typeof args === 'string') {
            try {
              args = JSON.parse(args);
            } catch (e) {
              // Keep as string
            }
          }

          toolCalls.push({
            name: tc.function?.name || 'unknown',
            arguments: args || {},
            // Note: Results are not available in rawResponses
          });
        });
      }
    });
  }

  return toolCalls;
}

/**
 * USAGE EXAMPLE
 */
export async function exampleUsage() {
  const agent = new Agent({
    name: 'Example Agent',
    model: 'gpt-4o',
    instructions: 'You are a helpful assistant.',
    tools: [
      // ... your tools here
    ],
  });

  const result = await run(agent, [
    { role: 'user', content: 'Please help me with something' }
  ]);

  // Get comprehensive analysis
  const analysis = analyzeRunResult(result);

  console.log('Response:', analysis.response);
  console.log('Tool Calls:', analysis.toolCalls);
  console.log('Metrics:', analysis.metrics);

  // Or get just tool calls
  const toolCalls = getToolCallDetails(result);
  console.log('Tool calls made:', toolCalls);
}

/**
 * KEY INSIGHTS FOR @openai/agents v0.1.3:
 *
 * 1. RunResult.newItems is the most reliable source for tool call information
 *    - Contains both tool_call_item and tool_call_output_item objects
 *    - Provides complete context including the agent that made the call
 *
 * 2. RunResult.rawResponses contains the raw model responses
 *    - Has tool call requests but not the execution results
 *    - Useful as a fallback or for debugging
 *
 * 3. RunResult.state._modelResponses exists but shouldn't be relied upon
 *    - It's an internal implementation detail
 *    - The structure may change in future versions
 *
 * 4. Tool call arguments are often JSON strings that need parsing
 *    - Always check if arguments are strings before parsing
 *    - Handle JSON parse errors gracefully
 *
 * 5. Match tool calls with their results using callId
 *    - Both tool_call_item and tool_call_output_item have matching callIds
 *    - This allows you to correlate requests with responses
 */