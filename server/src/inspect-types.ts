// Inspect the actual types and structure of @openai/agents v0.1.3
import { Agent, run, RunResult } from '@openai/agents';
import * as dotenv from 'dotenv';

dotenv.config();

async function inspectTypes() {
  const testAgent = new Agent({
    name: 'Inspector',
    model: 'gpt-4o',
    instructions: 'You are a helpful assistant.'
  });

  console.log('Running a simple query to inspect the result structure...\n');

  const result = await run(testAgent, 'Say hello');

  console.log('Result type:', typeof result);
  console.log('Result constructor:', result.constructor.name);
  console.log('\nTop-level keys:', Object.keys(result));

  // Check each property type
  for (const key of Object.keys(result)) {
    const value = (result as any)[key];
    const valueType = Array.isArray(value)
      ? `Array[${value.length}]`
      : value === null
      ? 'null'
      : typeof value;
    console.log(`  ${key}: ${valueType}`);
  }

  // Inspect output array in detail
  if ('output' in result && Array.isArray(result.output)) {
    console.log('\nOutput array details:');
    result.output.forEach((item: any, index: number) => {
      console.log(`\n  Output[${index}]:`);
      console.log('    Type:', item.type);
      console.log('    Keys:', Object.keys(item));

      // Check if it's a message type
      if (item.type === 'message') {
        console.log('    Role:', item.role);
        console.log('    Content type:', typeof item.content);

        if (Array.isArray(item.content)) {
          console.log('    Content items:', item.content.length);
          item.content.forEach((contentItem: any, cIndex: number) => {
            console.log(`      Content[${cIndex}]:`, {
              type: contentItem.type,
              hasText: 'text' in contentItem,
              text: contentItem.text ? contentItem.text.substring(0, 50) + '...' : undefined
            });
          });
        }
      }
    });
  }

  // Inspect state structure
  if ('state' in result && result.state) {
    console.log('\nState structure:');
    console.log('  Keys:', Object.keys(result.state));

    // Check for model responses
    const state = result.state as any;
    if ('_modelResponses' in state) {
      console.log('  Has _modelResponses:', Array.isArray(state._modelResponses));
      if (Array.isArray(state._modelResponses)) {
        console.log('  _modelResponses count:', state._modelResponses.length);
      }
    }
    if ('modelResponses' in state) {
      console.log('  Has modelResponses:', Array.isArray(state.modelResponses));
    }
  }

  // Try to get the actual message text using a helper function
  console.log('\nExtracted message text:');
  const extractedText = extractMessageText(result);
  console.log('  ', extractedText);

  return result;
}

function extractMessageText(result: RunResult<any, any>): string {
  // Type-safe extraction
  if (!result.output || !Array.isArray(result.output)) {
    return 'No output';
  }

  // Find the last message output
  for (let i = result.output.length - 1; i >= 0; i--) {
    const item = result.output[i];

    // Check if it's a message output item
    if (item && 'type' in item && item.type === 'message') {
      // Use any type to avoid type issues
      const messageItem = item as any;

      // Access content through the message item
      if ('content' in messageItem) {
        const content = messageItem.content;

        if (Array.isArray(content)) {
          // Extract text from content items
          const texts = content
            .filter((c: any) => c.type === 'output_text' || c.type === 'text')
            .map((c: any) => c.text || '');
          return texts.join('\n');
        } else if (typeof content === 'string') {
          return content;
        }
      }
    }
  }

  return 'No message found';
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('Please set OPENAI_API_KEY in .env file');
    process.exit(1);
  }

  await inspectTypes();
}

main().catch(console.error);