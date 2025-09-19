import { CardOracleTest } from './components/CardOracleTest';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4">
            ⚔️ Before That Resolves
          </h1>
          <p className="text-xl text-gray-300">
            Commander/EDH Deck Builder & Strategy Assistant
          </p>
          <div className="mt-4 text-sm text-gray-400">
            🎓 Lesson 1: Card Oracle Agent
          </div>
        </header>

        <main>
          <CardOracleTest />
        </main>
      </div>
    </div>
  );
}

export default App;