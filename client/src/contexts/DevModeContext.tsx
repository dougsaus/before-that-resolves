import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface DevModeContextType {
  isDevMode: boolean;
  toggleDevMode: () => void;
  agentMetadata: AgentMetadata | null;
  setAgentMetadata: (metadata: AgentMetadata | null) => void;
}

interface AgentMetadata {
  toolCalls: Array<{
    name: string;
    arguments: any;
    result?: any;
    duration?: number;
    status?: string;
  }>;
  totalDuration?: number;
  modelResponses?: number;
  tokensUsed?: number;
}

const DevModeContext = createContext<DevModeContextType | undefined>(undefined);

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [isDevMode, setIsDevMode] = useState(false);
  const [agentMetadata, setAgentMetadata] = useState<AgentMetadata | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const devParam = urlParams.get('dev') === 'true';
    const envDev = import.meta.env.VITE_DEV_MODE === 'true';

    setIsDevMode(devParam || envDev);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsDevMode(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleDevMode = () => setIsDevMode(prev => !prev);

  return (
    <DevModeContext.Provider value={{ isDevMode, toggleDevMode, agentMetadata, setAgentMetadata }}>
      {children}
    </DevModeContext.Provider>
  );
}

export function useDevMode() {
  const context = useContext(DevModeContext);
  if (context === undefined) {
    throw new Error('useDevMode must be used within a DevModeProvider');
  }
  return context;
}
