import { createApp } from './app';
import { initializeDatabase } from './services/db';

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await initializeDatabase();
    const app = createApp();
    app.listen(PORT, () => {
      console.log(`⚔️ Before That Resolves server running on port ${PORT}`);
      console.log(`📚 Ready to learn OpenAI Agents SDK!`);
    });
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

start();
