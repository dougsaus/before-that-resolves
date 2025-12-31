import { CardOracle } from './components/CardOracle';
import { DevModeProvider } from './contexts/DevModeContext';
import { DevPanel } from './components/DevPanel';

function App() {
  return (
    <DevModeProvider>
      <div className="h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white flex flex-col overflow-hidden">
        <div className="w-full max-w-none px-6 py-6 flex-1 flex flex-col min-h-0 overflow-hidden">
          <header className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4">
              ⚔️ Before That Resolves
            </h1>
            <p className="text-xl text-gray-300">
              Commander/EDH Deck Builder & Strategy Assistant
            </p>
          </header>

          <main className="flex justify-center flex-1 min-h-0 overflow-hidden">
            <CardOracle />
          </main>
        </div>
        <DevPanel />
      </div>
    </DevModeProvider>
  );
}

export default App;
