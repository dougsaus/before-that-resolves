import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

function loadEnvFromNearest(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  dotenv.config();
  return null;
}

const envPath = loadEnvFromNearest();
if (process.env.NODE_ENV !== 'production' && envPath) {
  console.log(`✅ Loaded environment from ${envPath}`);
}

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
} else if (process.env.NODE_ENV !== 'production') {
  const keyTail = process.env.OPENAI_API_KEY.slice(-4);
  console.log(`🔑 OPENAI_API_KEY loaded (…${keyTail})`);
}

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
