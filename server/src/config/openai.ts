import { OpenAI } from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * OpenAI Client Configuration
 *
 * LEARNING POINT: The @openai/agents SDK uses the standard OpenAI client
 * You need to configure it with your API key
 */

// Validate API key exists
if (!process.env.OPENAI_API_KEY) {
  console.error('⚠️  OPENAI_API_KEY not found in environment variables!');
  console.error('   Please create a .env file with your OpenAI API key');
  console.error('   Copy .env.example to .env and add your key');
}

// Create and export the OpenAI client
export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  // You can adjust these defaults
  maxRetries: 3,
  timeout: 30000, // 30 seconds
});

// Export configuration values
export const openaiConfig = {
  model: process.env.OPENAI_MODEL || 'gpt-4o',
  maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000'),
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
};

// Set the OpenAI API key globally for @openai/agents SDK
// This ensures the SDK can access the API key
if (process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
}