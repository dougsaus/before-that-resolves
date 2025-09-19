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
  // Access the private _modelResponses property via state
  const state = result.state as any;

  if (!state || !state._modelResponses || !Array.isArray(state._modelResponses)) {
    return 0;
  }

  // Count tool calls across all model responses
  return state._modelResponses
    .filter((r: any) => r.toolCalls && r.toolCalls.length > 0)
    .reduce((count: number, r: any) => count + (r.toolCalls?.length || 0), 0);
}

/**
 * Get all tool call details from a run
 * @param result The result from run() function
 * @returns Array of tool call details
 */
export function getToolCallDetails(result: RunResult<any, any>): Array<{
  name: string;
  arguments: any;
  result?: any;
}> {
  const state = result.state as any;
  const toolCalls: any[] = [];

  if (!state || !state._modelResponses || !Array.isArray(state._modelResponses)) {
    return toolCalls;
  }

  // Extract tool calls from model responses
  state._modelResponses.forEach((response: any) => {
    if (response.toolCalls && Array.isArray(response.toolCalls)) {
      response.toolCalls.forEach((call: any) => {
        toolCalls.push({
          name: call.function?.name || 'unknown',
          arguments: call.function?.arguments || {},
          result: call.result
        });
      });
    }
  });

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