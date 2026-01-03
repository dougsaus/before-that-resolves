/**
 * Test script for Lesson 1: Card Oracle Agent
 *
 * Run this with: npx ts-node src/test-agent.ts
 *
 * This will test your agent without needing the full server
 */

import dotenv from 'dotenv';
import { executeCardOracle } from './agents/card-oracle';

// Load environment variables
dotenv.config();

// Test queries to try
const testQueries = [
  "What is Lightning Bolt?",
  "Can Atraxa be my commander?",
  "Find blue instant spells",
  "What are the rulings for Thassa's Oracle?",
  "Is Sol Ring legal in Commander?"
];

async function testCardOracle() {
  console.log('🧪 Testing Card Oracle Agent\n');
  console.log('=' .repeat(50));

  // Check for API key
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    console.error('❌ ERROR: OPENAI_API_KEY not found!');
    console.error('   Please create a .env file with your OpenAI API key');
    console.error('   Copy .env.example to .env and add your key');
    process.exit(1);
  }

  // Test each query
  for (const query of testQueries) {
    console.log(`\n📝 Query: "${query}"`);
    console.log('-'.repeat(40));

    try {
      const result = await executeCardOracle(query, false, undefined, undefined, undefined, undefined, openAiKey);

      if (result.success) {
        console.log('✅ Success!');
        console.log(`Tool calls made: ${result.toolCalls || 0}`);
        console.log('\nResponse:');
        console.log(result.response);
      } else {
        console.log('❌ Failed:', result.error);
      }
    } catch (error: any) {
      console.log('❌ Error:', error.message);
    }

    console.log('\n' + '='.repeat(50));
  }
}

// Run the test
testCardOracle().catch(console.error);
