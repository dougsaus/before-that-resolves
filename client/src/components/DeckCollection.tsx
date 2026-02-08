import { useEffect, useMemo, useRef, useState, type RefCallback } from 'react';
import { createPortal } from 'react-dom';
import { ColorIdentityIcons, ColorIdentitySelect } from './ColorIdentitySelect';
import { COLOR_OPTIONS, getColorIdentityLabel, sortColorsForDisplay } from '../utils/color-identity';
import { useGameLogs } from '../hooks/useGameLogs';
import { useOpponentDecks, type OpponentDeck } from '../hooks/useOpponentDecks';
import { useOpponentUsers, type OpponentUser } from '../hooks/useOpponentUsers';
import { buildApiUrl } from '../utils/api';
import { parseLocalDate } from '../utils/date';
import type { AuthStatus } from '../types/auth';

const PREDEFINED_TAGS = [
  'mulligan',
  'missed land drops',
  'poor card draw',
  'god hand',
  'bad opening hand',
  'scooped'
] as const;

type ChallengeIdentity = {
  key: string;
  label: string;
  colors: string[];
};

const CHALLENGE_IDENTITIES: ChallengeIdentity[] = COLOR_OPTIONS
  .filter((option): option is { value: string; label: string; colors: string[] } => option.colors !== null)
  .map((option) => ({
    key: option.colors.length === 0 ? 'C' : sortColorsForDisplay(option.colors).join(''),
    label: option.label,
    colors: option.colors
  }));

const CHALLENGE_IDENTITY_BY_KEY = new Map(CHALLENGE_IDENTITIES.map((identity) => [identity.key, identity]));
const CHALLENGE_IDENTITY_KEYS = new Set(CHALLENGE_IDENTITIES.map((identity) => identity.key));
const CHALLENGE_LEFT_COLUMN_KEYS = [
  'WUBRG',
  'WUBR',
  'UBRG',
  'BRGW',
  'RGWU',
  'GWUB',
  'WUB',
  'UBR',
  'BRG',
  'RGW',
  'GWU',
  'WBG',
  'URW',
  'BGU',
  'RWB',
  'GRU'
] as const;
const CHALLENGE_RIGHT_COLUMN_KEYS = [
  'WU',
  'UB',
  'BR',
  'RG',
  'GW',
  'WB',
  'UR',
  'BG',
  'RW',
  'GU',
  'W',
  'U',
  'B',
  'R',
  'G',
  'C'
] as const;

const CHALLENGE_LEFT_COLUMN = CHALLENGE_LEFT_COLUMN_KEYS
  .map((key) => CHALLENGE_IDENTITY_BY_KEY.get(key))
  .filter((identity): identity is ChallengeIdentity => Boolean(identity));
const CHALLENGE_RIGHT_COLUMN = CHALLENGE_RIGHT_COLUMN_KEYS
  .map((key) => CHALLENGE_IDENTITY_BY_KEY.get(key))
  .filter((identity): identity is ChallengeIdentity => Boolean(identity));

function formatWinRate(winRate: number | null): string {
  if (winRate === null) return '—';
  return `${Math.round(winRate * 100)}%`;
}

