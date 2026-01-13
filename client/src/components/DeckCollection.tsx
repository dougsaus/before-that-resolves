import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ColorIdentityIcons, ColorIdentitySelect } from './ColorIdentitySelect';
import { getColorIdentityLabel, sortColorsForDisplay } from '../utils/color-identity';
import { useGameLogs } from '../hooks/useGameLogs';
import { buildApiUrl } from '../utils/api';

const PREDEFINED_TAGS = [
  'mulligan',
  'missed land drops',
  'poor card draw',
  'god hand',
  'bad opening hand',
  'scooped'
] as const;

function formatWinRate(winRate: number | null): string {
  if (winRate === null) return '—';
  return `${Math.round(winRate * 100)}%`;
}

function parseLocalDate(input: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(input);
}

function formatLastPlayed(lastPlayed: string | null): string {
  if (!lastPlayed) return '—';
  const date = parseLocalDate(lastPlayed);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDeckSource(input: string): 'archidekt' | 'moxfield' | null {
  if (!input.trim()) return null;
  try {
    const parsed = new URL(input);
    if (parsed.host.includes('archidekt.com') && parsed.pathname.includes('/decks/')) {
      return 'archidekt';
    }
    if (parsed.host.includes('moxfield.com') && parsed.pathname.includes('/decks/')) {
      return 'moxfield';
    }
    return null;
  } catch {
    return null;
  }
}

function isSupportedDeckUrl(input: string): boolean {
  return getDeckSource(input) !== null;
}

function formatColorValue(colors: string[] | null): string {
  if (!colors) return '';
  if (colors.length === 0) return 'C';
  return sortColorsForDisplay(colors).join('');
}

function getScryfallImageUrl(cardName: string) {
  const encoded = encodeURIComponent(cardName.trim());
  return `https://api.scryfall.com/cards/named?exact=${encoded}&format=image&version=normal`;
}

export type DeckStats = {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number | null;
  lastPlayed: string | null;
};

export type DeckEntry = {
  id: string;
  name: string;
  url: string | null;
  commanderNames: string[];
  commanderLinks: Array<string | null>;
  colorIdentity: string[] | null;
  source: 'archidekt' | 'moxfield' | 'manual';
  addedAt: string;
  stats: DeckStats | null;
};

export type DeckFormInput = {
  deckId?: string;
  name: string;
  url?: string | null;
  commanderNames?: string[];
  colorIdentity?: string[];
};

export type DeckPreview = {
  id: string;
  name: string;
  url: string;
  commanderNames: string[];
  colorIdentity: string[];
  source?: 'archidekt' | 'moxfield';
};

export type DeckPreviewResult = {
  deck?: DeckPreview;
  error?: string;
};

type CommanderEntry = {
  name: string;
  link: string | null;
  lookupStatus: 'idle' | 'loading' | 'found' | 'not-found' | 'error';
};

type OpponentForm = {
  name: string;
  commanders: CommanderEntry[];
  colorIdentity: string;
};

type DeckCollectionProps = {
  enabled: boolean;
  idToken: string | null;
  decks: DeckEntry[];
  loading: boolean;
  deckError: string | null;
  onCreateDeck: (input: DeckFormInput) => Promise<boolean>;
  onUpdateDeck: (deckId: string, input: DeckFormInput) => Promise<boolean>;
  onPreviewDeck: (deckUrl: string) => Promise<DeckPreviewResult>;
  onRemoveDeck: (deckId: string) => Promise<void>;
  onOpenInOracle?: (deckUrl: string) => void;
  onRefreshDecks?: () => Promise<void>;
};

export function DeckCollection({
  enabled,
  idToken,
  decks,
  loading,
  deckError,
  onCreateDeck,
  onUpdateDeck,
  onPreviewDeck,
  onRemoveDeck,
  onOpenInOracle,
  onRefreshDecks
}: DeckCollectionProps) {
  type SortKey = 'name' | 'commander' | 'color' | 'games' | 'wins' | 'lastPlayed';
  const sortStorageKey = 'btr:deck-sort';
  const sortKeys: SortKey[] = ['name', 'commander', 'color', 'games', 'wins', 'lastPlayed'];
  const loadSortPrefs = (): { key: SortKey; dir: 'asc' | 'desc' } | null => {
    try {
      const raw = localStorage.getItem(sortStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { key?: string; dir?: string };
      const key = sortKeys.find((option) => option === parsed.key);
      const dir = parsed.dir === 'asc' || parsed.dir === 'desc' ? parsed.dir : null;
      if (!key || !dir) return null;
      return { key, dir };
    } catch {
      return null;
    }
  };
  const initialSort = loadSortPrefs();
  const [deckId, setDeckId] = useState<string | null>(null);
  const [deckUrl, setDeckUrl] = useState('');
  const [deckName, setDeckName] = useState('');
  const [commanderInputs, setCommanderInputs] = useState<string[]>(['']);
  const [commanderLookupLinks, setCommanderLookupLinks] = useState<Array<string | null>>([]);
  const [commanderLookupStatus, setCommanderLookupStatus] = useState<Array<'idle' | 'loading' | 'found' | 'not-found' | 'error'>>([]);
  const [deckColor, setDeckColor] = useState('');
  const [deckFormError, setDeckFormError] = useState<string | null>(null);
  const [deckPreviewError, setDeckPreviewError] = useState<string | null>(null);
  const [deckModalOpen, setDeckModalOpen] = useState(false);
  const [deckPreviewLoading, setDeckPreviewLoading] = useState(false);
  const [editTarget, setEditTarget] = useState<DeckEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeckEntry | null>(null);
  const [logTarget, setLogTarget] = useState<DeckEntry | null>(null);
  const [logDate, setLogDate] = useState('');
  const [logTurns, setLogTurns] = useState('');
  const [logDurationMinutes, setLogDurationMinutes] = useState('');
  const [logOpponents, setLogOpponents] = useState<OpponentForm[]>([]);
  const [logResult, setLogResult] = useState<'win' | 'loss' | 'pending'>('pending');
  const [logTags, setLogTags] = useState<string[]>([]);
  const [logCustomTagInput, setLogCustomTagInput] = useState('');
  const [logFormError, setLogFormError] = useState<string | null>(null);
  const deckListRef = useRef<HTMLDivElement | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>(() => initialSort?.key ?? 'name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => initialSort?.dir ?? 'asc');
  const [hoverCard, setHoverCard] = useState<{ label: string; rect: DOMRect } | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLAnchorElement | null>(null);
  const imageUrl = useMemo(() => (hoverCard ? getScryfallImageUrl(hoverCard.label) : null), [hoverCard]);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const sortLabels: Record<SortKey, string> = {
    name: 'Deck name',
    commander: 'Commander(s)',
    color: 'Color identity',
    games: 'Games played',
    wins: 'Wins',
    lastPlayed: 'Last played'
  };
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const {
    addLog,
    error: logError,
    loading: logLoading,
    statusMessage: logStatusMessage
  } = useGameLogs(idToken, { autoLoad: false });
  useEffect(() => {
    const update = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const hoverPosition = useMemo(() => {
    if (!hoverCard) return null;
    const margin = 12;
    const popupWidth = 272;
    const popupHeight = 360;

    let left = hoverCard.rect.left + hoverCard.rect.width / 2 - popupWidth / 2;
    left = Math.max(margin, Math.min(left, viewport.width - popupWidth - margin));

    const aboveTop = hoverCard.rect.top - popupHeight - margin;
    if (aboveTop >= margin) {
      const bottom = viewport.height - hoverCard.rect.top + margin;
      return { left, bottom, placement: 'above' as const };
    }

    const top = hoverCard.rect.bottom + margin;
    return { left, top, placement: 'below' as const };
  }, [hoverCard, viewport.height, viewport.width]);

  useEffect(() => {
    if (!hoverCard) return;

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      const overAnchor = anchorRef.current?.contains(target || null);
      const overPopup = popupRef.current?.contains(target || null);
      if (!overAnchor && !overPopup) {
        setHoverCard(null);
      }
    };

    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [hoverCard]);
  useEffect(() => {
    localStorage.setItem(sortStorageKey, JSON.stringify({ key: sortKey, dir: sortDir }));
  }, [sortKey, sortDir]);

  const getTotalGames = (deck: DeckEntry) => {
    const stats = deck.stats;
    if (!stats) return 0;
    const total = Number(stats.totalGames);
    if (Number.isFinite(total) && total > 0) {
      return total;
    }
    const fallback = stats.wins + stats.losses;
    return Number.isFinite(fallback) ? fallback : 0;
  };

  const sortedDecks = useMemo(() => {
    const sorted = [...decks];
    const direction = sortDir === 'asc' ? 1 : -1;
    const getCommanderValue = (deck: DeckEntry) => deck.commanderNames[0] ?? '';
    const getColorValue = (deck: DeckEntry) => {
      if (!deck.colorIdentity) return '';
      return sortColorsForDisplay(deck.colorIdentity).join('');
    };
    const getGamesValue = (deck: DeckEntry) => getTotalGames(deck);
    const getWinsValue = (deck: DeckEntry) => deck.stats?.wins ?? 0;
    const getLastPlayedValue = (deck: DeckEntry) =>
      deck.stats?.lastPlayed ? parseLocalDate(deck.stats.lastPlayed).getTime() : 0;
    sorted.sort((a, b) => {
      if (sortKey === 'games') {
        return (getGamesValue(a) - getGamesValue(b)) * direction;
      }
      if (sortKey === 'wins') {
        return (getWinsValue(a) - getWinsValue(b)) * direction;
      }
      if (sortKey === 'lastPlayed') {
        return (getLastPlayedValue(a) - getLastPlayedValue(b)) * direction;
      }
      let left = '';
      let right = '';
      if (sortKey === 'name') {
        left = a.name;
        right = b.name;
      } else if (sortKey === 'commander') {
        left = getCommanderValue(a);
        right = getCommanderValue(b);
      } else {
        left = getColorValue(a);
        right = getColorValue(b);
      }
      return left.localeCompare(right, undefined, { sensitivity: 'base' }) * direction;
    });
    return sorted;
  }, [decks, sortDir, sortKey]);
  const updateScrollHint = () => {
    const list = deckListRef.current;
    if (!list) return;
    const hasOverflow = list.scrollHeight > list.clientHeight + 1;
    const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
    setShowScrollHint(hasOverflow && !atBottom);
  };
  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      updateScrollHint();
    });
    const list = deckListRef.current;
    if (!list) return;
    const ResizeObserverImpl = window.ResizeObserver;
    const resizeObserver = ResizeObserverImpl ? new ResizeObserverImpl(updateScrollHint) : null;
    resizeObserver?.observe(list);
    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
    };
  }, [sortedDecks.length]);

  const handleSortChange = (key: SortKey) => {
    setSortKey(key);
    const defaultDir = key === 'games' || key === 'wins' || key === 'lastPlayed' ? 'desc' : 'asc';
    setSortDir(defaultDir);
  };

  const applyCommanderInputs = (names: string[], links: Array<string | null> = []) => {
    const normalized = names.slice(0, 2);
    if (normalized.length > 1) {
      setCommanderInputs(normalized);
    } else {
      setCommanderInputs([normalized[0] ?? '']);
    }
    setCommanderLookupLinks([links[0] ?? null, links[1] ?? null].slice(0, normalized.length || 1));
    setCommanderLookupStatus(
      normalized.length > 0
        ? normalized.map((_, index) => (links[index] ? 'found' : 'idle'))
        : ['idle']
    );
  };

  const resetDeckForm = () => {
    setDeckId(null);
    setDeckUrl('');
    setDeckName('');
    setCommanderInputs(['']);
    setCommanderLookupLinks([]);
    setCommanderLookupStatus([]);
    setDeckColor('');
    setDeckFormError(null);
    setDeckPreviewError(null);
    setDeckPreviewLoading(false);
  };

  const addCommanderInput = () => {
    setCommanderInputs((current) => (current.length >= 2 ? current : [...current, '']));
    setCommanderLookupLinks((current) => (current.length >= 2 ? current : [...current, null]));
    setCommanderLookupStatus((current) => (current.length >= 2 ? current : [...current, 'idle']));
  };

  const removeSecondCommander = () => {
    setCommanderInputs((current) => (current.length > 1 ? [current[0] ?? ''] : current));
    setCommanderLookupLinks((current) => (current.length > 1 ? [current[0] ?? null] : current));
    setCommanderLookupStatus((current) => (current.length > 1 ? [current[0] ?? 'idle'] : current));
  };

  const updateCommanderInput = (index: number, value: string) => {
    setCommanderInputs((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
    setCommanderLookupLinks((current) => {
      const next = [...current];
      next[index] = null;
      return next;
    });
    setCommanderLookupStatus((current) => {
      const next = [...current];
      next[index] = 'idle';
      return next;
    });
  };

  const openAddModal = () => {
    setEditTarget(null);
    resetDeckForm();
    setDeckModalOpen(true);
  };

  const openEditModal = (deck: DeckEntry) => {
    setEditTarget(deck);
    setDeckId(deck.id);
    setDeckUrl(deck.url ?? '');
    setDeckName(deck.name);
    applyCommanderInputs(deck.commanderNames, deck.commanderLinks);
    setDeckColor(formatColorValue(deck.colorIdentity));
    setDeckFormError(null);
    setDeckPreviewError(null);
    setDeckPreviewLoading(false);
    setDeckModalOpen(true);
  };

  const closeDeckModal = () => {
    setDeckModalOpen(false);
    setEditTarget(null);
    setDeckPreviewLoading(false);
  };

  const resetLogForm = () => {
    setLogDate(today);
    setLogTurns('');
    setLogDurationMinutes('');
    setLogOpponents([]);
    setLogResult('pending');
    setLogTags([]);
    setLogCustomTagInput('');
    setLogFormError(null);
  };

  const toggleLogTag = (tag: string) => {
    setLogTags((current) =>
      current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag]
    );
  };

  const addLogCustomTag = () => {
    const tag = logCustomTagInput.trim().toLowerCase();
    if (tag && !logTags.includes(tag)) {
      setLogTags((current) => [...current, tag]);
    }
    setLogCustomTagInput('');
  };

  const addLogOpponent = () => {
    setLogOpponents((current) => [...current, {
      name: '',
      commanders: [{ name: '', link: null, lookupStatus: 'idle' }],
      colorIdentity: ''
    }]);
  };

  const removeLogOpponent = (index: number) => {
    setLogOpponents((current) => current.filter((_, i) => i !== index));
  };

  const openLogModal = (deck: DeckEntry) => {
    resetLogForm();
    setLogTarget(deck);
  };

  const handlePreviewDeck = async () => {
    const trimmedUrl = deckUrl.trim();
    if (!isSupportedDeckUrl(trimmedUrl)) return;
    setDeckPreviewError(null);
    setDeckPreviewLoading(true);
    const result = await onPreviewDeck(trimmedUrl);
    setDeckPreviewLoading(false);
    if (!result.deck) {
      setDeckPreviewError(result.error || 'Unable to load deck.');
      return;
    }
    const { deck } = result;
    setDeckName(deck.name);
    applyCommanderInputs(deck.commanderNames);
    setDeckColor(formatColorValue(deck.colorIdentity));
    setDeckUrl(deck.url);
    if (!editTarget) {
      setDeckId(deck.id);
    }
  };

  const handleSaveDeck = async () => {
    if (!deckName.trim()) {
      setDeckFormError('Deck name is required.');
      return;
    }
    setDeckFormError(null);
    const commanderNames = commanderInputs
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 2);
    const input: DeckFormInput = {
      name: deckName.trim(),
      url: deckUrl.trim() ? deckUrl.trim() : null,
      commanderNames: commanderNames.length > 0 ? commanderNames : undefined
    };
    if (deckColor === 'C') {
      input.colorIdentity = [];
    } else if (deckColor) {
      input.colorIdentity = deckColor.split('');
    }
    const saved = editTarget
      ? await onUpdateDeck(editTarget.id, input)
      : await onCreateDeck({ ...input, ...(deckId ? { deckId } : {}) });
    if (!saved) return;
    resetDeckForm();
    closeDeckModal();
  };

  const lookupCommander = async (index: number) => {
    if (!idToken) {
      setDeckFormError('Sign in with Google to search commanders.');
      return;
    }
    const name = commanderInputs[index]?.trim();
    if (!name) {
      return;
    }
    setCommanderLookupStatus((current) => {
      const next = [...current];
      next[index] = 'loading';
      return next;
    });
    setDeckFormError(null);
    try {
      const response = await fetch(buildApiUrl('/api/scryfall/lookup'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      });
      const text = await response.text();
      let payload: { success?: boolean; card?: { name: string; scryfallUrl: string | null }; error?: string };
      try {
        payload = JSON.parse(text) as { success?: boolean; card?: { name: string; scryfallUrl: string | null }; error?: string };
      } catch {
        throw new Error('Unexpected response from server.');
      }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to lookup commander.');
      }
      if (!payload.card) {
        setCommanderLookupLinks((current) => {
          const next = [...current];
          next[index] = null;
          return next;
        });
        setCommanderLookupStatus((current) => {
          const next = [...current];
          next[index] = 'not-found';
          return next;
        });
        return;
      }
      setCommanderInputs((current) => {
        const next = [...current];
        next[index] = payload.card?.name || name;
        return next;
      });
      setCommanderLookupLinks((current) => {
        const next = [...current];
        next[index] = payload.card?.scryfallUrl ?? null;
        return next;
      });
      setCommanderLookupStatus((current) => {
        const next = [...current];
        next[index] = payload.card?.scryfallUrl ? 'found' : 'idle';
        return next;
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to lookup commander.';
      setCommanderLookupStatus((current) => {
        const next = [...current];
        next[index] = 'error';
        return next;
      });
      setDeckFormError(message);
    }
  };

  const updateLogOpponentField = (opponentIndex: number, field: 'name' | 'colorIdentity', value: string) => {
    setLogOpponents((current) => {
      const next = [...current];
      if (next[opponentIndex]) {
        next[opponentIndex] = { ...next[opponentIndex], [field]: value };
      }
      return next;
    });
  };

  const updateLogOpponentCommander = (opponentIndex: number, commanderIndex: number, value: string) => {
    setLogOpponents((current) => {
      const next = [...current];
      const opponent = next[opponentIndex];
      if (opponent) {
        const commanders = [...opponent.commanders];
        commanders[commanderIndex] = { name: value, link: null, lookupStatus: 'idle' };
        next[opponentIndex] = { ...opponent, commanders };
      }
      return next;
    });
  };

  const addLogOpponentCommander = (opponentIndex: number) => {
    setLogOpponents((current) => {
      const next = [...current];
      const opponent = next[opponentIndex];
      if (opponent && opponent.commanders.length < 2) {
        next[opponentIndex] = {
          ...opponent,
          commanders: [...opponent.commanders, { name: '', link: null, lookupStatus: 'idle' }]
        };
      }
      return next;
    });
  };

  const removeLogOpponentCommander = (opponentIndex: number, commanderIndex: number) => {
    setLogOpponents((current) => {
      const next = [...current];
      const opponent = next[opponentIndex];
      if (opponent && opponent.commanders.length > 1) {
        const commanders = opponent.commanders.filter((_, i) => i !== commanderIndex);
        next[opponentIndex] = { ...opponent, commanders };
      }
      return next;
    });
  };

  const lookupLogOpponentCommander = async (opponentIndex: number, commanderIndex: number) => {
    if (!idToken) {
      setLogFormError('Sign in with Google to search commanders.');
      return;
    }
    const commanderName = logOpponents[opponentIndex]?.commanders[commanderIndex]?.name?.trim();
    if (!commanderName) {
      return;
    }
    setLogOpponents((current) => {
      const next = [...current];
      const opponent = next[opponentIndex];
      if (opponent) {
        const commanders = [...opponent.commanders];
        commanders[commanderIndex] = { ...commanders[commanderIndex], lookupStatus: 'loading' };
        next[opponentIndex] = { ...opponent, commanders };
      }
      return next;
    });
    setLogFormError(null);
    try {
      const response = await fetch(buildApiUrl('/api/scryfall/lookup'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: commanderName })
      });
      const payload = await response.json() as { success?: boolean; error?: string; card?: { name: string; scryfallUrl: string | null } | null };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to lookup commander.');
      }
      if (!payload.card) {
        setLogOpponents((current) => {
          const next = [...current];
          const opponent = next[opponentIndex];
          if (opponent) {
            const commanders = [...opponent.commanders];
            commanders[commanderIndex] = { ...commanders[commanderIndex], link: null, lookupStatus: 'not-found' };
            next[opponentIndex] = { ...opponent, commanders };
          }
          return next;
        });
        return;
      }
      setLogOpponents((current) => {
        const next = [...current];
        const opponent = next[opponentIndex];
        if (opponent) {
          const commanders = [...opponent.commanders];
          commanders[commanderIndex] = {
            name: payload.card?.name || commanderName,
            link: payload.card?.scryfallUrl ?? null,
            lookupStatus: payload.card?.scryfallUrl ? 'found' : 'idle'
          };
          next[opponentIndex] = { ...opponent, commanders };
        }
        return next;
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to lookup commander.';
      setLogOpponents((current) => {
        const next = [...current];
        const opponent = next[opponentIndex];
        if (opponent) {
          const commanders = [...opponent.commanders];
          commanders[commanderIndex] = { ...commanders[commanderIndex], lookupStatus: 'error' };
          next[opponentIndex] = { ...opponent, commanders };
        }
        return next;
      });
      setLogFormError(message);
    }
  };
  const parseOptionalNumberInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  };

  const handleSaveLog = async () => {
    if (!logTarget) {
      setLogFormError('Choose a deck to log.');
      return;
    }
    setLogFormError(null);
    const success = await addLog({
      deckId: logTarget.id,
      datePlayed: logDate || today,
      turns: parseOptionalNumberInput(logTurns),
      durationMinutes: parseOptionalNumberInput(logDurationMinutes),
      opponentsCount: logOpponents.length,
      opponents: logOpponents.map((opponent) => ({
        name: opponent.name.trim(),
        commanderNames: opponent.commanders
          .map((cmd) => cmd.name.trim())
          .filter((name) => name.length > 0),
        commanderLinks: opponent.commanders
          .filter((cmd) => cmd.name.trim().length > 0)
          .map((cmd) => cmd.link),
        colorIdentity: opponent.colorIdentity.trim()
      })),
      result: logResult === 'pending' ? null : logResult,
      tags: logTags
    });
    if (success) {
      setLogTarget(null);
      resetLogForm();
      if (onRefreshDecks) {
        await onRefreshDecks();
      }
    }
  };

  const renderCommanderList = (deck: DeckEntry) => {
    if (deck.commanderNames.length === 0) {
      return '—';
    }
    return deck.commanderNames.map((name, index) => {
      const link = deck.commanderLinks?.[index] ?? null;
      const key = `${deck.id}-commander-${index}`;
      return (
        <span key={key} className="inline-flex items-center">
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="text-cyan-200 hover:text-cyan-100"
              onMouseEnter={(event) => {
                anchorRef.current = event.currentTarget;
                const rect = event.currentTarget.getBoundingClientRect();
                setHoverCard({ label: name, rect });
              }}
            >
              {name}
            </a>
          ) : (
            <span>{name}</span>
          )}
          {index < deck.commanderNames.length - 1 && <span className="text-gray-500">, </span>}
        </span>
      );
    });
  };

  if (!enabled) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-gray-900/70 border border-gray-700 rounded-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-semibold mb-3">Your Decks</h2>
        <p className="text-gray-300">
          Google login is not configured. Set `VITE_GOOGLE_CLIENT_ID` to enable deck collections.
        </p>
      </div>
    );
  }

  if (!idToken) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-gray-900/70 border border-gray-700 rounded-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-semibold mb-3">Your Decks</h2>
        <p className="text-gray-300">
          Sign in from the Profile page to start saving decks to your collection.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto flex h-full min-h-0 flex-col gap-6">
      {deckError && <p className="text-red-400">{deckError}</p>}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-gray-900/70 border border-gray-700 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Your Deck Collection</h3>
            <p className="text-sm text-gray-400">
              Save decks, track stats, and launch Oracle tools from a single list.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-gray-900 shadow hover:bg-cyan-400"
          >
            <span className="text-lg leading-none">+</span>
            Deck
          </button>
        </div>
        <div className="mt-6 flex flex-1 min-h-0 flex-col overflow-hidden">
          {loading && <p className="text-gray-400">Loading...</p>}
          {!loading && decks.length === 0 && (
            <p className="text-gray-400">No decks yet. Use + Deck to add your first deck.</p>
          )}
          {decks.length > 0 && (
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-gray-800 bg-gray-950/60">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 px-4 py-2">
                <span className="text-xs uppercase tracking-wide text-gray-500">Decks</span>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <label className="text-xs uppercase tracking-wide text-gray-500" htmlFor="deck-sort">
                    Sort
                  </label>
                  <select
                    id="deck-sort"
                    value={sortKey}
                    onChange={(event) => handleSortChange(event.target.value as SortKey)}
                    className="rounded-md border border-gray-700 bg-gray-900/80 px-2 py-1 text-xs text-gray-200"
                  >
                    {Object.entries(sortLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                    className="rounded-md border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-200 hover:border-cyan-400 hover:text-cyan-200"
                    aria-label={`Sort ${sortDir === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    {sortDir === 'asc' ? '^' : 'v'}
                  </button>
                </div>
              </div>
              <div className="relative flex-1 min-h-0 overflow-hidden">
                <div
                  ref={deckListRef}
                  onScroll={updateScrollHint}
                  className="h-full overflow-y-scroll"
                >
                <div className="divide-y divide-gray-800">
                  {sortedDecks.map((deck) => (
                    <div key={deck.id} className="flex flex-col gap-1 px-4 py-2">
                      <div className="grid grid-cols-[minmax(0,1fr)_6rem_6rem] grid-rows-[auto_auto] items-center gap-x-3 gap-y-0.5 sm:grid-cols-[minmax(0,1fr)_8rem_8rem] sm:gap-x-4">
                      <div className="min-w-0 row-start-1 col-start-1">
                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                          {deck.url ? (
                            <a
                              href={deck.url}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-sm font-semibold text-cyan-300 hover:text-cyan-200 sm:text-base"
                            >
                              {deck.name}
                            </a>
                          ) : (
                            <p className="truncate text-sm font-semibold text-white sm:text-base">{deck.name}</p>
                          )}
                          {deck.commanderNames.length > 0 && (
                            <span className="truncate text-xs text-gray-400 sm:text-sm">
                              {renderCommanderList(deck)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="row-start-1 col-start-2 flex w-24 items-center justify-start justify-self-start text-left pr-1 sm:w-32 sm:pr-2">
                        {deck.colorIdentity && <ColorIdentityIcons colors={deck.colorIdentity} />}
                      </div>
                      <div className="row-start-1 col-start-3 flex w-24 items-center justify-end gap-0.5 sm:w-32 sm:gap-1">
                        {deck.url && onOpenInOracle && isSupportedDeckUrl(deck.url) && (
                          <button
                            type="button"
                            onClick={() => onOpenInOracle(deck.url!)}
                            className="inline-flex h-7 w-7 items-center justify-center text-gray-300 hover:text-cyan-300 sm:h-8 sm:w-8"
                            aria-label={`Open ${deck.name} in Oracle`}
                            title="Open in Oracle"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="h-4 w-4 sm:h-5 sm:w-5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <circle cx="12" cy="12" r="4" />
                              <path d="M12 2v4" />
                              <path d="M12 18v4" />
                              <path d="M2 12h4" />
                              <path d="M18 12h4" />
                            </svg>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditModal(deck)}
                          className="inline-flex h-7 w-7 items-center justify-center text-gray-300 hover:text-cyan-300 sm:h-8 sm:w-8"
                          aria-label={`Edit ${deck.name}`}
                          title="Edit deck"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4 sm:h-5 sm:w-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => openLogModal(deck)}
                          className="inline-flex h-7 w-7 items-center justify-center text-gray-300 hover:text-emerald-300 sm:h-8 sm:w-8"
                          aria-label={`Log game for ${deck.name}`}
                          title="Log game"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4 sm:h-5 sm:w-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 8v8" />
                            <path d="M8 12h8" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(deck)}
                          className="inline-flex h-7 w-7 items-center justify-center text-gray-300 hover:text-red-300 sm:h-8 sm:w-8"
                          aria-label={`Remove ${deck.name}`}
                          title="Delete"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4 sm:h-5 sm:w-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                          </svg>
                        </button>
                      </div>
                      <div className="row-start-2 col-start-1 grid grid-cols-[4.5rem_3.5rem_4rem_7rem] items-center gap-2 text-[11px] text-gray-400 sm:grid-cols-[5rem_4rem_4.5rem_8.5rem] sm:gap-3 sm:text-xs">
                        <span>
                          Games <span className="text-gray-200">{getTotalGames(deck)}</span>
                        </span>
                        {deck.stats && getTotalGames(deck) > 0 ? (
                          <>
                            <span>
                              Wins <span className="text-gray-200">{deck.stats.wins}</span>
                            </span>
                            <span>
                              Rate <span className="text-gray-200">{formatWinRate(deck.stats.winRate)}</span>
                            </span>
                            <span className="whitespace-nowrap">
                              Last played{' '}
                              <span className="text-gray-200">
                                {formatLastPlayed(deck.stats.lastPlayed)}
                              </span>
                            </span>
                          </>
                        ) : (
                          <>
                            <span aria-hidden="true" />
                            <span aria-hidden="true" />
                            <span aria-hidden="true" />
                          </>
                        )}
                      </div>
                      <div className="row-start-2 col-start-2 flex w-24 items-start justify-start justify-self-start text-left pr-1 sm:w-32 sm:pr-2">
                        {deck.colorIdentity && (
                          <span className="text-[10px] uppercase tracking-wide text-gray-500">
                            {getColorIdentityLabel(deck.colorIdentity)}
                          </span>
                        )}
                      </div>
                      <div className="row-start-2 col-start-3" aria-hidden="true" />
                    </div>
                    </div>
                  ))}
                </div>
                </div>
                {showScrollHint && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-gray-950" />
                )}
              </div>
            </div>
          )}
      </div>
    </div>

      {deckModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-950/70 px-4 py-6 sm:items-center sm:py-8">
          <div className="w-full max-w-xl rounded-2xl border border-gray-700 bg-gray-900 p-6 sm:p-8">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-lg font-semibold">{editTarget ? 'Edit deck' : 'Add deck'}</h3>
                <p className="text-sm text-gray-400">
                  Add a deck link to auto-fill details from Archidekt or Moxfield or enter them manually.
                </p>
              </div>
              <label className="text-sm text-gray-300" htmlFor="deck-link-input">
                Deck link (optional)
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="deck-link-input"
                  type="url"
                  value={deckUrl}
                  onChange={(event) => {
                    setDeckUrl(event.target.value);
                    setDeckPreviewError(null);
                  }}
                  placeholder="https://..."
                  className="flex-1 px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={handlePreviewDeck}
                  disabled={!isSupportedDeckUrl(deckUrl) || deckPreviewLoading}
                  className="px-4 py-3 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800 disabled:opacity-60"
                >
                  {deckPreviewLoading ? 'Loading...' : 'Load deck'}
                </button>
              </div>
              <p className="text-xs text-gray-500">Load deck supports Archidekt and Moxfield deck links.</p>
              <label className="text-sm text-gray-300" htmlFor="deck-name-input">
                Deck name (required)
              </label>
                <input
                  id="deck-name-input"
                  type="text"
                  value={deckName}
                  onChange={(event) => {
                    setDeckName(event.target.value);
                    setDeckFormError(null);
                  }}
                  placeholder="My custom deck"
                  className="px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-300" htmlFor="deck-commander-input-0">
                  Commander(s) (optional)
                </label>
                {commanderInputs.length < 2 && (
                  <button
                    type="button"
                    onClick={addCommanderInput}
                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300"
                  >
                    + Commander
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-3">
                {commanderInputs.map((value, index) => (
                  <div key={`commander-input-${index}`} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        id={`deck-commander-input-${index}`}
                        type="text"
                        value={value}
                        onChange={(event) => updateCommanderInput(index, event.target.value)}
                        placeholder="Commander name"
                        aria-label="Commander name"
                        className="flex-1 px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={() => lookupCommander(index)}
                        disabled={!value.trim() || commanderLookupStatus[index] === 'loading'}
                        className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-gray-800 disabled:opacity-60"
                        aria-label="Lookup commander"
                        title="Lookup commander"
                      >
                        Scryfall
                      </button>
                      {index === 1 && (
                        <button
                          type="button"
                          onClick={removeSecondCommander}
                          className="text-gray-400 hover:text-red-300"
                          aria-label="Remove commander"
                          title="Remove commander"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                            <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                    {commanderLookupStatus[index] === 'loading' && (
                      <p className="text-xs text-gray-400">Searching Scryfall...</p>
                    )}
                    {commanderLookupStatus[index] === 'not-found' && (
                      <p className="text-xs text-amber-300">No card found in Scryfall.</p>
                    )}
                    {commanderLookupStatus[index] === 'error' && (
                      <p className="text-xs text-red-400">Lookup failed.</p>
                    )}
                    {commanderLookupLinks[index] && (
                      <a
                      href={commanderLookupLinks[index] ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-cyan-300 hover:text-cyan-200"
                      >
                        View on Scryfall
                      </a>
                    )}
                  </div>
                ))}
              </div>
              <ColorIdentitySelect
                label="Color identity (optional)"
                value={deckColor}
                onChange={setDeckColor}
              />
              {(deckFormError || deckPreviewError) && (
                <p className="text-red-400">{deckFormError || deckPreviewError}</p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    resetDeckForm();
                    closeDeckModal();
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDeck}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-cyan-500 text-gray-900 font-semibold hover:bg-cyan-400 disabled:opacity-60"
                >
                  {loading ? 'Saving...' : editTarget ? 'Save Deck' : 'Add Deck'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {logTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-950/70 px-4 py-6 sm:items-center sm:py-8">
          <div className="w-full max-w-3xl rounded-2xl border border-gray-700 bg-gray-900 p-6 sm:p-8">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Log a game</h3>
                  <p className="text-sm text-gray-400">{logTarget.name}</p>
                </div>
                {logStatusMessage && (
                  <span className="text-xs text-emerald-300">{logStatusMessage}</span>
                )}
              </div>
              <label className="flex flex-col gap-2 text-sm text-gray-300">
                Date played
                <input
                  type="date"
                  value={logDate}
                  onChange={(event) => setLogDate(event.target.value)}
                  className="px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm text-gray-300">
                  Number of turns (optional)
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={logTurns}
                    onChange={(event) => setLogTurns(event.target.value)}
                    className="px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-gray-300">
                  Length (minutes, optional)
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={logDurationMinutes}
                    onChange={(event) => setLogDurationMinutes(event.target.value)}
                    className="px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </label>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-300">Opponents</p>
                  {logOpponents.length === 0 && (
                    <button
                      type="button"
                      onClick={addLogOpponent}
                      className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
                      </svg>
                      Add opponent
                    </button>
                  )}
                </div>
                {logOpponents.length === 0 && (
                  <p className="text-xs text-gray-500">No opponents added yet.</p>
                )}
                {logOpponents.map((opponent, opponentIndex) => (
                  <div
                    key={`${logTarget.id}-opponent-${opponentIndex}`}
                    className="rounded-lg border border-gray-700 bg-gray-800/50 p-3"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={opponent.name}
                          onChange={(event) => updateLogOpponentField(opponentIndex, 'name', event.target.value)}
                          placeholder="Name"
                          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-gray-800 text-white text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                        <div className="flex-1 min-w-0">
                          <ColorIdentitySelect
                            label=""
                            value={opponent.colorIdentity}
                            onChange={(value) => updateLogOpponentField(opponentIndex, 'colorIdentity', value)}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLogOpponent(opponentIndex)}
                          className="text-gray-500 hover:text-red-400 p-1"
                          aria-label={`Remove opponent ${opponentIndex + 1}`}
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex flex-col gap-2">
                        <p className="text-xs text-gray-400">Commanders (0-2)</p>
                        {opponent.commanders.map((commander, cmdIndex) => (
                          <div key={cmdIndex} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={commander.name}
                              onChange={(event) => updateLogOpponentCommander(opponentIndex, cmdIndex, event.target.value)}
                              placeholder={`Commander ${cmdIndex + 1}`}
                              className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-gray-800 text-white text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                            <button
                              type="button"
                              onClick={() => lookupLogOpponentCommander(opponentIndex, cmdIndex)}
                              disabled={!commander.name.trim() || commander.lookupStatus === 'loading'}
                              className="rounded-lg border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-200 hover:bg-gray-800 disabled:opacity-60"
                              aria-label="Lookup commander"
                              title="Lookup commander on Scryfall"
                            >
                              {commander.lookupStatus === 'loading' ? '...' : 'Scryfall'}
                            </button>
                            {opponent.commanders.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeLogOpponentCommander(opponentIndex, cmdIndex)}
                                className="text-gray-500 hover:text-red-400 p-1"
                                aria-label={`Remove commander ${cmdIndex + 1}`}
                              >
                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                        {opponent.commanders.some((cmd) => cmd.lookupStatus === 'not-found') && (
                          <p className="text-xs text-amber-300">Card not found on Scryfall.</p>
                        )}
                        {opponent.commanders.some((cmd) => cmd.lookupStatus === 'error') && (
                          <p className="text-xs text-red-400">Lookup failed.</p>
                        )}
                        {opponent.commanders.some((cmd) => cmd.link) && (
                          <div className="flex flex-wrap gap-2">
                            {opponent.commanders
                              .filter((cmd) => cmd.link)
                              .map((cmd, i) => (
                                <a
                                  key={i}
                                  href={cmd.link!}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-cyan-300 hover:text-cyan-200"
                                >
                                  {cmd.name} on Scryfall
                                </a>
                              ))}
                          </div>
                        )}
                        {opponent.commanders.length < 2 && (
                          <button
                            type="button"
                            onClick={() => addLogOpponentCommander(opponentIndex)}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-cyan-300"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                              <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
                            </svg>
                            Add partner commander
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {logOpponents.length > 0 && (
                  <button
                    type="button"
                    onClick={addLogOpponent}
                    className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-gray-600 py-2 text-sm text-gray-400 hover:border-gray-500 hover:text-gray-300"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
                    </svg>
                    Add another opponent
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLogResult('win')}
                    className={`px-4 py-2 rounded-full text-sm border transition ${
                      logResult === 'win'
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                        : 'border-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    Win
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogResult('loss')}
                    className={`px-4 py-2 rounded-full text-sm border transition ${
                      logResult === 'loss'
                        ? 'border-rose-400 bg-rose-500/20 text-rose-100'
                        : 'border-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    Loss
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogResult('pending')}
                    className={`px-4 py-2 rounded-full text-sm border transition ${
                      logResult === 'pending'
                        ? 'border-gray-400 bg-gray-700/40 text-gray-100'
                        : 'border-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    Later
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-sm text-gray-300">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {PREDEFINED_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleLogTag(tag)}
                      className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm border transition ${
                        logTags.includes(tag)
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                          : 'border-gray-700 text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                        {logTags.includes(tag) ? (
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        ) : (
                          <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
                        )}
                      </svg>
                      {tag}
                    </button>
                  ))}
                  {logTags
                    .filter((tag) => !PREDEFINED_TAGS.includes(tag as typeof PREDEFINED_TAGS[number]))
                    .map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleLogTag(tag)}
                        className="flex items-center gap-1 px-3 py-1 rounded-full text-sm border border-cyan-400 bg-cyan-500/20 text-cyan-100 transition"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {tag}
                      </button>
                    ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={logCustomTagInput}
                    onChange={(e) => setLogCustomTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addLogCustomTag();
                      }
                    }}
                    placeholder="Add custom tag..."
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-gray-800 text-white text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={addLogCustomTag}
                    disabled={!logCustomTagInput.trim()}
                    className="px-3 py-2 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800 disabled:opacity-60"
                  >
                    Add
                  </button>
                </div>
              </div>
              {(logFormError || logError) && (
                <p className="text-xs text-red-400">{logFormError || logError}</p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setLogTarget(null);
                    resetLogForm();
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveLog}
                  disabled={logLoading}
                  className="px-4 py-2 rounded-lg bg-cyan-500 text-gray-900 font-semibold hover:bg-cyan-400 disabled:opacity-60"
                >
                  {logLoading ? 'Saving...' : 'Save log'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-950/70 px-4 py-6 sm:items-center sm:py-8">
          <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 sm:p-8">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-lg font-semibold">Remove deck?</h3>
                <p className="text-sm text-gray-400">
                  This will remove <span className="text-gray-200">{deleteTarget.name}</span> from your collection.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const deckId = deleteTarget.id;
                    setDeleteTarget(null);
                    await onRemoveDeck(deckId);
                  }}
                  className="px-4 py-2 rounded-lg bg-red-500/80 text-white font-semibold hover:bg-red-500"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {hoverCard && imageUrl && hoverPosition && createPortal(
        <div
          className="fixed z-50"
          style={
            hoverPosition.placement === 'above'
              ? { left: hoverPosition.left, bottom: hoverPosition.bottom }
              : { left: hoverPosition.left, top: hoverPosition.top }
          }
          ref={popupRef}
        >
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-2 shadow-2xl">
            <img
              src={imageUrl}
              alt={hoverCard.label}
              className="h-auto w-auto max-h-96 max-w-72 rounded object-contain"
              loading="lazy"
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
