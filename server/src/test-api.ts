// Test file to understand @openai/agents v0.1.3 API
import * as agents from '@openai/agents';

// Log the exported functions and classes
console.log('Available exports from @openai/agents:');
console.log(Object.keys(agents));

// Try to understand the types
const { Agent, run, tool } = agents;

console.log('\nAgent constructor:', typeof Agent);
console.log('run function:', typeof run);
console.log('tool function:', typeof tool);