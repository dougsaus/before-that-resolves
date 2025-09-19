import { CardOracle } from './components/CardOracle';
import { DevModeProvider } from './contexts/DevModeContext';
import { DevPanel } from './components/DevPanel';

function App() {
  return (
    <DevModeProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
        <div className="container mx-auto px-4 py-8 pb-20">
          <header className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4">
              ⚔️ Before That Resolves
            </h1>
            <p className="text-xl text-gray-300">
              Commander/EDH Deck Builder & Strategy Assistant
            </p>
          </header>

          <main>
            <CardOracle />
          </main>
        </div>
        <DevPanel />
      </div>
    </DevModeProvider>
  );
}

export default App;