function formatLastPlayed(lastPlayed: string | null): string {
  if (!lastPlayed) return '—';
  const date = parseLocalDate(lastPlayed);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatOpponentUserLabel(user: { name?: string | null; email?: string | null }): string {
  const name = user.name?.trim() ?? '';
  const email = user.email?.trim() ?? '';
  if (name && email) return `${name} <${email}>`;
  return name || email || 'Unknown user';
}

function createLogOpponent(): OpponentForm {
  return {
    id: crypto.randomUUID(),
    userId: null,
    userLabel: null,
    searchMessage: null,
    searchStatus: null,
    name: '',
    email: null,
    deckId: null,
    deckName: null,
    deckUrl: null,
    commanders: [{ name: '', link: null, lookupStatus: 'idle' }],
    colorIdentity: ''
  };
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

function getProfileSource(input: string): 'archidekt' | 'moxfield' | null {
  if (!input.trim()) return null;
  try {
    const parsed = new URL(input);
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (parsed.host.includes('archidekt.com')) {
      if (segments.includes('decks')) return null;
      return segments.includes('u') ? 'archidekt' : null;
    }
    if (parsed.host.includes('moxfield.com')) {
      if (segments.includes('decks')) return null;
      return segments.includes('users') || segments.includes('user') ? 'moxfield' : null;
    }
    return null;
  } catch {
    return null;
  }
}

function isSupportedProfileUrl(input: string): boolean {
  return getProfileSource(input) !== null;
}

function formatColorValue(colors: string[] | null): string {
  if (!colors) return '';
  if (colors.length === 0) return 'C';
  return sortColorsForDisplay(colors).join('');
}

function formatCommanderList(commanders: string[]): string {
  if (commanders.length === 0) return 'No commander';
  return commanders.join(' / ');
}

function formatOpponentDeckLabel(deck: OpponentDeck): string {
  return `${deck.name} — ${formatCommanderList(deck.commanderNames)}`;
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

export type DeckImportCandidate = {
  id: string;
  name: string;
  format: string | null;
  url: string;
  source: 'archidekt' | 'moxfield';
};

export type DeckImportPreviewResult = {
  decks?: DeckImportCandidate[];
  error?: string;
};

export type DeckImportFailure = {
  deckUrl: string;
  error: string;
};

export type DeckImportResult = {
  success: boolean;
  failures?: DeckImportFailure[];
  error?: string;
};

type CommanderEntry = {
  name: string;
  link: string | null;
  lookupStatus: 'idle' | 'loading' | 'found' | 'not-found' | 'error';
};

type OpponentForm = {
  id: string;
  userId: string | null;
  userLabel: string | null;
  searchMessage: string | null;
  searchStatus: 'matched' | 'not-found' | 'multiple' | 'error' | null;
  name: string;
  email: string | null;
  deckId: string | null;
  deckName: string | null;
  deckUrl: string | null;
  commanders: CommanderEntry[];
  colorIdentity: string;
};

type DeckCollectionProps = {
  enabled: boolean;
  authStatus: AuthStatus;
  authError: string | null;
  authButtonRef: RefCallback<HTMLDivElement>;
  onAuthExpired: (message?: string) => void;
  decks: DeckEntry[];
  loading: boolean;
  deckError: string | null;
  onCreateDeck: (input: DeckFormInput) => Promise<boolean>;
  onUpdateDeck: (deckId: string, input: DeckFormInput) => Promise<boolean>;
  onPreviewDeck: (deckUrl: string) => Promise<DeckPreviewResult>;
  onPreviewBulkDecks: (profileUrl: string) => Promise<DeckImportPreviewResult>;
  onRemoveDeck: (deckId: string) => Promise<void>;
  onBulkImportDecks: (deckUrls: string[]) => Promise<DeckImportResult>;
  onOpenInOracle?: (deckUrl: string) => void;
  onRefreshDecks?: () => Promise<void>;
  onLogSaved?: () => void;
};

export function DeckCollection({
  enabled,
  authStatus,
  authError,
  authButtonRef,
  onAuthExpired,
  decks,
  loading,
  deckError,
  onCreateDeck,
  onUpdateDeck,
  onPreviewDeck,
  onPreviewBulkDecks,
  onRemoveDeck,
  onBulkImportDecks,
  onOpenInOracle,
  onRefreshDecks,
  onLogSaved
}: DeckCollectionProps) {
  const isAuthenticated = authStatus === 'authenticated';
  const authExpired = authStatus === 'expired';
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
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkProfileUrl, setBulkProfileUrl] = useState('');
  const [bulkDecks, setBulkDecks] = useState<DeckImportCandidate[]>([]);
  const [bulkSelection, setBulkSelection] = useState<Record<string, boolean>>({});
  const [bulkPreviewError, setBulkPreviewError] = useState<string | null>(null);
  const [bulkImportError, setBulkImportError] = useState<string | null>(null);
  const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkFailures, setBulkFailures] = useState<DeckImportFailure[]>([]);
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
  const [challengeCollapsed, setChallengeCollapsed] = useState(true);
  const [hoverCard, setHoverCard] = useState<{ label: string; rect: DOMRect } | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLAnchorElement | null>(null);
  const imageUrl = useMemo(() => (hoverCard ? getScryfallImageUrl(hoverCard.label) : null), [hoverCard]);
  const opponentDropdownRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const jsonHeaders = useMemo(() => ({
    'Content-Type': 'application/json'
  }), []);
  const handleAuthFailure = (payload: { error?: string; code?: string }, response: Response, onError?: (message: string) => void) => {
    if (response.status !== 401) return false;
    const message = payload.error || 'Session expired. Sign in again to continue.';
    if (payload.code === 'auth_expired') {
      onAuthExpired(message);
    }
    if (onError) {
      onError(message);
    }
    return true;
  };
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
  } = useGameLogs({ authStatus, onAuthExpired }, { autoLoad: false });
  const {
    recentOpponents,
    recentError,
    recentLoading,
    searchResults,
    searchError,
    searchLoading,
    loadRecentOpponents,
    searchOpponents,
    clearSearch
  } = useOpponentUsers({ authStatus, onAuthExpired });
  const {
    decksByUserId,
    loadingByUserId: decksLoadingByUserId,
    errorByUserId: decksErrorByUserId,
    loadOpponentDecks
  } = useOpponentDecks({ authStatus, onAuthExpired });
  const [recentOpenIndex, setRecentOpenIndex] = useState<number | null>(null);
  const [searchOpenIndex, setSearchOpenIndex] = useState<number | null>(null);
  useEffect(() => {
    const update = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  useEffect(() => {
    if (recentOpenIndex === null && searchOpenIndex === null) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (opponentDropdownRef.current?.contains(target)) return;
      setRecentOpenIndex(null);
      setSearchOpenIndex(null);
      clearSearch();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [clearSearch, recentOpenIndex, searchOpenIndex]);
  useEffect(() => {
    if (!logTarget || !isAuthenticated) return;
    void loadRecentOpponents();
  }, [isAuthenticated, loadRecentOpponents, logTarget]);

  useEffect(() => {
    if (!logTarget) return;
    logOpponents.forEach((opponent) => {
      if (opponent.userId) {
        void loadOpponentDecks(opponent.userId);
      }
    });
  }, [logOpponents, logTarget, loadOpponentDecks]);

  useEffect(() => {
    if (searchOpenIndex === null || !searchError) return;
    setLogOpponents((current) => {
      const next = [...current];
      if (next[searchOpenIndex]) {
        next[searchOpenIndex] = {
          ...next[searchOpenIndex],
          searchMessage: searchError,
          searchStatus: 'error'
        };
      }
      return next;
    });
  }, [searchError, searchOpenIndex]);

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
  const challengeDecksByIdentity = useMemo(() => {
    const decksByIdentity = new Map<string, DeckEntry[]>();
    CHALLENGE_IDENTITIES.forEach((identity) => {
      decksByIdentity.set(identity.key, []);
    });

    const decksByName = [...decks].sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
    );
    decksByName.forEach((deck) => {
      const colorKey = formatColorValue(deck.colorIdentity);
      if (!colorKey || !CHALLENGE_IDENTITY_KEYS.has(colorKey)) {
        return;
      }
      const existing = decksByIdentity.get(colorKey);
      if (!existing) {
        return;
      }
      existing.push(deck);
    });
    return decksByIdentity;
  }, [decks]);
  const challengeCompletedCount = useMemo(() => {
    let completed = 0;
    CHALLENGE_IDENTITIES.forEach((identity) => {
      if ((challengeDecksByIdentity.get(identity.key) ?? []).length > 0) {
        completed += 1;
      }
    });
    return completed;
  }, [challengeDecksByIdentity]);
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

  const resetBulkForm = () => {
    setBulkProfileUrl('');
    setBulkDecks([]);
    setBulkSelection({});
    setBulkPreviewError(null);
    setBulkImportError(null);
    setBulkPreviewLoading(false);
    setBulkImporting(false);
    setBulkFailures([]);
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

  const openBulkModal = () => {
    resetBulkForm();
    setBulkModalOpen(true);
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

  const closeBulkModal = () => {
    setBulkModalOpen(false);
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
    setRecentOpenIndex(null);
    setSearchOpenIndex(null);
    clearSearch();
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
    setLogOpponents((current) => [...current, createLogOpponent()]);
    setRecentOpenIndex(null);
    setSearchOpenIndex(null);
    clearSearch();
  };

  const removeLogOpponent = (index: number) => {
    setLogOpponents((current) => current.filter((_, i) => i !== index));
    setRecentOpenIndex(null);
    setSearchOpenIndex(null);
    clearSearch();
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

  const handleBulkPreview = async () => {
    const trimmedUrl = bulkProfileUrl.trim();
    if (!isSupportedProfileUrl(trimmedUrl)) return;
    setBulkPreviewLoading(true);
    setBulkPreviewError(null);
    setBulkImportError(null);
    setBulkFailures([]);
    const result = await onPreviewBulkDecks(trimmedUrl);
    setBulkPreviewLoading(false);
    if (result.error) {
      setBulkPreviewError(result.error);
      setBulkDecks([]);
      setBulkSelection({});
      return;
    }
    const decks = result.decks ?? [];
    setBulkDecks(decks);
    setBulkSelection(
      decks.reduce<Record<string, boolean>>((acc, deck) => {
        acc[deck.url] = true;
        return acc;
      }, {})
    );
    if (decks.length === 0) {
      setBulkPreviewError('No decks found for that profile.');
    }
  };

  const handleBulkImport = async () => {
    const selectedUrls = bulkDecks
      .filter((deck) => bulkSelection[deck.url])
      .map((deck) => deck.url);
    if (selectedUrls.length === 0) {
      setBulkImportError('Select at least one deck to import.');
      return;
    }
    setBulkImporting(true);
    setBulkImportError(null);
    const result = await onBulkImportDecks(selectedUrls);
    if (!result.success) {
      setBulkImportError(result.error || 'Unable to import decks.');
      setBulkImporting(false);
      return;
    }
    const failures = result.failures ?? [];
    setBulkFailures(failures);
    if (failures.length === 0) {
      resetBulkForm();
      closeBulkModal();
      setBulkImporting(false);
      return;
    }
    const failedUrls = new Set(failures.map((failure) => failure.deckUrl));
    setBulkSelection(
      bulkDecks.reduce<Record<string, boolean>>((acc, deck) => {
        acc[deck.url] = failedUrls.has(deck.url);
        return acc;
      }, {})
    );
    setBulkImportError(`Imported ${selectedUrls.length - failures.length} deck(s). ${failures.length} failed.`);
    setBulkImporting(false);
  };

  const toggleBulkSelection = (deckUrl: string) => {
    setBulkSelection((current) => ({
      ...current,
      [deckUrl]: !current[deckUrl]
    }));
  };

  const setBulkSelectionAll = (checked: boolean) => {
    setBulkSelection(
      bulkDecks.reduce<Record<string, boolean>>((acc, deck) => {
        acc[deck.url] = checked;
        return acc;
      }, {})
    );
  };

  const bulkSelectedCount = useMemo(
    () => bulkDecks.filter((deck) => bulkSelection[deck.url]).length,
    [bulkDecks, bulkSelection]
  );

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
    if (!isAuthenticated) {
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
        headers: jsonHeaders,
        credentials: 'include',
        body: JSON.stringify({ name })
      });
      const text = await response.text();
      let payload: { success?: boolean; card?: { name: string; scryfallUrl: string | null }; error?: string; code?: string };
      try {
        payload = JSON.parse(text) as { success?: boolean; card?: { name: string; scryfallUrl: string | null }; error?: string; code?: string };
      } catch {
        throw new Error('Unexpected response from server.');
      }
      if (handleAuthFailure(payload, response, setDeckFormError)) {
        return;
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
        next[opponentIndex] = {
          ...next[opponentIndex],
          [field]: value,
          ...(field === 'name'
            ? { userId: null, userLabel: null, searchMessage: null, searchStatus: null, deckId: null, email: null }
            : {})
        };
      }
      return next;
    });
  };

  const applyLogOpponentUser = (opponentId: string, user: OpponentUser) => {
    const label = formatOpponentUserLabel(user);
    const displayName = (user.name ?? user.email ?? '').trim();
    setLogOpponents((current) => {
      const next = [...current];
      const index = next.findIndex((opponent) => opponent.id === opponentId);
      if (index === -1) return current;
      next[index] = {
        ...next[index],
        userId: user.id,
        name: displayName,
        email: user.email ?? null,
        userLabel: label,
        searchMessage: `Matched user: ${label}`,
        searchStatus: 'matched',
        deckId: null,
        deckName: null,
        deckUrl: null
      };
      return next;
    });
    void loadOpponentDecks(user.id);
    setRecentOpenIndex(null);
    setSearchOpenIndex(null);
    clearSearch();
  };

  const handleLogOpponentSearch = async (opponentIndex: number) => {
    if (!isAuthenticated) {
      setLogFormError('Sign in with Google to search opponents.');
      return;
    }
    const opponentId = logOpponents[opponentIndex]?.id;
    if (!opponentId) return;
    const query = logOpponents[opponentIndex]?.name?.trim() ?? '';
    if (!query) {
      setLogFormError('Enter a name or email to search.');
      return;
    }
    setLogFormError(null);
    setSearchOpenIndex(opponentIndex);
    setRecentOpenIndex(null);
    setLogOpponents((current) => {
      const next = [...current];
      const index = next.findIndex((opponent) => opponent.id === opponentId);
      if (index === -1) return current;
      next[index] = {
        ...next[index],
        searchMessage: null,
        searchStatus: null
      };
      return next;
    });
    const results = await searchOpponents(query);
    if (results.length === 1) {
      applyLogOpponentUser(opponentId, results[0]);
      return;
    }
    setLogOpponents((current) => {
      const next = [...current];
      const index = next.findIndex((opponent) => opponent.id === opponentId);
      if (index === -1) return current;
      next[index] = {
        ...next[index],
        searchMessage: results.length === 0
          ? 'No users found.'
          : 'Multiple users found. Select one.',
        searchStatus: results.length === 0 ? 'not-found' : 'multiple'
      };
      return next;
    });
  };

  const openRecentOpponents = async (opponentIndex: number) => {
    if (!isAuthenticated) {
      setLogFormError('Sign in with Google to view recent opponents.');
      return;
    }
    setLogFormError(null);
    const nextIndex = opponentIndex;
    setRecentOpenIndex(nextIndex);
    setSearchOpenIndex(null);
    clearSearch();
    if (nextIndex !== null && recentOpponents.length === 0 && !recentLoading) {
      await loadRecentOpponents();
    }
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

  const selectLogOpponentDeck = (opponentIndex: number, deckId: string) => {
    const currentOpponent = logOpponents[opponentIndex];
    const currentDeck = currentOpponent?.userId
      ? (decksByUserId[currentOpponent.userId] ?? []).find((entry) => entry.id === deckId)
      : null;
    setLogOpponents((current) => {
      const next = [...current];
      const opponent = next[opponentIndex];
      if (!opponent) return current;
      if (!deckId) {
        next[opponentIndex] = { ...opponent, deckId: null, deckName: null, deckUrl: null };
        return next;
      }
      const userId = opponent.userId;
      const decks = userId ? decksByUserId[userId] ?? [] : [];
      const deck = decks.find((entry) => entry.id === deckId);
      if (!deck) {
        next[opponentIndex] = { ...opponent, deckId };
        return next;
      }
      const commanders = deck.commanderNames.length > 0
        ? deck.commanderNames.map((name, idx) => ({
            name,
            link: deck.commanderLinks[idx] ?? null,
            lookupStatus: deck.commanderLinks[idx] ? 'found' as const : isAuthenticated ? 'loading' as const : 'idle' as const
          }))
        : [{ name: '', link: null, lookupStatus: 'idle' as const }];
      next[opponentIndex] = {
        ...opponent,
        deckId: deck.id,
        deckName: deck.name,
        deckUrl: deck.url ?? null,
        commanders,
        colorIdentity: formatColorValue(deck.colorIdentity)
      };
      return next;
    });
    const opponentId = logOpponents[opponentIndex]?.id;
    if (opponentId && currentDeck) {
      const commandersToResolve = currentDeck.commanderNames.map((name, idx) => ({
        name,
        link: currentDeck.commanderLinks[idx] ?? null
      }));
      void resolveCommanderLinks(opponentId, commandersToResolve);
      if (currentDeck.url) {
        void refreshOpponentDeckSummary(opponentId, currentDeck.url);
      }
    }
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
    if (!isAuthenticated) {
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
        headers: jsonHeaders,
        credentials: 'include',
        body: JSON.stringify({ name: commanderName })
      });
      const payload = await response.json() as { success?: boolean; error?: string; code?: string; card?: { name: string; scryfallUrl: string | null } | null };
      if (handleAuthFailure(payload, response, setLogFormError)) {
        return;
      }
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

  const resolveCommanderLinks = async (
    opponentId: string,
    commanders: Array<{ name: string; link: string | null }>
  ) => {
    if (!isAuthenticated) return;
    const missing = commanders
      .map((commander, index) => ({ ...commander, index }))
      .filter((commander) => commander.name.trim().length > 0 && !commander.link);
    if (missing.length === 0) return;
    try {
      const resolved = await Promise.all(
        missing.map(async (commander) => {
          const response = await fetch(buildApiUrl('/api/scryfall/lookup'), {
            method: 'POST',
            headers: jsonHeaders,
            credentials: 'include',
            body: JSON.stringify({ name: commander.name })
          });
          const payload = await response.json() as {
            success?: boolean;
            error?: string;
            code?: string;
            card?: { name: string; scryfallUrl: string | null } | null;
          };
          if (handleAuthFailure(payload, response, setLogFormError)) {
            return { index: commander.index, name: commander.name, link: null, status: 'error' as const };
          }
          if (!response.ok || !payload.success) {
            return { index: commander.index, name: commander.name, link: null, status: 'error' as const };
          }
          if (!payload.card) {
            return { index: commander.index, name: commander.name, link: null, status: 'not-found' as const };
          }
          return {
            index: commander.index,
            name: payload.card.name || commander.name,
            link: payload.card.scryfallUrl ?? null,
            status: payload.card.scryfallUrl ? 'found' as const : 'idle' as const
          };
        })
      );
      setLogOpponents((current) => {
        const next = [...current];
        const index = next.findIndex((opponent) => opponent.id === opponentId);
        if (index === -1) return current;
        const opponent = next[index];
        const updated = [...opponent.commanders];
        resolved.forEach((result) => {
          if (!updated[result.index]) return;
          updated[result.index] = {
            ...updated[result.index],
            name: result.name,
            link: result.link,
            lookupStatus: result.status
          };
        });
        next[index] = { ...opponent, commanders: updated };
        return next;
      });
    } catch {
      // Ignore lookup failures; manual Scryfall button still available.
    }
  };

  const refreshOpponentDeckSummary = async (opponentId: string, deckUrl: string) => {
    if (!isAuthenticated || !deckUrl.trim()) return;
    try {
      const response = await fetch(buildApiUrl('/api/decks/preview'), {
        method: 'POST',
        headers: jsonHeaders,
        credentials: 'include',
        body: JSON.stringify({ deckUrl })
      });
      const payload = await response.json() as {
        success?: boolean;
        error?: string;
        code?: string;
        deck?: { commanderNames?: string[]; colorIdentity?: string[] } | null;
      };
      if (handleAuthFailure(payload, response, setLogFormError)) {
        return;
      }
      if (!response.ok || !payload.success || !payload.deck) return;
      const commanderNames = Array.isArray(payload.deck.commanderNames)
        ? payload.deck.commanderNames
        : [];
      const colorIdentity = Array.isArray(payload.deck.colorIdentity)
        ? payload.deck.colorIdentity
        : null;
      if (commanderNames.length === 0 && !colorIdentity) return;
      setLogOpponents((current) => {
        const next = [...current];
        const index = next.findIndex((opponent) => opponent.id === opponentId);
        if (index === -1) return current;
        const opponent = next[index];
        const commanders = commanderNames.length > 0
          ? commanderNames.map((name) => ({
              name,
              link: null,
              lookupStatus: isAuthenticated ? 'loading' as const : 'idle' as const
            }))
          : opponent.commanders;
        next[index] = {
          ...opponent,
          commanders,
          colorIdentity: colorIdentity ? formatColorValue(colorIdentity) : opponent.colorIdentity
        };
        return next;
      });
      if (commanderNames.length > 0) {
        void resolveCommanderLinks(opponentId, commanderNames.map((name) => ({ name, link: null })));
      }
    } catch {
      // Ignore preview failures and keep existing opponent data.
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
        userId: opponent.userId,
        name: opponent.name.trim(),
        email: opponent.email,
        deckId: opponent.deckId,
        deckName: opponent.deckName,
        deckUrl: opponent.deckUrl,
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
      onLogSaved?.();
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
          {index < deck.commanderNames.length - 1 && <span className="text-gray-500"> / </span>}
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

  if (authStatus === 'unauthenticated') {
    return (
      <div className="w-full max-w-3xl mx-auto bg-gray-900/70 border border-gray-700 rounded-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-semibold mb-3">Your Decks</h2>
        <p className="text-gray-300">
          Sign in to start saving decks to your collection.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <div ref={authButtonRef} />
          {authError && <p className="text-xs text-red-400">{authError}</p>}
        </div>
      </div>
    );
  }
  if (authStatus === 'unknown') {
    return (
      <div className="w-full max-w-3xl mx-auto bg-gray-900/70 border border-gray-700 rounded-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-semibold mb-3">Your Decks</h2>
        <p className="text-gray-300">Checking session...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-6xl mx-auto flex h-full min-h-0 flex-col gap-6">
      {authExpired && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-950/80 backdrop-blur">
          <div className="mx-4 flex w-full max-w-md flex-col gap-3 rounded-2xl border border-gray-800 bg-gray-900/90 p-6 text-center">
            <h3 className="text-lg font-semibold text-white">Session expired</h3>
            <p className="text-sm text-gray-300">
              Sign in again to continue. Your edits are still here.
            </p>
            <div className="flex justify-center pt-2" ref={authButtonRef} />
            {authError && <p className="text-xs text-red-400">{authError}</p>}
          </div>
        </div>
      )}
      {deckError && <p className="text-red-400">{deckError}</p>}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-gray-900/70 border border-gray-700 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Your Deck Collection</h3>
            <p className="text-sm text-gray-400">
              Save decks, track stats, and launch Oracle tools from a single list.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {decks.length > 0 && <span className="text-xs text-gray-500">{decks.length} total</span>}
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-gray-900 shadow hover:bg-cyan-400"
            >
              <span className="text-lg leading-none">+</span>
              Deck
            </button>
            <button
              type="button"
              onClick={openBulkModal}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-400/60 px-5 py-2 text-sm font-semibold text-cyan-100 hover:border-cyan-300 hover:text-cyan-50"
            >
              Bulk import
            </button>
          </div>
        </div>
        <section className="mt-6 rounded-xl border border-gray-800 bg-gray-950/60">
          <button
            type="button"
            onClick={() => setChallengeCollapsed((prev) => !prev)}
            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-900/60"
            aria-expanded={!challengeCollapsed}
            aria-controls="challenge-panel-content"
          >
            <span className="text-sm font-semibold uppercase tracking-wide text-gray-200">
              32 Deck Challenge ({challengeCompletedCount}/32)
            </span>
            <span className="text-sm text-cyan-200">{challengeCollapsed ? '+' : '-'}</span>
          </button>
          {!challengeCollapsed && (
            <div id="challenge-panel-content" className="border-t border-gray-800 px-4 py-4 sm:px-5 sm:py-5">
              <p className="mb-4 text-sm text-cyan-200">{challengeCompletedCount} of 32 colors completed</p>
              <div className="grid gap-4 lg:grid-cols-2">
                {[CHALLENGE_LEFT_COLUMN, CHALLENGE_RIGHT_COLUMN].map((column, columnIndex) => (
                  <div key={`challenge-column-${columnIndex}`} className="space-y-1">
                    {column.map((identity) => {
                      const matchingDecks = challengeDecksByIdentity.get(identity.key) ?? [];
                      return (
                        <div key={identity.key} className="grid grid-cols-[5.75rem_minmax(0,1fr)] items-start gap-2 text-xs">
                          <div className="flex justify-end pt-0.5">
                            <ColorIdentityIcons colors={identity.colors} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] uppercase tracking-wide text-gray-500">{identity.label}</p>
                            {matchingDecks.length === 0 && (
                              <p className="h-5 border-b border-gray-800" aria-hidden="true" />
                            )}
                            {matchingDecks.map((deck) => (
                              <div key={`${identity.key}-${deck.id}`} className="truncate border-b border-gray-800 pb-0.5 text-gray-200">
                                {deck.url ? (
                                  <a
                                    href={deck.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-cyan-200 hover:text-cyan-100"
                                  >
                                    {deck.name}
                                  </a>
                                ) : (
                                  <span>{deck.name}</span>
                                )}
                                {deck.commanderNames.length > 0 && (
                                  <span className="text-gray-300"> — {renderCommanderList(deck)}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
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
                  placeholder="https://archidekt.com/u/username or https://moxfield.com/users/username"
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

      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-950/70 px-4 py-6 sm:items-center sm:py-8">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-700 bg-gray-900 p-6 sm:p-8">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-lg font-semibold">Bulk import decks</h3>
                <p className="text-sm text-gray-400">
                  Paste an Archidekt or Moxfield profile link to load every public deck.
                </p>
              </div>
              <label className="text-sm text-gray-300" htmlFor="bulk-profile-input">
                Profile link
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="bulk-profile-input"
                  type="url"
                  value={bulkProfileUrl}
                  onChange={(event) => {
                    setBulkProfileUrl(event.target.value);
                    setBulkPreviewError(null);
                    setBulkImportError(null);
                    setBulkDecks([]);
                    setBulkSelection({});
                    setBulkFailures([]);
                  }}
                  placeholder="https://..."
                  className="flex-1 px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={handleBulkPreview}
                  disabled={!isSupportedProfileUrl(bulkProfileUrl) || bulkPreviewLoading}
                  className="px-4 py-3 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800 disabled:opacity-60"
                >
                  {bulkPreviewLoading ? 'Loading...' : 'Load decks'}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Examples: https://archidekt.com/u/username, https://moxfield.com/users/username
              </p>
              {bulkPreviewError && <p className="text-red-400">{bulkPreviewError}</p>}
              {bulkDecks.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
                    <span>
                      {bulkSelectedCount} of {bulkDecks.length} selected
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBulkSelectionAll(true)}
                        className="rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-200 hover:border-cyan-400 hover:text-cyan-100"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkSelectionAll(false)}
                        className="rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-200 hover:border-cyan-400 hover:text-cyan-100"
                      >
                        Select none
                      </button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-800 bg-gray-950/60">
                    {bulkDecks.map((deck) => (
                      <label
                        key={deck.id}
                        className="flex items-start gap-3 border-b border-gray-800 px-4 py-3 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={bulkSelection[deck.url] ?? false}
                          onChange={() => toggleBulkSelection(deck.url)}
                          className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-900 text-cyan-400 focus:ring-cyan-500"
                        />
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-gray-100">{deck.name}</span>
                          <span className="text-xs text-gray-500">
                            {deck.source === 'archidekt' ? 'Archidekt' : 'Moxfield'}
                            {deck.format ? ` • ${deck.format}` : ''}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {bulkFailures.length > 0 && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                  <p className="font-semibold">Some decks failed to import:</p>
                  <ul className="mt-2 space-y-1">
                    {bulkFailures.map((failure) => (
                      <li key={failure.deckUrl}>
                        {failure.deckUrl} — {failure.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {bulkImportError && <p className="text-red-400">{bulkImportError}</p>}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    resetBulkForm();
                    closeBulkModal();
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkImport}
                  disabled={bulkImporting || bulkSelectedCount === 0}
                  className="px-4 py-2 rounded-lg bg-cyan-500 text-gray-900 font-semibold hover:bg-cyan-400 disabled:opacity-60"
                >
                  {bulkImporting ? 'Importing...' : 'Import selected'}
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
                {logOpponents.map((opponent, opponentIndex) => {
                  const opponentDecks = opponent.userId ? decksByUserId[opponent.userId] ?? [] : [];
                  const decksLoading = opponent.userId ? decksLoadingByUserId[opponent.userId] : false;
                  const decksError = opponent.userId ? decksErrorByUserId[opponent.userId] : null;
                  return (
                    <div
                      key={`${logTarget.id}-opponent-${opponentIndex}`}
                      className="rounded-lg border border-gray-700 bg-gray-800/50 p-3"
                      ref={opponentIndex === recentOpenIndex || opponentIndex === searchOpenIndex ? opponentDropdownRef : null}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={opponent.name}
                              onChange={(event) => updateLogOpponentField(opponentIndex, 'name', event.target.value)}
                              onFocus={() => openRecentOpponents(opponentIndex)}
                              placeholder="Name"
                              className="w-full min-w-0 px-3 py-2 rounded-lg bg-gray-800 text-white text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleLogOpponentSearch(opponentIndex)}
                              disabled={searchLoading && searchOpenIndex === opponentIndex}
                              className="w-full sm:w-auto rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-gray-800 disabled:opacity-60"
                            >
                              {searchLoading && searchOpenIndex === opponentIndex ? 'Searching...' : 'Search'}
                            </button>
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
                        {recentOpenIndex === opponentIndex && (
                          <div className="rounded-lg border border-gray-700 bg-gray-900 p-2">
                            <p className="text-xs text-gray-400 mb-2">Recent opponents</p>
                            {recentLoading && <p className="text-xs text-gray-400">Loading recent opponents...</p>}
                            {recentError && <p className="text-xs text-red-400">{recentError}</p>}
                            {!recentLoading && recentOpponents.length === 0 && (
                              <p className="text-xs text-gray-500">No recent opponents yet.</p>
                            )}
                            {recentOpponents.map((user) => (
                              <button
                                key={user.id}
                                type="button"
                                onClick={() => applyLogOpponentUser(opponent.id, user)}
                                className="block w-full rounded-md px-2 py-1 text-left text-xs text-gray-200 hover:bg-gray-800"
                              >
                                {formatOpponentUserLabel(user)}
                              </button>
                            ))}
                          </div>
                        )}
                        {searchOpenIndex === opponentIndex && (
                          <div className="rounded-lg border border-gray-700 bg-gray-900 p-2">
                            <p className="text-xs text-gray-400 mb-2">Search results</p>
                            {searchLoading && <p className="text-xs text-gray-400">Searching users...</p>}
                            {searchError && <p className="text-xs text-red-400">{searchError}</p>}
                            {!searchLoading && searchResults.length === 0 && (
                              <p className="text-xs text-gray-500">No matching users found.</p>
                            )}
                            {searchResults.map((user) => (
                              <button
                                key={user.id}
                                type="button"
                                onClick={() => applyLogOpponentUser(opponent.id, user)}
                                className="block w-full rounded-md px-2 py-1 text-left text-xs text-gray-200 hover:bg-gray-800"
                              >
                                {formatOpponentUserLabel(user)}
                              </button>
                            ))}
                          </div>
                        )}
                        {opponent.searchMessage && (
                          <p
                            className={`text-xs ${
                              opponent.searchStatus === 'matched'
                                ? 'text-emerald-300'
                                : opponent.searchStatus === 'not-found'
                                  ? 'text-amber-300'
                                  : opponent.searchStatus === 'error'
                                    ? 'text-red-400'
                                    : 'text-gray-400'
                            }`}
                          >
                            {opponent.searchMessage}
                          </p>
                        )}
                        {opponent.userId && opponent.userLabel && (
                          <p className="text-xs text-emerald-300">Selected user: {opponent.userLabel}</p>
                        )}
                        {opponent.userId && (
                          <div className="flex flex-col gap-2">
                            <label className="text-xs text-gray-400" htmlFor={`log-opponent-deck-${opponent.id}`}>
                              Opponent deck
                            </label>
                            <select
                              id={`log-opponent-deck-${opponent.id}`}
                              value={opponent.deckId ?? ''}
                              onChange={(event) => selectLogOpponentDeck(opponentIndex, event.target.value)}
                              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200"
                            >
                              <option value="">Select deck...</option>
                              {opponentDecks.map((deck) => (
                                <option key={deck.id} value={deck.id}>
                                  {formatOpponentDeckLabel(deck)}
                                </option>
                              ))}
                            </select>
                            {decksLoading && <p className="text-xs text-gray-400">Loading decks...</p>}
                            {!decksLoading && opponentDecks.length === 0 && !decksError && (
                              <p className="text-xs text-gray-500">No decks found for this user.</p>
                            )}
                            {decksError && <p className="text-xs text-red-400">{decksError}</p>}
                          </div>
                        )}
                        <div className="flex flex-col gap-2">
                          <p className="text-xs text-gray-400">Commanders (0-2)</p>
                          {opponent.commanders.map((commander, cmdIndex) => (
                            <div key={cmdIndex} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                              <input
                                type="text"
                                value={commander.name}
                                onChange={(event) => updateLogOpponentCommander(opponentIndex, cmdIndex, event.target.value)}
                                onFocus={() => {
                                  setRecentOpenIndex(null);
                                  setSearchOpenIndex(null);
                                  clearSearch();
                                }}
                                placeholder={`Commander ${cmdIndex + 1}`}
                                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-gray-800 text-white text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                              />
                              <button
                                type="button"
                                onClick={() => lookupLogOpponentCommander(opponentIndex, cmdIndex)}
                                disabled={!commander.name.trim() || commander.lookupStatus === 'loading'}
                                className="w-full sm:w-auto rounded-lg border border-gray-700 px-2 py-2 sm:py-1 text-xs font-semibold text-gray-200 hover:bg-gray-800 disabled:opacity-60"
                                aria-label="Lookup commander"
                                title="Lookup commander on Scryfall"
                              >
                                {commander.lookupStatus === 'loading' ? '...' : 'Scryfall'}
                              </button>
                              {opponent.commanders.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeLogOpponentCommander(opponentIndex, cmdIndex)}
                                  className="self-start sm:self-auto text-gray-500 hover:text-red-400 p-1"
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
                        <div className="flex flex-col gap-2">
                          <p className="text-xs text-gray-400">Color identity</p>
                          <ColorIdentitySelect
                            label=""
                            value={opponent.colorIdentity}
                            onChange={(value) => updateLogOpponentField(opponentIndex, 'colorIdentity', value)}
                            onFocus={() => {
                              setRecentOpenIndex(null);
                              setSearchOpenIndex(null);
                              clearSearch();
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
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
