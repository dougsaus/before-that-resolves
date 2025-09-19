/**
 * Test script to understand the RunResult structure in @openai/agents v0.1.3
 *
 * This script will help us explore what properties are actually available
 * on the RunResult object and how to correctly access tool call information.
 */

import dotenv from 'dotenv';
import { Agent, run } from '@openai/agents';
import { z } from 'zod';
import { openaiConfig } from './config/openai';

// Load environment variables
dotenv.config();

// Create a simple test tool that we can track
const testTool = {
  name: 'test_tool',
  description: 'A test tool that returns a simple message',
  parameters: z.object({
    message: z.string().describe('The message to echo'),
    count: z.number().optional().default(1),
  }),
  function: async ({ message, count }: { message: string; count: number }) => {
    console.log(`🔧 Tool Called: test_tool(message="${message}", count=${count})`);
    const result = {
      echo: message.repeat(count),
      timestamp: new Date().toISOString(),
      toolName: 'test_tool',
    };
    console.log('🔧 Tool Result:', result);
    return result;
  },
};

// Create another tool to test multiple tool calls
const mathTool = {
  name: 'math_operation',
  description: 'Performs basic math operations',
  parameters: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number(),
  }),
  function: async ({ operation, a, b }: { operation: string; a: number; b: number }) => {
    console.log(`🧮 Tool Called: math_operation(${operation}, ${a}, ${b})`);
    let result: number;
    switch (operation) {
      case 'add': result = a + b; break;
      case 'subtract': result = a - b; break;
      case 'multiply': result = a * b; break;
      case 'divide': result = b !== 0 ? a / b : NaN; break;
      default: result = NaN;
    }
    console.log('🧮 Tool Result:', result);
    return { result, operation, inputs: { a, b } };
  },
};

// Create a test agent
const testAgent = new Agent({
  name: 'Test Agent',
  model: openaiConfig.model || 'gpt-4o',
  instructions: `You are a test agent. When asked to test tools, use the available tools.
  For test_tool: call it with various messages.
  For math_operation: perform the requested calculations.
  Always use tools when asked, don't just describe what you would do.`,
  tools: [testTool, mathTool],
});

