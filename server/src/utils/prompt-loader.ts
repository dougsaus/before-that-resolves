import fs from 'fs';
import path from 'path';

export function loadPrompt(filename: string): string {
  const promptPath = path.resolve(process.cwd(), 'prompts', filename);
  return fs.readFileSync(promptPath, 'utf-8').trim();
}
