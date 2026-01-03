/**
 * Helper functions for @openai/agents v0.1.3
 *
 * These utilities help extract data from the RunResult structure
 */

import { Agent, RunResult } from '@openai/agents';

type UnknownRecord = Record<string, unknown>;
type AnyAgent = Agent<any, any>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

/**
 * Extract the text response from a RunResult
 * @param result The result from run() function
 * @returns The extracted text response or empty string
 */
export function extractResponseText<TContext, TAgent extends AnyAgent>(
  result: RunResult<TContext, TAgent>
): string {
  // The output property is available via getter
  if (!result.output || !Array.isArray(result.output)) {
    return '';
  }

  // Find the last message in the output
  for (let i = result.output.length - 1; i >= 0; i--) {
    const item = result.output[i] as unknown;

    // Check if it's a message type output
    if (isRecord(item) && item.type === 'message' && item.role === 'assistant') {
      // Handle content array structure
      if (item.content && Array.isArray(item.content)) {
        const texts = item.content
          .filter((c: unknown) => isRecord(c) && (c.type === 'output_text' || c.type === 'text'))
          .map((c: unknown) => (isRecord(c) ? c.text : '') || '');
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
 * Count the number of tool calls made during the run
 * @param result The result from run() function
 * @returns Number of tool calls made
 */
export function countToolCalls<TContext, TAgent extends AnyAgent>(
  result: RunResult<TContext, TAgent>
): number {
  // Primary method: Count from newItems (most accurate)
  if (result.newItems && Array.isArray(result.newItems)) {
    const toolCallCount = result.newItems.filter(
      (item: unknown) => isRecord(item) && item.type === 'tool_call_item'
    ).length;

    if (toolCallCount > 0) {
      return toolCallCount;
    }
  }

  // Fallback: Count from rawResponses
  if (result.rawResponses && Array.isArray(result.rawResponses)) {
    return result.rawResponses.reduce((count: number, response: unknown) => {
      if (isRecord(response) && Array.isArray(response.toolCalls)) {
        return count + response.toolCalls.length;
      }
      return count;
    }, 0);
  }

  return 0;
}

/**
 * Get all tool call details from a run
 * @param result The result from run() function
 * @returns Array of tool call details
 *
 * FIXED: This now correctly extracts tool calls from newItems which contains
 * both the tool_call_item and tool_call_output_item objects with full details.
 */
export function getToolCallDetails<TContext, TAgent extends AnyAgent>(
  result: RunResult<TContext, TAgent>
): Array<{
  name: string;
  arguments: unknown;
  result?: unknown;
  callId?: string;
  status?: string;
}> {
  const toolCalls: Array<{
    name: string;
    arguments: unknown;
    result?: unknown;
    callId?: string;
    status?: string;
  }> = [];

  // Primary method: Extract from newItems (most reliable in v0.1.3)
  if (result.newItems && Array.isArray(result.newItems)) {
    // Get tool call items and their corresponding outputs
    const toolCallItems = result.newItems.filter(
      (item: unknown) => isRecord(item) && item.type === 'tool_call_item'
    );

    const toolOutputItems = result.newItems.filter(
      (item: unknown) => isRecord(item) && item.type === 'tool_call_output_item'
    );

    // Match calls with their outputs using callId
    toolCallItems.forEach((callItem: unknown) => {
      if (!isRecord(callItem)) return;
      const rawItem = isRecord(callItem.rawItem) ? callItem.rawItem : undefined;
      const callId = rawItem?.callId as string | undefined;
      const outputItem = toolOutputItems.find(
        (out: unknown) =>
          isRecord(out) &&
          isRecord(out.rawItem) &&
          out.rawItem.callId === callId
      );

      // Parse arguments if they're a JSON string
      let parsedArguments = rawItem?.arguments;
      if (typeof parsedArguments === 'string') {
        try {
          parsedArguments = JSON.parse(parsedArguments);
        } catch {
          // Keep as string if parsing fails
        }
      }

      // Extract the result - it might be in different places depending on the structure
      let result = undefined;
      if (outputItem && isRecord(outputItem)) {
        const outputRawItem = isRecord(outputItem.rawItem) ? outputItem.rawItem : undefined;
        result = outputRawItem?.output ||
                 outputRawItem?.result ||
                 outputItem.output ||
                 outputRawItem;
      }

      toolCalls.push({
        name: (rawItem?.name as string | undefined) || 'unknown',
        arguments: parsedArguments || {},
        result: result,
        callId: callId,
        status: (rawItem?.status as string | undefined) || 'completed',
      });
    });

    // If we found tool calls, return them
    if (toolCalls.length > 0) {
      return toolCalls;
    }
  }

  // Fallback method: Extract from rawResponses (doesn't include results)
  if (result.rawResponses && Array.isArray(result.rawResponses)) {
    result.rawResponses.forEach((response: unknown) => {
      if (isRecord(response) && Array.isArray(response.toolCalls)) {
        response.toolCalls.forEach((tc: unknown) => {
          if (!isRecord(tc)) return;
          const fn = isRecord(tc.function) ? tc.function : undefined;
          let parsedArguments = fn?.arguments;
          if (typeof parsedArguments === 'string') {
            try {
              parsedArguments = JSON.parse(parsedArguments);
            } catch {
              // Keep as string if parsing fails
            }
          }

          toolCalls.push({
            name: (fn?.name as string | undefined) || (tc.name as string | undefined) || 'unknown',
            arguments: parsedArguments || {},
            // Note: Results are not available in rawResponses
            callId: tc.id as string | undefined,
            status: (tc.status as string | undefined) || 'unknown',
          });
        });
      }
    });
  }

  return toolCalls;
}

/**
 * Check if the agent run was successful
 * @param result The result from run() function
 * @returns True if successful, false otherwise
 */
export function isSuccessful<TContext, TAgent extends AnyAgent>(
  result: RunResult<TContext, TAgent>
): boolean {
  // Check if we have output and it's not empty
  return !!(result.output &&
           Array.isArray(result.output) &&
           result.output.length > 0 &&
           extractResponseText(result));
}