async function exploreRunResult() {
  console.log('🔍 Exploring RunResult Structure\n');
  console.log('='.repeat(60));

  // Test queries that should trigger tool use
  const testQueries = [
    "Use the test_tool to echo 'Hello World' 3 times",
    "Calculate 42 + 17 using the math tool, then multiply the result by 2",
  ];

  for (const query of testQueries) {
    console.log(`\n📝 Query: "${query}"`);
    console.log('-'.repeat(50));

    try {
      const result = await run(testAgent, [{ role: 'user', content: query }]);

      console.log('\n📊 RunResult Properties:');
      console.log('------------------------');

      // Check direct properties
      console.log('✅ result.output exists:', result.output !== undefined);
      console.log('✅ result.output type:', Array.isArray(result.output) ? 'array' : typeof result.output);
      console.log('✅ result.output length:', Array.isArray(result.output) ? result.output.length : 'N/A');

      console.log('✅ result.newItems exists:', result.newItems !== undefined);
      console.log('✅ result.newItems type:', Array.isArray(result.newItems) ? 'array' : typeof result.newItems);
      console.log('✅ result.newItems length:', Array.isArray(result.newItems) ? result.newItems.length : 'N/A');

      console.log('✅ result.rawResponses exists:', result.rawResponses !== undefined);
      console.log('✅ result.rawResponses length:', Array.isArray(result.rawResponses) ? result.rawResponses.length : 'N/A');

      console.log('✅ result.state exists:', result.state !== undefined);
      console.log('✅ result.history exists:', result.history !== undefined);
      console.log('✅ result.input exists:', result.input !== undefined);

      // Explore newItems structure
      if (result.newItems && Array.isArray(result.newItems)) {
        console.log('\n📦 NewItems Analysis:');
        result.newItems.forEach((item: any, index: number) => {
          console.log(`  Item ${index}:`);
          console.log(`    - Type: ${item.type}`);
          console.log(`    - Has rawItem: ${item.rawItem !== undefined}`);
          if (item.type === 'tool_call_item' && item.rawItem) {
            console.log(`    - Tool Call Details:`);
            console.log(`      • Name: ${item.rawItem.name}`);
            console.log(`      • Arguments: ${item.rawItem.arguments}`);
            console.log(`      • Call ID: ${item.rawItem.callId}`);
            console.log(`      • Status: ${item.rawItem.status}`);
          }
          if (item.type === 'tool_call_output_item') {
            console.log(`    - Tool Output Details:`);
            console.log(`      • Has output: ${item.output !== undefined}`);
            console.log(`      • Output:`, item.output);
          }
        });
      }

      // Explore rawResponses structure
      if (result.rawResponses && Array.isArray(result.rawResponses)) {
        console.log('\n🔄 RawResponses Analysis:');
        result.rawResponses.forEach((response: any, index: number) => {
          console.log(`  Response ${index}:`);
          console.log(`    - Has toolCalls: ${response.toolCalls !== undefined}`);
          if (response.toolCalls && Array.isArray(response.toolCalls)) {
            console.log(`    - Tool Calls Count: ${response.toolCalls.length}`);
            response.toolCalls.forEach((tc: any, tcIndex: number) => {
              console.log(`      Tool Call ${tcIndex}:`);
              console.log(`        • Type: ${tc.type}`);
              console.log(`        • Function Name: ${tc.function?.name}`);
              console.log(`        • Function Arguments:`, tc.function?.arguments);
              console.log(`        • ID: ${tc.id}`);
            });
          }
        });
      }

      // Explore state structure (carefully)
      const state = result.state as any;
      if (state) {
        console.log('\n🔍 State Properties:');
        console.log(`  - _currentTurn: ${state._currentTurn}`);
        console.log(`  - _currentAgent: ${state._currentAgent?.name}`);
        console.log(`  - _modelResponses exists: ${state._modelResponses !== undefined}`);
        console.log(`  - _modelResponses length: ${Array.isArray(state._modelResponses) ? state._modelResponses.length : 'N/A'}`);
        console.log(`  - _generatedItems exists: ${state._generatedItems !== undefined}`);
        console.log(`  - _generatedItems length: ${Array.isArray(state._generatedItems) ? state._generatedItems.length : 'N/A'}`);

        // Check if _modelResponses has tool calls
        if (state._modelResponses && Array.isArray(state._modelResponses)) {
          console.log('\n📋 State._modelResponses Tool Calls:');
          state._modelResponses.forEach((mr: any, index: number) => {
            if (mr.toolCalls && mr.toolCalls.length > 0) {
              console.log(`  ModelResponse ${index} has ${mr.toolCalls.length} tool calls`);
            }
          });
        }
      }

      // Create improved tool extraction function based on findings
      console.log('\n✨ Extracted Tool Calls (Improved Method):');
      const toolCalls = extractToolCalls(result);
      console.log(JSON.stringify(toolCalls, null, 2));

    } catch (error: any) {
      console.error('❌ Error:', error.message);
    }

    console.log('\n' + '='.repeat(60));
  }
}

/**
 * Improved tool call extraction based on actual RunResult structure
 */
function extractToolCalls(result: any): Array<{
  name: string;
  arguments: any;
  result?: any;
  callId?: string;
  status?: string;
}> {
  const toolCalls: any[] = [];

  // Method 1: Extract from newItems (most reliable)
  if (result.newItems && Array.isArray(result.newItems)) {
    const toolCallItems = result.newItems.filter((item: any) => item.type === 'tool_call_item');
    const toolOutputItems = result.newItems.filter((item: any) => item.type === 'tool_call_output_item');

    toolCallItems.forEach((callItem: any) => {
      const callId = callItem.rawItem?.callId;
      const outputItem = toolOutputItems.find((out: any) =>
        out.rawItem?.callId === callId
      );

      toolCalls.push({
        name: callItem.rawItem?.name || 'unknown',
        arguments: typeof callItem.rawItem?.arguments === 'string'
          ? JSON.parse(callItem.rawItem.arguments)
          : callItem.rawItem?.arguments || {},
        result: outputItem?.output || outputItem?.rawItem?.output,
        callId: callId,
        status: callItem.rawItem?.status,
      });
    });
  }

  // Method 2: Fallback to rawResponses if needed
  if (toolCalls.length === 0 && result.rawResponses && Array.isArray(result.rawResponses)) {
    result.rawResponses.forEach((response: any) => {
      if (response.toolCalls && Array.isArray(response.toolCalls)) {
        response.toolCalls.forEach((tc: any) => {
          toolCalls.push({
            name: tc.function?.name || tc.name || 'unknown',
            arguments: typeof tc.function?.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : tc.function?.arguments || {},
            callId: tc.id,
            status: tc.status,
          });
        });
      }
    });
  }

  return toolCalls;
}

// Run the exploration
exploreRunResult().catch(console.error);