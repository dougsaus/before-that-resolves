import { useEffect, useRef, useState } from 'react';
import axios, { type AxiosRequestConfig } from 'axios';
import { useDevMode } from '../contexts/DevModeContext';
import { buildApiUrl } from '../utils/api';
import { RichMTGText } from './RichMTGText';
import { DeveloperInfo } from './DeveloperInfo';

const OPENAI_KEY_STORAGE_KEY = 'before-that-resolves.openai-key';
type ErrorWithResponse = {
  response?: { data?: { error?: string } };
  message?: string;
  code?: string;
  name?: string;
};

function createConversationId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `conv_${crypto.randomUUID()}`;
  }
  return `conv_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

type CardOracleProps = {
  model?: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
  modelControls?: React.ReactNode;
};

type MobilePanel = 'chat' | 'deck' | 'ai';

export function CardOracle({ model, reasoningEffort, verbosity, modelControls }: CardOracleProps) {
  const defaultDeckAnalysisOptions = {
    summary: true,
    winCons: true,
    bracket: true,
    weaknesses: true,
    cardTypeCounts: true,
    tribalCounts: true,
    categoryCounts: true,
    subtypeCounts: true,
    landTypeCounts: true
  };
  const [query, setQuery] = useState('');
  const [deckUrl, setDeckUrl] = useState('');
  const [deckAnalysisOptions, setDeckAnalysisOptions] = useState(defaultDeckAnalysisOptions);
  const [deckLoaded, setDeckLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState<'query' | 'analyze' | 'goldfish' | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showAnalyzeOptions, setShowAnalyzeOptions] = useState(false);
  const [showGoldfishOptions, setShowGoldfishOptions] = useState(false);
  const [showModelOptions, setShowModelOptions] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('chat');
  const [goldfishGames, setGoldfishGames] = useState(1);
  const [goldfishTurns, setGoldfishTurns] = useState(7);
  const [goldfishMetrics, setGoldfishMetrics] = useState({
    lands: true,
    manaAvailable: true,
    ramp: true,
    cardsSeen: true,
    commanderCast: true,
    commanderRecasts: true,
    keyEngine: true,
    winCon: true,
    interaction: true,
    mulligans: true,
    keepableHands: true,
    curveUsage: true,
    damageByTurn: true,
    lethalByTurn: true
  });
  const [interactionOptions, setInteractionOptions] = useState({
    incomingDamage: 0,
    blockRateGround: 0,
    blockRateFlying: 0,
    removalChance: 0
  });
  const [conversationId, setConversationId] = useState(createConversationId);
  const { isDevMode, setAgentMetadata } = useDevMode();
  const useOwnKey = true;
  const [openAiKey, setOpenAiKey] = useState('');
  const [saveKeyLocally, setSaveKeyLocally] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [messages, setMessages] = useState<
    Array<{ id: string; role: 'user' | 'agent' | 'error'; content: string }>
  >([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const hasApiKey = Boolean(openAiKey.trim());

  useEffect(() => {
    const storedKey = window.localStorage.getItem(OPENAI_KEY_STORAGE_KEY);
    if (storedKey) {
      setOpenAiKey(storedKey);
      setSaveKeyLocally(true);
    }
  }, []);

  useEffect(() => {
    if (!saveKeyLocally) {
      window.localStorage.removeItem(OPENAI_KEY_STORAGE_KEY);
      return;
    }
    const trimmedKey = openAiKey.trim();
    if (!trimmedKey) {
      window.localStorage.removeItem(OPENAI_KEY_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(OPENAI_KEY_STORAGE_KEY, trimmedKey);
  }, [openAiKey, saveKeyLocally]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };
    const legacyMediaQuery = mediaQuery as MediaQueryList & {
      addListener?: (handler: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (handler: (event: MediaQueryListEvent) => void) => void;
    };

    setIsMobile(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }

    legacyMediaQuery.addListener?.(handleChange);
    return () => {
      legacyMediaQuery.removeListener?.(handleChange);
    };
  }, []);

  const appendErrorMessage = (content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        role: 'error',
        content
      }
    ]);
  };

  const getApiKeyHeaders = () => {
    if (!useOwnKey) return null;
    const trimmedKey = openAiKey.trim();
    if (!trimmedKey) return null;
    return { 'x-openai-key': trimmedKey };
  };

  const postWithOptionalConfig = (
    url: string,
    data: unknown,
    config?: AxiosRequestConfig
  ) => {
    const apiKeyHeaders = getApiKeyHeaders();
    const finalConfig = apiKeyHeaders
      ? { ...config, headers: { ...(config?.headers ?? {}), ...apiKeyHeaders } }
      : config;
    if (!finalConfig || Object.keys(finalConfig).length === 0) {
      return axios.post(url, data);
    }
    return axios.post(url, data, finalConfig);
  };

  const getErrorMessage = (error: unknown, fallback: string) => {
    const maybeError = error as ErrorWithResponse;
    return maybeError?.response?.data?.error || maybeError?.message || fallback;
  };

  useEffect(() => {
    if (!isMobile || mobilePanel === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, loading, isMobile, mobilePanel]);

  const submitQuery = async (
    text: string,
    options?: { hideUserMessage?: boolean; mode?: 'query' | 'analyze' | 'goldfish' }
  ) => {
    if (!text.trim()) return;
    if (useOwnKey && !openAiKey.trim()) {
      appendErrorMessage('OpenAI API key is required.');
      return;
    }

    const controller = new AbortController();
    requestControllerRef.current = controller;
    setLoading(true);
    setLoadingMode(options?.mode ?? 'query');
    if (!options?.hideUserMessage) {
      setMessages((prev) => [
        ...prev,
        { id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`, role: 'user', content: text }
      ]);
    }

    const includeDeckUrl = options?.mode === 'analyze' || options?.mode === 'goldfish';
    const requestDeckUrl = includeDeckUrl && deckLoaded ? deckUrl.trim() : undefined;

    try {
      const result = await postWithOptionalConfig(
        buildApiUrl('/api/agent/query'),
        {
          query: text,
          devMode: isDevMode,
          conversationId,
          model,
          reasoningEffort: reasoningEffort || undefined,
          verbosity,
          ...(requestDeckUrl ? { deckUrl: requestDeckUrl } : {})
        },
        { signal: controller.signal }
      );

      if (result.data.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            role: 'agent',
            content: result.data.response
          }
        ]);
        if (result.data.conversationId) {
          setConversationId(result.data.conversationId);
        }

        if (isDevMode && result.data.metadata) {
          setAgentMetadata(result.data.metadata);
        }
      } else {
        const errorMessage = result.data.error || 'Unknown error occurred';
        appendErrorMessage(errorMessage);
      }
    } catch (err: unknown) {
      const maybeError = err as ErrorWithResponse;
      if (maybeError?.code === 'ERR_CANCELED' || maybeError?.name === 'CanceledError') {
        appendErrorMessage('Request cancelled.');
        return;
      }
      const errorMessage = getErrorMessage(err, 'Failed to connect to server');
      appendErrorMessage(errorMessage);
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
      setLoading(false);
      setLoadingMode(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = query;
    setQuery('');
    await submitQuery(text, { mode: 'query' });
  };

  const resetConversationState = async (options?: { preserveDeckUrl?: boolean }) => {
    try {
      await postWithOptionalConfig(buildApiUrl('/api/agent/reset'), {
        conversationId
      });
    } catch (resetError) {
      console.warn('Failed to reset conversation on server:', resetError);
    }

    const nextConversationId = createConversationId();
    setConversationId(nextConversationId);
    setMessages([]);
    setAgentMetadata(null);
    setDeckAnalysisOptions(defaultDeckAnalysisOptions);
    setGoldfishGames(1);
    setGoldfishTurns(7);
    setGoldfishMetrics({
      lands: true,
      manaAvailable: true,
      ramp: true,
      cardsSeen: true,
      commanderCast: true,
      commanderRecasts: true,
      keyEngine: true,
      winCon: true,
      interaction: true,
      mulligans: true,
      keepableHands: true,
      curveUsage: true,
      damageByTurn: true,
      lethalByTurn: true
    });
    setInteractionOptions({
      incomingDamage: 0,
      blockRateGround: 0,
      blockRateFlying: 0,
      removalChance: 0
    });
    setShowAnalyzeOptions(false);
    setShowGoldfishOptions(false);
    setShowModelOptions(false);
    setDeckLoaded(false);
    if (!options?.preserveDeckUrl) {
      setDeckUrl('');
    }
    return nextConversationId;
  };

  const handleLoadDeck = async () => {
    const trimmedDeckUrl = deckUrl.trim();
    if (!trimmedDeckUrl) return;
    setLoading(true);

    const nextConversationId = await resetConversationState({ preserveDeckUrl: true });

    try {
      await postWithOptionalConfig(buildApiUrl('/api/deck/cache'), {
        deckUrl: trimmedDeckUrl,
        conversationId: nextConversationId || conversationId
      });
      setDeckLoaded(true);
    } catch (cacheError: unknown) {
      appendErrorMessage(getErrorMessage(cacheError, 'Failed to cache deck'));
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeDeck = async () => {
    if (!deckUrl.trim() || !deckLoaded) return;
    const analysisSections = [
      deckAnalysisOptions.summary
        ? 'Summarize the deck providing insights like color identity, overall theme and archetypes of the deck, and how the deck should be played without getting too deep on the specifics of individual cards.'
        : null,
      deckAnalysisOptions.winCons
        ? 'Summarize the Win Conditions present in the deck and a detailed summary of the cards that enable them.'
        : null,
      deckAnalysisOptions.bracket
        ? 'Provide an assessment of what bracket the deck is likely to be along with detailed justification, going into details about specific cards and interactions when necessary.'
        : null,
      deckAnalysisOptions.weaknesses
        ? 'Find potential weaknesses of the deck and suggest ways to fix it citing specific cards to add or to cut when appropriate.'
        : null,
      deckAnalysisOptions.cardTypeCounts
        ? 'Provide counts for each card type contained in the deck: Land, Creature, Artifact, Enchantment, Instant, Sorcery, Planeswalker, Battle.'
        : null,
      deckAnalysisOptions.tribalCounts
        ? 'Provide counts of cards matching prevalent tribal types present in this deck.'
        : null,
      deckAnalysisOptions.categoryCounts
        ? 'Provide counts of cards in the following categories (analyze the card itself, not just the category provided by archidekt): Ramp, Card Draw, Tutors, Removal, Board Wipes, Counterspells, Mill, Disruption, Aggro, Finishers, Utility, Token Generator, Counters, Anthem, Stax, Mana Rocks, Mana Dorks.'
        : null,
      deckAnalysisOptions.subtypeCounts
        ? 'Provide counts of cards for each subtype: Creature subtypes, Enchantment subtypes (Aura, Saga, Curse, Shrine), Artifact subtypes (Equipment, Vehicle).'
        : null,
      deckAnalysisOptions.landTypeCounts
        ? 'Provide counts of Land subtypes (Plains, Island, Mountain, Forest, Swamp, Wastes, Non-Basic, any other subtype of land that seems reasonable).'
        : null
    ].filter(Boolean) as string[];

    const prompt =
      analysisSections.length === 0
        ? `Analyze this deck: ${deckUrl}`
        : `Analyze this Commander deck: ${deckUrl}\n\nPlease provide the following in order:\n${analysisSections
            .map((section, index) => `${index + 1}) ${section}`)
            .join('\n')}`;
    await submitQuery(prompt, { hideUserMessage: true, mode: 'analyze' });
  };

  const handleGoldfishDeck = async () => {
    if (!deckLoaded) return;
    const games = Math.min(10, Math.max(1, goldfishGames));
    const turns = Math.min(10, Math.max(1, goldfishTurns));
    const metrics = [
      goldfishMetrics.lands ? 'lands in play by turn and missed land drops' : null,
      goldfishMetrics.manaAvailable
        ? 'mana available by turn (including colored sources)'
        : null,
      goldfishMetrics.ramp ? 'ramp count by turn' : null,
      goldfishMetrics.cardsSeen ? 'cards seen by turn' : null,
      goldfishMetrics.commanderCast ? 'commander cast turn' : null,
      goldfishMetrics.commanderRecasts ? 'commander recasts and tax impact' : null,
      goldfishMetrics.keyEngine ? 'time to first key engine/piece (use best judgment)' : null,
      goldfishMetrics.winCon ? 'win-con assembled by turn' : null,
      goldfishMetrics.interaction ? 'interaction seen by turn' : null,
      goldfishMetrics.damageByTurn ? 'potential damage dealt by turn' : null,
      goldfishMetrics.lethalByTurn ? 'lethal damage achieved by turn' : null,
      goldfishMetrics.mulligans ? 'mulligan rate and average keep size' : null,
      goldfishMetrics.keepableHands
        ? 'keepable hand rate (2–4 lands, 1–2 plays heuristic)'
        : null,
      goldfishMetrics.curveUsage ? 'curve usage (percent of mana spent by turn)' : null
    ].filter(Boolean) as string[];

    const metricsText =
      metrics.length > 0 ? ` Track the following metrics: ${metrics.join(', ')}.` : '';
    const interactionDetails: string[] = [];
    if (interactionOptions.incomingDamage > 0) {
      interactionDetails.push(
        `incoming damage per turn: ${interactionOptions.incomingDamage}`
      );
    }
    if (interactionOptions.blockRateGround > 0) {
      interactionDetails.push(
        `block rate vs ground attackers: ${interactionOptions.blockRateGround}%`
      );
    }
    if (interactionOptions.blockRateFlying > 0) {
      interactionDetails.push(
        `block rate vs flying/evasion: ${interactionOptions.blockRateFlying}%`
      );
    }
    if (interactionOptions.removalChance > 0) {
      interactionDetails.push(
        `removal interaction chance per turn: ${interactionOptions.removalChance}%`
      );
    }
    const interactionText =
      interactionDetails.length > 0
        ? ` Model opponent interaction with ${interactionDetails.join(', ')}.`
        : '';
    const prompt = `Goldfish this deck. Simulate ${games} games going ${turns} turns.${metricsText} Summarize the results of the simulations.${interactionText}`;
    await submitQuery(prompt, { hideUserMessage: true, mode: 'goldfish' });
  };

  const handleRestartConversation = async () => {
    await resetConversationState();
  };

  const handleCancelRequest = () => {
    requestControllerRef.current?.abort();
  };

  const handleExportPdf = async () => {
    if (messages.length === 0 || exporting) return;
    setExporting(true);

    try {
      const deckSlug = deckUrl.trim().split('/').filter(Boolean).pop();
      const filename = deckLoaded && deckSlug
        ? `${deckSlug}.pdf`
        : 'before-that-resolves-conversation.pdf';
      const response = await postWithOptionalConfig(
        buildApiUrl('/api/chat/export-pdf'),
        {
          title: 'Before That Resolves',
          subtitle: 'Commander Deck Analyzer & Strategy Assistant',
          deckUrl: deckLoaded ? deckUrl : undefined,
          messages
        },
        { responseType: 'blob' }
      );

      const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      appendErrorMessage(getErrorMessage(error, 'Failed to export PDF'));
    } finally {
      setExporting(false);
    }
  };

  const deckPanelContent = (
    <>
      <div className="p-4 border-b border-gray-700">
        <label className="block text-gray-300 text-sm mb-2">
          Deck list URL to discuss with The Oracle
        </label>
        <div className="flex flex-col gap-2">
          <input
            type="url"
            value={deckUrl}
            onChange={(e) => {
              setDeckUrl(e.target.value);
              if (deckLoaded) {
                setDeckLoaded(false);
              }
            }}
            placeholder="https://archidekt.com/decks/..."
            className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
            disabled={loading}
          />
          <button
            type="button"
            onClick={handleLoadDeck}
            disabled={loading || !deckUrl.trim()}
            className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-semibold"
          >
            Load Deck
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Supports public decks from Archidekt.
        </div>
      </div>
      {deckLoaded && (
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-200">Analyze options</span>
            <button
              type="button"
              onClick={() => {
                setShowAnalyzeOptions((prev) => {
                  const next = !prev;
                  if (next) {
                    setShowGoldfishOptions(false);
                    setShowModelOptions(false);
                  }
                  return next;
                });
              }}
              className="text-xs text-gray-400 hover:text-gray-200"
            >
              {showAnalyzeOptions ? 'Hide' : 'Show'}
            </button>
          </div>
          {showAnalyzeOptions && (
            <div className="flex flex-col gap-3 text-sm text-gray-300 max-h-[18rem] overflow-y-auto pr-1">
              <span className="relative group w-full">
                <button
                  type="button"
                  onClick={handleAnalyzeDeck}
                  disabled={
                    loading ||
                    !deckLoaded ||
                    !deckUrl.trim() ||
                    !hasApiKey
                  }
                  className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-semibold"
                >
                  Analyze Deck
                </button>
                {!hasApiKey && (
                  <span className="pointer-events-none absolute left-1/2 top-full mt-2 w-max -translate-x-1/2 rounded bg-gray-950 px-2 py-1 text-[11px] text-gray-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    OpenAI API key is required.
                  </span>
                )}
              </span>
              <div className="flex items-center justify-start gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setDeckAnalysisOptions((prev) =>
                      Object.fromEntries(
                        Object.keys(prev).map((key) => [key, true])
                      ) as typeof prev
                    )
                  }
                  disabled={loading || !deckLoaded}
                  className="text-gray-300 hover:text-white border border-gray-600 rounded px-2 py-0.5 transition-colors"
                >
                  Check all
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDeckAnalysisOptions((prev) =>
                      Object.fromEntries(
                        Object.keys(prev).map((key) => [key, false])
                      ) as typeof prev
                    )
                  }
                  disabled={loading || !deckLoaded}
                  className="text-gray-300 hover:text-white border border-gray-600 rounded px-2 py-0.5 transition-colors"
                >
                  Uncheck all
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={deckAnalysisOptions.summary}
                    onChange={(e) =>
                      setDeckAnalysisOptions((prev) => ({
                        ...prev,
                        summary: e.target.checked
                      }))
                    }
                    disabled={loading || !deckLoaded}
                    className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  Summarize
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={deckAnalysisOptions.winCons}
                    onChange={(e) =>
                      setDeckAnalysisOptions((prev) => ({
                        ...prev,
                        winCons: e.target.checked
                      }))
                    }
                    disabled={loading || !deckLoaded}
                    className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  Find win cons
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={deckAnalysisOptions.bracket}
                    onChange={(e) =>
                      setDeckAnalysisOptions((prev) => ({
                        ...prev,
                        bracket: e.target.checked
                      }))
                    }
                    disabled={loading || !deckLoaded}
                    className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  Assess bracket
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={deckAnalysisOptions.weaknesses}
                    onChange={(e) =>
                      setDeckAnalysisOptions((prev) => ({
                        ...prev,
                        weaknesses: e.target.checked
                      }))
                    }
                    disabled={loading || !deckLoaded}
                    className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  Find weaknesses
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={deckAnalysisOptions.cardTypeCounts}
                    onChange={(e) =>
                      setDeckAnalysisOptions((prev) => ({
                        ...prev,
                        cardTypeCounts: e.target.checked
                      }))
                    }
                    disabled={loading || !deckLoaded}
                    className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  Card type counts
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={deckAnalysisOptions.tribalCounts}
                    onChange={(e) =>
                      setDeckAnalysisOptions((prev) => ({
                        ...prev,
                        tribalCounts: e.target.checked
                      }))
                    }
                    disabled={loading || !deckLoaded}
                    className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  Tribal counts
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={deckAnalysisOptions.categoryCounts}
                    onChange={(e) =>
                      setDeckAnalysisOptions((prev) => ({
                        ...prev,
                        categoryCounts: e.target.checked
                      }))
                    }
                    disabled={loading || !deckLoaded}
                    className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  Category counts
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={deckAnalysisOptions.subtypeCounts}
                    onChange={(e) =>
                      setDeckAnalysisOptions((prev) => ({
                        ...prev,
                        subtypeCounts: e.target.checked
                      }))
                    }
                    disabled={loading || !deckLoaded}
                    className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  Subtypes
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={deckAnalysisOptions.landTypeCounts}
                    onChange={(e) =>
                      setDeckAnalysisOptions((prev) => ({
                        ...prev,
                        landTypeCounts: e.target.checked
                      }))
                    }
                    disabled={loading || !deckLoaded}
                    className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  Land types
                </label>
              </div>
            </div>
          )}
        </div>
      )}
      {deckLoaded && (
        <div className="p-4 flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-200">Goldfish options</span>
            <button
              type="button"
              onClick={() => {
                setShowGoldfishOptions((prev) => {
                  const next = !prev;
                  if (next) {
                    setShowAnalyzeOptions(false);
                    setShowModelOptions(false);
                  }
                  return next;
                });
              }}
              className="text-xs text-gray-400 hover:text-gray-200"
            >
              {showGoldfishOptions ? 'Hide' : 'Show'}
            </button>
          </div>
          {showGoldfishOptions && (
            <div className="flex flex-col gap-4 text-sm text-gray-300 flex-1 min-h-0 overflow-y-auto pr-1">
              <span className="relative group w-full">
                <button
                  type="button"
                  onClick={handleGoldfishDeck}
                  disabled={!deckLoaded || loading || !hasApiKey}
                  className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-semibold"
                >
                  Goldfish Deck
                </button>
                {!hasApiKey && (
                  <span className="pointer-events-none absolute left-1/2 top-full mt-2 w-max -translate-x-1/2 rounded bg-gray-950 px-2 py-1 text-[11px] text-gray-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    OpenAI API key is required.
                  </span>
                )}
              </span>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-2">
                  <span>Games</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={goldfishGames}
                    onChange={(e) => setGoldfishGames(Number(e.target.value))}
                    disabled={!deckLoaded || loading}
                    className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span>Turns</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={goldfishTurns}
                    onChange={(e) => setGoldfishTurns(Number(e.target.value))}
                    disabled={!deckLoaded || loading}
                    className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                  />
                </label>
              </div>
              <div className="flex items-center justify-start gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setGoldfishMetrics((prev) =>
                      Object.fromEntries(
                        Object.keys(prev).map((key) => [key, true])
                      ) as typeof prev
                    )
                  }
                  disabled={!deckLoaded || loading}
                  className="text-gray-300 hover:text-white border border-gray-600 rounded px-2 py-0.5 transition-colors"
                >
                  Check all
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setGoldfishMetrics((prev) =>
                      Object.fromEntries(
                        Object.keys(prev).map((key) => [key, false])
                      ) as typeof prev
                    )
                  }
                  disabled={!deckLoaded || loading}
                  className="text-gray-300 hover:text-white border border-gray-600 rounded px-2 py-0.5 transition-colors"
                >
                  Uncheck all
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <span className="text-[11px] uppercase tracking-wide text-gray-500 col-span-2">
                    Core play pattern
                  </span>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={goldfishMetrics.lands}
                      onChange={(e) =>
                        setGoldfishMetrics((prev) => ({ ...prev, lands: e.target.checked }))
                      }
                      disabled={!deckLoaded || loading}
                      className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                    />
                    Lands in play by turn (missed land drops)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={goldfishMetrics.manaAvailable}
                      onChange={(e) =>
                        setGoldfishMetrics((prev) => ({
                          ...prev,
                          manaAvailable: e.target.checked
                        }))
                      }
                      disabled={!deckLoaded || loading}
                      className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                    />
                    Mana available by turn (colors)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={goldfishMetrics.ramp}
                      onChange={(e) =>
                        setGoldfishMetrics((prev) => ({ ...prev, ramp: e.target.checked }))
                      }
                      disabled={!deckLoaded || loading}
                      className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                    />
                    Ramp count by turn
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={goldfishMetrics.cardsSeen}
                      onChange={(e) =>
                        setGoldfishMetrics((prev) => ({
                          ...prev,
                          cardsSeen: e.target.checked
                        }))
                      }
                      disabled={!deckLoaded || loading}
                      className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                    />
                    Cards seen by turn
                  </label>
                  <span className="text-[11px] uppercase tracking-wide text-gray-500 col-span-2 mt-2">
                    Commander focus
                  </span>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={goldfishMetrics.commanderCast}
                      onChange={(e) =>
                        setGoldfishMetrics((prev) => ({
                          ...prev,
                          commanderCast: e.target.checked
                        }))
                      }
                      disabled={!deckLoaded || loading}
                      className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                    />
                    Commander cast turn
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={goldfishMetrics.commanderRecasts}
                      onChange={(e) =>
                        setGoldfishMetrics((prev) => ({
                          ...prev,
                          commanderRecasts: e.target.checked
                        }))
                      }
                      disabled={!deckLoaded || loading}
                      className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                    />
                    Commander recasts (tax impact)
                  </label>
                  <span className="text-[11px] uppercase tracking-wide text-gray-500 col-span-2 mt-2">
                    Execution & consistency
                  </span>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={goldfishMetrics.keyEngine}
                      onChange={(e) =>
                        setGoldfishMetrics((prev) => ({
                          ...prev,
                          keyEngine: e.target.checked
                        }))
                      }
                      disabled={!deckLoaded || loading}
                      className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                    />
                    First key engine/piece
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={goldfishMetrics.winCon}
                      onChange={(e) =>
                        setGoldfishMetrics((prev) => ({ ...prev, winCon: e.target.checked }))
                      }
                      disabled={!deckLoaded || loading}
                      className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                    />
                    Win-con assembled by turn
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={goldfishMetrics.interaction}
                      onChange={(e) =>
                        setGoldfishMetrics((prev) => ({
                          ...prev,
                          interaction: e.target.checked
                        }))
                      }
                      disabled={!deckLoaded || loading}
                      className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                    />
                    Interaction seen by turn
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={goldfishMetrics.damageByTurn}
                      onChange={(e) =>
                        setGoldfishMetrics((prev) => ({
                          ...prev,
                          damageByTurn: e.target.checked
                        }))
                      }
                      disabled={!deckLoaded || loading}
                      className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                    />
                    Potential damage dealt by turn
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={goldfishMetrics.lethalByTurn}
                      onChange={(e) =>
                        setGoldfishMetrics((prev) => ({
                          ...prev,
                          lethalByTurn: e.target.checked
                        }))
                      }
                      disabled={!deckLoaded || loading}
                      className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                    />
                    Lethal damage achieved by turn
                  </label>
                  <span className="text-[11px] uppercase tracking-wide text-gray-500 col-span-2 mt-2">
                    Mulligans & curve
                  </span>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={goldfishMetrics.mulligans}
                      onChange={(e) =>
                        setGoldfishMetrics((prev) => ({
                          ...prev,
                          mulligans: e.target.checked
                        }))
                      }
                      disabled={!deckLoaded || loading}
                      className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                    />
                    Mulligan rate & keep size
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={goldfishMetrics.keepableHands}
                      onChange={(e) =>
                        setGoldfishMetrics((prev) => ({
                          ...prev,
                          keepableHands: e.target.checked
                        }))
                      }
                      disabled={!deckLoaded || loading}
                      className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                    />
                    Keepable hand rate (2–4 lands, 1–2 plays)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={goldfishMetrics.curveUsage}
                      onChange={(e) =>
                        setGoldfishMetrics((prev) => ({
                          ...prev,
                          curveUsage: e.target.checked
                        }))
                      }
                      disabled={!deckLoaded || loading}
                      className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                    />
                    Mana usage by turn (curve spend)
                  </label>
                </div>
                <span className="text-[11px] uppercase tracking-wide text-gray-500 mt-2">
                  Opponent interaction
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-2">
                    <span>Incoming damage/turn</span>
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={interactionOptions.incomingDamage}
                      onChange={(e) =>
                        setInteractionOptions((prev) => ({
                          ...prev,
                          incomingDamage: Number(e.target.value)
                        }))
                      }
                      disabled={!deckLoaded || loading}
                      className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span>Removal chance %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={interactionOptions.removalChance}
                      onChange={(e) =>
                        setInteractionOptions((prev) => ({
                          ...prev,
                          removalChance: Number(e.target.value)
                        }))
                      }
                      disabled={!deckLoaded || loading}
                      className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span>Block rate (ground) %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={interactionOptions.blockRateGround}
                      onChange={(e) =>
                        setInteractionOptions((prev) => ({
                          ...prev,
                          blockRateGround: Number(e.target.value)
                        }))
                      }
                      disabled={!deckLoaded || loading}
                      className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span>Block rate (flying) %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={interactionOptions.blockRateFlying}
                      onChange={(e) =>
                        setInteractionOptions((prev) => ({
                          ...prev,
                          blockRateFlying: Number(e.target.value)
                        }))
                      }
                      disabled={!deckLoaded || loading}
                      className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );

  const aiOptionsContent = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-200">AI Options</span>
        <button
          type="button"
          onClick={() => {
            setShowModelOptions((prev) => {
              const next = !prev;
              if (next) {
                setShowAnalyzeOptions(false);
                setShowGoldfishOptions(false);
              }
              return next;
            });
          }}
          className="text-xs text-gray-400 hover:text-gray-200"
        >
          {showModelOptions ? 'Hide' : 'Show'}
        </button>
      </div>
      {showModelOptions && (
        <div className="mt-3 flex flex-col gap-4">
          <div className="flex flex-col gap-3 text-sm text-gray-300">
            <div className="flex items-center gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={openAiKey}
                onChange={(e) => setOpenAiKey(e.target.value)}
                placeholder="sk-..."
                className="flex-1 rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={() => setShowKey((prev) => !prev)}
                className="text-xs text-gray-300 border border-gray-600 rounded px-2 py-1 hover:text-white hover:border-gray-400 transition-colors"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <input
                type="checkbox"
                checked={saveKeyLocally}
                onChange={(e) => setSaveKeyLocally(e.target.checked)}
                className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
              />
              Store this key in this browser (local storage)
            </label>
            <span className="text-[11px] text-gray-500">
              Keys are required for requests and are never stored by the server. Remove the
              stored key by unchecking the option above and clearing the field.
            </span>
          </div>
          <div>{modelControls}</div>
        </div>
      )}
    </>
  );

  const deckPanelDesktop = (
    <div className="rounded-lg border border-gray-700 bg-gray-900/70 overflow-hidden flex-1 min-h-0 flex flex-col">
      {deckPanelContent}
      <div className="p-4 border-t border-gray-700 mt-auto">
        {aiOptionsContent}
      </div>
    </div>
  );

  const deckPanelMobile = (
    <div className="rounded-lg border border-gray-700 bg-gray-900/70 overflow-hidden flex flex-col">
      {deckPanelContent}
    </div>
  );

  const aiOptionsPanelMobile = (
    <div className="rounded-lg border border-gray-700 bg-gray-900/70 overflow-hidden">
      <div className="p-4">{aiOptionsContent}</div>
    </div>
  );

  const chatPanel = (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-900/40 rounded-lg border border-gray-700 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-gray-700 p-4 bg-gray-900/70 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold sm:text-xl">
          The Oracle - Your Magic:The Gathering AI Agent
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exporting || messages.length === 0}
            className="w-full text-sm text-gray-300 hover:text-gray-100 border border-gray-600 hover:border-gray-500 rounded px-3 py-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
          >
            Export conversation to pdf
          </button>
          <button
            type="button"
            onClick={handleRestartConversation}
            className="w-full text-sm text-gray-300 hover:text-gray-100 border border-gray-600 hover:border-gray-500 rounded px-3 py-1 transition-colors sm:w-auto"
          >
            New Conversation
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4 sm:p-4">
        {messages.length === 0 && (
          <div className="text-gray-500 text-sm">
            Start the conversation by asking about a card or loading a deck.
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.role === 'error'
                    ? 'bg-red-900/70 text-red-200 border border-red-700'
                    : 'bg-gray-700/70 text-gray-100'
              }`}
            >
              {message.role === 'agent' ? (
                <RichMTGText text={message.content} />
              ) : (
                message.content
              )}
            </div>
          </div>
        ))}

        {loadingMode && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm bg-gray-700/70 text-gray-200">
              {loadingMode === 'query' ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span>Thinking</span>
                    <span className="flex gap-1">
                      <span
                        className="inline-block w-2 h-2 rounded-full bg-cyan-300 animate-bounce"
                        style={{ animationDelay: '0s', animationDuration: '0.6s' }}
                      />
                      <span
                        className="inline-block w-2 h-2 rounded-full bg-cyan-300 animate-bounce"
                        style={{ animationDelay: '0.1s', animationDuration: '0.6s' }}
                      />
                      <span
                        className="inline-block w-2 h-2 rounded-full bg-cyan-300 animate-bounce"
                        style={{ animationDelay: '0.2s', animationDuration: '0.6s' }}
                      />
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelRequest}
                    className="text-xs text-gray-300 border border-gray-500/70 rounded px-2 py-0.5 hover:text-white hover:border-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span>
                        {loadingMode === 'analyze' ? 'Analyzing Deck' : 'Goldfishing Deck'}
                      </span>
                      <span className="flex gap-1">
                        <span
                          className="inline-block w-2 h-2 rounded-full bg-cyan-300 animate-bounce"
                          style={{ animationDelay: '0s', animationDuration: '0.6s' }}
                        />
                        <span
                          className="inline-block w-2 h-2 rounded-full bg-cyan-300 animate-bounce"
                          style={{ animationDelay: '0.1s', animationDuration: '0.6s' }}
                        />
                        <span
                          className="inline-block w-2 h-2 rounded-full bg-cyan-300 animate-bounce"
                          style={{ animationDelay: '0.2s', animationDuration: '0.6s' }}
                        />
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelRequest}
                      className="text-xs text-gray-300 border border-gray-500/70 rounded px-2 py-0.5 hover:text-white hover:border-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                  <span className="text-xs text-gray-400">
                    {loadingMode === 'analyze'
                      ? 'This could take several minutes'
                      : 'This process can take 5 to 60 minutes depending on the options chosen'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-700 p-3 bg-gray-900/70 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a question to the Oracle..."
            className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <span className="relative group w-full sm:w-auto">
            <button
              type="submit"
              disabled={loading || !query.trim() || !hasApiKey}
              className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors sm:w-[10.5rem]"
            >
              Send
            </button>
            {!hasApiKey && (
              <span className="pointer-events-none absolute left-1/2 bottom-full mb-2 w-max -translate-x-1/2 rounded bg-gray-950 px-2 py-1 text-[11px] text-gray-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                OpenAI API key is required.
              </span>
            )}
          </span>
        </div>
      </form>
    </div>
  );

  const mobileTabClass = (tab: MobilePanel) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
      mobilePanel === tab
        ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/60'
        : 'bg-gray-900/60 text-gray-300 border border-gray-700'
    }`;

  return (
    <div className="w-full max-w-none p-3 sm:p-4 flex-none flex flex-col min-h-0 h-full">
      <div className="bg-gray-800/50 backdrop-blur rounded-lg p-3 shadow-xl flex flex-col flex-1 min-h-0 h-full overflow-hidden sm:p-4">
        {isMobile ? (
          <div className="flex flex-col flex-1 min-h-0 gap-4">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMobilePanel('chat')}
                className={mobileTabClass('chat')}
                aria-pressed={mobilePanel === 'chat'}
              >
                Oracle
              </button>
              <button
                type="button"
                onClick={() => setMobilePanel('deck')}
                className={mobileTabClass('deck')}
                aria-pressed={mobilePanel === 'deck'}
              >
                Deck
              </button>
              <button
                type="button"
                onClick={() => setMobilePanel('ai')}
                className={mobileTabClass('ai')}
                aria-pressed={mobilePanel === 'ai'}
              >
                AI
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {mobilePanel === 'chat' && chatPanel}
              {mobilePanel === 'deck' && (
                <div className="h-full overflow-y-auto pr-1">
                  {deckPanelMobile}
                </div>
              )}
              {mobilePanel === 'ai' && (
                <div className="h-full overflow-y-auto pr-1">
                  {aiOptionsPanelMobile}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 gap-4 overflow-hidden">
            <aside className="w-[28%] min-w-[18rem] flex flex-col gap-4 min-h-0 pr-1">
              {deckPanelDesktop}
            </aside>
            {chatPanel}
          </div>
        )}

        {messages.length > 0 && (
          <div className="mt-4">
            <DeveloperInfo />
          </div>
        )}
      </div>
    </div>
  );
}
