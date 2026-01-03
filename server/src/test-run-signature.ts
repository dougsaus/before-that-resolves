// Test to understand the correct run() signature in @openai/agents v0.1.3
import { Agent, run } from '@openai/agents';
import * as dotenv from 'dotenv';

dotenv.config();

type UnknownRecord = Record<string, unknown>;

// Create a simple test agent
const testAgent = new Agent({
  name: 'Test Agent',
  model: 'gpt-4o',
  instructions: 'You are a helpful assistant.'
});

async function testRunSignatures() {
  console.log('Testing different run() signatures...\n');

  try {
    // Test 1: Simple string input
    console.log('Test 1: String input');
    const result1 = await run(testAgent, 'Hello, how are you?');
    console.log('Success! Result type:', typeof result1);
    console.log('Result keys:', Object.keys(result1));

    // Check the structure of the result
    if (result1) {
      console.log('Full result structure:');
      console.log(JSON.stringify(result1, null, 2).substring(0, 500) + '...\n');
    }

    // Test 2: Array format (based on error message mentioning AgentInputItem[])
    console.log('Test 2: Array input');
    const result2 = await run(testAgent, [
      { role: 'user', content: 'What is 2+2?' }
    ]);
    console.log('Success! Result keys:', Object.keys(result2));

    // Test 3: Check what properties the result has
    console.log('\nAnalyzing result structure:');
    console.log('- Has messages?', 'messages' in result2);
    console.log('- Has output?', 'output' in result2);
    console.log('- Has items?', 'items' in result2);
    console.log('- Has response?', 'response' in result2);

    // List all properties
    console.log('\nAll result properties:');
    for (const key in result2) {
      const value = (result2 as UnknownRecord)[key];
      const valueType = Array.isArray(value) ? `array[${value.length}]` : typeof value;
      console.log(`  ${key}: ${valueType}`);
    }

    // Try to get the actual response text
    if ('output' in result2 && Array.isArray(result2.output)) {
      console.log('\nOutput array contents:');
      result2.output.forEach((item: unknown, index: number) => {
        console.log(`  [${index}]:`, item);
      });
    }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', message);
    console.error('Full error:', error);
  }
}

// Check Agent constructor properties
async function testAgentConstructor() {
  console.log('\n\nTesting Agent constructor properties...\n');

  try {
    // Test what properties are valid
    new Agent({
      name: 'Test',
      model: 'gpt-4o',
      instructions: 'You are helpful.',
      tools: []
    });
    console.log('Basic properties work: name, model, instructions, tools');

    // The TypeScript error suggests temperature is not valid
    // Let's see what other properties might be available

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', message);
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('Please set OPENAI_API_KEY in .env file');
    process.exit(1);
  }

  await testRunSignatures();
  await testAgentConstructor();
}

main().catch(console.error);
