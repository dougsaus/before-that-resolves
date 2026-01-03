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

// Export configuration values
export const openaiConfig = {
  model: process.env.OPENAI_MODEL || 'gpt-4o',
  maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000'),
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
};

export function getEnvOpenAIKey(): string | undefined {
  return process.env.OPENAI_API_KEY;
}
