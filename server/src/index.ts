import { createApp } from './app';

const PORT = process.env.PORT || 3001;
const app = createApp();

app.listen(PORT, () => {
  console.log(`⚔️ Before That Resolves server running on port ${PORT}`);
  console.log(`📚 Ready to learn OpenAI Agents SDK!`);
});
