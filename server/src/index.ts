import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { executeCardOracle, exampleQueries } from './agents/card-oracle-agent';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

/**
 * LESSON 1 COMPLETE!
 * This endpoint runs your Card Oracle Agent
 */
app.post('/api/agent/query', async (req, res) => {
  const { query } = req.body;

  if (!query) {
    res.status(400).json({
      success: false,
      error: 'Query is required'
    });
    return;
  }

  try {
    console.log(`\n📨 Received query: "${query}"`);

    // Execute the Card Oracle Agent
    const result = await executeCardOracle(query);

    res.json(result);
  } catch (error: any) {
    console.error('Server error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get example queries endpoint
app.get('/api/examples', (_req, res) => {
  res.json({
    examples: exampleQueries,
    description: 'Try these example queries to test the Card Oracle Agent!'
  });
});

app.listen(PORT, () => {
  console.log(`⚔️ Before That Resolves server running on port ${PORT}`);
  console.log(`📚 Ready to learn OpenAI Agents SDK!`);
});