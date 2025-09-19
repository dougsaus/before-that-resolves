/**
 * Helper functions for @openai/agents v0.1.3
 *
 * These utilities help extract data from the RunResult structure
 */

import { RunResult } from '@openai/agents';

/**
 * Extract the text response from a RunResult
 * @param result The result from run() function
 * @returns The extracted text response or empty string
 */
export function extractResponseText(result: RunResult<any, any>): string {
  // The output property is available via getter
  if (!result.output || !Array.isArray(result.output)) {
    return '';
  }

  // Find the last message in the output
  for (let i = result.output.length - 1; i >= 0; i--) {
    const item = result.output[i] as any;

    // Check if it's a message type output
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

/**
 * Count the number of tool calls made during the run
 * @param result The result from run() function
 * @returns Number of tool calls made
 */
export function countToolCalls(result: RunResult<any, any>): number {
  // Primary method: Count from newItems (most accurate)
  if (result.newItems && Array.isArray(result.newItems)) {
    const toolCallCount = result.newItems.filter(
      (item: any) => item.type === 'tool_call_item'
    ).length;

    if (toolCallCount > 0) {
      return toolCallCount;
    }
  }

  // Fallback: Count from rawResponses
  if (result.rawResponses && Array.isArray(result.rawResponses)) {
    return result.rawResponses.reduce((count: number, response: any) => {
      if (response.toolCalls && Array.isArray(response.toolCalls)) {
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
export function getToolCallDetails(result: RunResult<any, any>): Array<{
  name: string;
  arguments: any;
  result?: any;
  callId?: string;
  status?: string;
}> {
  const toolCalls: any[] = [];

  // Primary method: Extract from newItems (most reliable in v0.1.3)
  if (result.newItems && Array.isArray(result.newItems)) {
    // Get tool call items and their corresponding outputs
    const toolCallItems = result.newItems.filter(
      (item: any) => item.type === 'tool_call_item'
    );

    const toolOutputItems = result.newItems.filter(
      (item: any) => item.type === 'tool_call_output_item'
    );

    // Match calls with their outputs using callId
    toolCallItems.forEach((callItem: any) => {
      const callId = callItem.rawItem?.callId;
      const outputItem = toolOutputItems.find(
        (out: any) => out.rawItem?.callId === callId
      ) as any; // Type assertion to bypass strict typing

      // Parse arguments if they're a JSON string
      let parsedArguments = callItem.rawItem?.arguments;
      if (typeof parsedArguments === 'string') {
        try {
          parsedArguments = JSON.parse(parsedArguments);
        } catch (e) {
          // Keep as string if parsing fails
        }
      }

      // Extract the result - it might be in different places depending on the structure
      let result = undefined;
      if (outputItem) {
        result = outputItem.rawItem?.output ||
                 outputItem.rawItem?.result ||
                 outputItem.output ||
                 outputItem.rawItem;
      }

      toolCalls.push({
        name: callItem.rawItem?.name || 'unknown',
        arguments: parsedArguments || {},
        result: result,
        callId: callId,
        status: callItem.rawItem?.status || 'completed',
      });
    });

    // If we found tool calls, return them
    if (toolCalls.length > 0) {
      return toolCalls;
    }
  }

  // Fallback method: Extract from rawResponses (doesn't include results)
  if (result.rawResponses && Array.isArray(result.rawResponses)) {
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
            // Note: Results are not available in rawResponses
            callId: tc.id,
            status: tc.status || 'unknown',
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
export function isSuccessful(result: RunResult<any, any>): boolean {
  // Check if we have output and it's not empty
  return !!(result.output &&
           Array.isArray(result.output) &&
           result.output.length > 0 &&
           extractResponseText(result));
}