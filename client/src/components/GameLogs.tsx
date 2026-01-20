import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ColorIdentityIcons, ColorIdentitySelect } from './ColorIdentitySelect';
import { useGameLogs, type GameLogEntry } from '../hooks/useGameLogs';
import type { SharedGameLogEntry, SharedGameLogUpdate } from '../hooks/useSharedGameLogs';
import { useOpponentDecks, type OpponentDeck } from '../hooks/useOpponentDecks';
import { useOpponentUsers, type OpponentUser } from '../hooks/useOpponentUsers';
import { buildApiUrl } from '../utils/api';
import { sortColorsForDisplay } from '../utils/color-identity';
import { parseLocalDate } from '../utils/date';
import type { DeckEntry } from './DeckCollection';

const PREDEFINED_TAGS = [
  'mulligan',
  'missed land drops',
  'poor card draw',
  'god hand',
  'bad opening hand',
  'scooped'
] as const;

function getScryfallImageUrl(cardName: string) {
  const encoded = encodeURIComponent(cardName.trim());
  return `https://api.scryfall.com/cards/named?exact=${encoded}&format=image&version=normal`;
}

type GameLogsProps = {
  enabled: boolean;
  idToken: string | null;
  decks: DeckEntry[];
  decksLoading: boolean;
  sharedLogs: SharedGameLogEntry[];
  sharedLoading: boolean;
  sharedError: string | null;
  refreshSharedLogs: () => Promise<void>;
  updateSharedLog: (logId: string, input: SharedGameLogUpdate) => Promise<boolean>;
  acceptSharedLog: (logId: string) => Promise<boolean>;
  rejectSharedLog: (logId: string) => Promise<boolean>;
};

function formatDate(value: string): string {
  const parsed = parseLocalDate(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function truncateLabel(value: string, maxLength = 12): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}

function formatCommanderList(commanders: string[]): string {
  if (commanders.length === 0) return 'No commander';
  return commanders.join(' / ');
}

function formatOpponentDeckLabel(deck: OpponentDeck): string {
  return `${deck.name} — ${formatCommanderList(deck.commanderNames)}`;
}

function formatColorIdentityValue(colors: string[] | null): string {
  if (colors === null) return '';
  if (colors.length === 0) return 'C';
  return sortColorsForDisplay(colors).join('');
}

function formatGameLength(durationMinutes: number | null, turns: number | null): string {
  const parts: string[] = [];
  if (durationMinutes) {
    parts.push(`${durationMinutes}m`);
  }
  if (turns) {
    parts.push(`${turns} turns`);
  }
  if (parts.length === 0) return '';
  return `Game Length: ${parts.join(', ')}`;
}

function formatOpponentUserLabel(user: { name?: string | null; email?: string | null }): string {
  const name = user.name?.trim() ?? '';
  const email = user.email?.trim() ?? '';
  if (name && email) return `${name} <${email}>`;
  return name || email || 'Unknown user';
}

function getOpponentDisplayName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  const match = trimmed.match(/^([^<]+)<[^>]+>$/);
  if (match) return match[1].trim();
  return trimmed;
}

function createEditOpponent(): OpponentForm {
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

export function GameLogs({
  enabled,
  idToken,
  decks,
  decksLoading,
  sharedLogs,
  sharedLoading,
  sharedError,
  refreshSharedLogs,
  updateSharedLog,
  acceptSharedLog,
  rejectSharedLog
}: GameLogsProps) {
  const {
    logs,
    loading,
    error,
    statusMessage,
    removeLog,
    updateLog,
    shareLog,
    refreshLogs
  } = useGameLogs(idToken);
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
  } = useOpponentUsers(idToken);
  const {
    decksByUserId,
    loadingByUserId: decksLoadingByUserId,
    errorByUserId: decksErrorByUserId,
    loadOpponentDecks
  } = useOpponentDecks(idToken);
  const [recentOpenIndex, setRecentOpenIndex] = useState<number | null>(null);
  const [searchOpenIndex, setSearchOpenIndex] = useState<number | null>(null);
  type SortKey = 'playedAt' | 'deckName' | 'result' | 'durationMinutes' | 'turns';
  const sortStorageKey = 'btr:game-logs-sort';
  const sortKeys: SortKey[] = ['playedAt', 'deckName', 'result', 'durationMinutes', 'turns'];
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
  const [sortKey, setSortKey] = useState<SortKey>(() => initialSort?.key ?? 'playedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => initialSort?.dir ?? 'desc');
  const [editTarget, setEditTarget] = useState<{
    id: string;
    deckName: string | null;
    deckId: string | null;
    kind: 'log' | 'shared';
  } | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editDeckId, setEditDeckId] = useState('');
  const [editTurns, setEditTurns] = useState('');
  const [editDurationMinutes, setEditDurationMinutes] = useState('');
  const [editOpponents, setEditOpponents] = useState<OpponentForm[]>([]);
  const [editResult, setEditResult] = useState<'win' | 'loss' | 'pending'>('pending');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [shareConfirmTarget, setShareConfirmTarget] = useState<{
    logId: string;
    rejectedCount: number;
    rejectedOpponents: Array<{ userId: string; name: string | null }>;
  } | null>(null);
  const [shareSelectedOpponentIds, setShareSelectedOpponentIds] = useState<string[]>([]);
  const [hoverCard, setHoverCard] = useState<{ label: string; rect: DOMRect } | null>(null);
  const anchorRef = useRef<HTMLAnchorElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const opponentDropdownRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
    if (!editTarget || !idToken) return;
    void loadRecentOpponents();
  }, [editTarget, idToken, loadRecentOpponents]);

  useEffect(() => {
    if (!idToken) return;
    void refreshLogs();
    void refreshSharedLogs();
  }, [idToken, refreshLogs, refreshSharedLogs]);

  useEffect(() => {
    if (!editTarget) return;
    editOpponents.forEach((opponent) => {
      if (opponent.userId) {
        void loadOpponentDecks(opponent.userId);
      }
    });
  }, [editOpponents, editTarget, loadOpponentDecks]);

  useEffect(() => {
    if (searchOpenIndex === null || !searchError) return;
    setEditOpponents((current) => {
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

  useEffect(() => {
    if (!hoverCard) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      setHoverCard(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [hoverCard]);

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

  const imageUrl = useMemo(() => {
    if (!hoverCard) return null;
    return getScryfallImageUrl(hoverCard.label);
  }, [hoverCard]);

  const openEditModal = (log: (typeof logs)[number]) => {
    setEditTarget({ id: log.id, deckName: log.deckName, deckId: log.deckId, kind: 'log' });
    setEditDeckId(log.deckId);
    setEditDate(log.playedAt);
    setEditTurns(log.turns ? String(log.turns) : '');
    setEditDurationMinutes(log.durationMinutes ? String(log.durationMinutes) : '');
    setEditOpponents(
      log.opponents.map((opponent) => ({
        id: crypto.randomUUID(),
        userId: opponent.userId ?? null,
        userLabel: opponent.userId
          ? formatOpponentUserLabel({ name: opponent.name, email: opponent.email })
          : null,
        searchMessage: null,
        searchStatus: null,
        name: opponent.name ?? '',
        email: opponent.email ?? null,
        deckId: opponent.deckId ?? null,
        deckName: opponent.deckName ?? null,
        deckUrl: opponent.deckUrl ?? null,
        commanders: opponent.commanderNames.length > 0
          ? opponent.commanderNames.map((cmdName, idx) => ({
              name: cmdName,
              link: opponent.commanderLinks[idx] ?? null,
              lookupStatus: opponent.commanderLinks[idx] ? 'found' as const : 'idle' as const
            }))
          : [{ name: '', link: null, lookupStatus: 'idle' as const }],
        colorIdentity: formatColorIdentityValue(opponent.colorIdentity ?? null)
      }))
    );
    setEditResult(log.result ?? 'pending');
    setEditTags(log.tags ?? []);
    setCustomTagInput('');
    setEditFormError(null);
    setRecentOpenIndex(null);
    setSearchOpenIndex(null);
    clearSearch();
  };

  const openSharedEditModal = (log: SharedGameLogEntry) => {
    setEditTarget({ id: log.id, deckName: log.deckName, deckId: log.deckId, kind: 'shared' });
    setEditDeckId(log.deckId ?? '');
    setEditDate(log.playedAt);
    setEditTurns(log.turns ? String(log.turns) : '');
    setEditDurationMinutes(log.durationMinutes ? String(log.durationMinutes) : '');
    setEditOpponents(
      log.opponents.map((opponent) => ({
        id: crypto.randomUUID(),
        userId: opponent.userId ?? null,
        userLabel: opponent.userId
          ? formatOpponentUserLabel({ name: opponent.name, email: opponent.email })
          : null,
        searchMessage: null,
        searchStatus: null,
        name: opponent.name ?? '',
        email: opponent.email ?? null,
        deckId: opponent.deckId ?? null,
        deckName: opponent.deckName ?? null,
        deckUrl: opponent.deckUrl ?? null,
        commanders: opponent.commanderNames.length > 0
          ? opponent.commanderNames.map((cmdName, idx) => ({
              name: cmdName,
              link: opponent.commanderLinks[idx] ?? null,
              lookupStatus: opponent.commanderLinks[idx] ? 'found' as const : 'idle' as const
            }))
          : [{ name: '', link: null, lookupStatus: 'idle' as const }],
        colorIdentity: formatColorIdentityValue(opponent.colorIdentity ?? null)
      }))
    );
    setEditResult(log.result ?? 'pending');
    setEditTags(log.tags ?? []);
    setCustomTagInput('');
    setEditFormError(null);
    setRecentOpenIndex(null);
    setSearchOpenIndex(null);
    clearSearch();
  };

  const toggleEditTag = (tag: string) => {
    setEditTags((current) =>
      current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag]
    );
  };

  const addCustomTag = () => {
    const tag = customTagInput.trim().toLowerCase();
    if (tag && !editTags.includes(tag)) {
      setEditTags((current) => [...current, tag]);
    }
    setCustomTagInput('');
  };

  const parseOptionalNumberInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  };

  const addEditOpponent = () => {
    setEditOpponents((current) => [...current, createEditOpponent()]);
    setRecentOpenIndex(null);
    setSearchOpenIndex(null);
    clearSearch();
  };

  const removeEditOpponent = (index: number) => {
    setEditOpponents((current) => current.filter((_, i) => i !== index));
    setRecentOpenIndex(null);
    setSearchOpenIndex(null);
    clearSearch();
  };

  const updateEditOpponentField = (opponentIndex: number, field: 'name' | 'colorIdentity', value: string) => {
    setEditOpponents((current) => {
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

  const applyEditOpponentUser = (opponentId: string, user: OpponentUser) => {
    const label = formatOpponentUserLabel(user);
    const displayName = (user.name ?? user.email ?? '').trim();
    setEditOpponents((current) => {
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

  const handleEditOpponentSearch = async (opponentIndex: number) => {
    if (!idToken) {
      setEditFormError('Sign in with Google to search opponents.');
      return;
    }
    const opponentId = editOpponents[opponentIndex]?.id;
    if (!opponentId) return;
    const query = editOpponents[opponentIndex]?.name?.trim() ?? '';
    if (!query) {
      setEditFormError('Enter a name or email to search.');
      return;
    }
    setEditFormError(null);
    setSearchOpenIndex(opponentIndex);
    setRecentOpenIndex(null);
    setEditOpponents((current) => {
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
      applyEditOpponentUser(opponentId, results[0]);
      return;
    }
    setEditOpponents((current) => {
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
    if (!idToken) {
      setEditFormError('Sign in with Google to view recent opponents.');
      return;
    }
    setEditFormError(null);
    const nextIndex = opponentIndex;
    setRecentOpenIndex(nextIndex);
    setSearchOpenIndex(null);
    clearSearch();
    if (nextIndex !== null && recentOpponents.length === 0 && !recentLoading) {
      await loadRecentOpponents();
    }
  };

  const updateEditOpponentCommander = (opponentIndex: number, commanderIndex: number, value: string) => {
    setEditOpponents((current) => {
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

  const selectEditOpponentDeck = (opponentIndex: number, deckId: string) => {
    const currentOpponent = editOpponents[opponentIndex];
    const currentDeck = currentOpponent?.userId
      ? (decksByUserId[currentOpponent.userId] ?? []).find((entry) => entry.id === deckId)
      : null;
    setEditOpponents((current) => {
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
            lookupStatus: deck.commanderLinks[idx] ? 'found' as const : idToken ? 'loading' as const : 'idle' as const
          }))
        : [{ name: '', link: null, lookupStatus: 'idle' as const }];
      next[opponentIndex] = {
        ...opponent,
        deckId: deck.id,
        deckName: deck.name,
        deckUrl: deck.url ?? null,
        commanders,
        colorIdentity: formatColorIdentityValue(deck.colorIdentity)
      };
      return next;
    });
    const opponentId = editOpponents[opponentIndex]?.id;
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

  const addOpponentCommander = (opponentIndex: number) => {
    setEditOpponents((current) => {
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

  const removeOpponentCommander = (opponentIndex: number, commanderIndex: number) => {
    setEditOpponents((current) => {
      const next = [...current];
      const opponent = next[opponentIndex];
      if (opponent && opponent.commanders.length > 1) {
        const commanders = opponent.commanders.filter((_, i) => i !== commanderIndex);
        next[opponentIndex] = { ...opponent, commanders };
      }
      return next;
    });
  };

  const lookupOpponentCommander = async (opponentIndex: number, commanderIndex: number) => {
    if (!idToken) {
      setEditFormError('Sign in with Google to search commanders.');
      return;
    }
    const commanderName = editOpponents[opponentIndex]?.commanders[commanderIndex]?.name?.trim();
    if (!commanderName) {
      return;
    }
    setEditOpponents((current) => {
      const next = [...current];
      const opponent = next[opponentIndex];
      if (opponent) {
        const commanders = [...opponent.commanders];
        commanders[commanderIndex] = { ...commanders[commanderIndex], lookupStatus: 'loading' };
        next[opponentIndex] = { ...opponent, commanders };
      }
      return next;
    });
    setEditFormError(null);
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
        setEditOpponents((current) => {
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
      setEditOpponents((current) => {
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
      setEditOpponents((current) => {
        const next = [...current];
        const opponent = next[opponentIndex];
        if (opponent) {
          const commanders = [...opponent.commanders];
          commanders[commanderIndex] = { ...commanders[commanderIndex], lookupStatus: 'error' };
          next[opponentIndex] = { ...opponent, commanders };
        }
        return next;
      });
      setEditFormError(message);
    }
  };

  const resolveCommanderLinks = async (
    opponentId: string,
    commanders: Array<{ name: string; link: string | null }>
  ) => {
    if (!idToken) return;
    const missing = commanders
      .map((commander, index) => ({ ...commander, index }))
      .filter((commander) => commander.name.trim().length > 0 && !commander.link);
    if (missing.length === 0) return;
    try {
      const resolved = await Promise.all(
        missing.map(async (commander) => {
          const response = await fetch(buildApiUrl('/api/scryfall/lookup'), {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${idToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: commander.name })
          });
          const payload = await response.json() as {
            success?: boolean;
            error?: string;
            card?: { name: string; scryfallUrl: string | null } | null;
          };
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
      setEditOpponents((current) => {
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
    if (!idToken || !deckUrl.trim()) return;
    try {
      const response = await fetch(buildApiUrl('/api/decks/preview'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ deckUrl })
      });
      const payload = await response.json() as {
        success?: boolean;
        error?: string;
        deck?: { commanderNames?: string[]; colorIdentity?: string[] } | null;
      };
      if (!response.ok || !payload.success || !payload.deck) return;
      const commanderNames = Array.isArray(payload.deck.commanderNames)
        ? payload.deck.commanderNames
        : [];
      const colorIdentity = Array.isArray(payload.deck.colorIdentity)
        ? payload.deck.colorIdentity
        : null;
      if (commanderNames.length === 0 && !colorIdentity) return;
      setEditOpponents((current) => {
        const next = [...current];
        const index = next.findIndex((opponent) => opponent.id === opponentId);
        if (index === -1) return current;
        const opponent = next[index];
        const commanders = commanderNames.length > 0
          ? commanderNames.map((name) => ({
              name,
              link: null,
              lookupStatus: idToken ? 'loading' as const : 'idle' as const
            }))
          : opponent.commanders;
        next[index] = {
          ...opponent,
          commanders,
          colorIdentity: colorIdentity ? formatColorIdentityValue(colorIdentity) : opponent.colorIdentity
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

  const handleSaveEdit = async () => {
    if (!editTarget) {
      setEditFormError('Choose a log to edit.');
      return;
    }
    setEditFormError(null);
    const opponentsPayload = editOpponents.map((opponent) => ({
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
    }));
    const payload = {
      datePlayed: editDate,
      turns: parseOptionalNumberInput(editTurns),
      durationMinutes: parseOptionalNumberInput(editDurationMinutes),
      opponentsCount: editOpponents.length,
      opponents: opponentsPayload,
      result: editResult === 'pending' ? null : editResult,
      tags: editTags
    };

    const success = editTarget.kind === 'shared'
      ? await updateSharedLog(editTarget.id, {
          ...payload,
          deckId: editDeckId ? editDeckId : null
        })
      : await updateLog(editTarget.id, payload);
    if (success) {
      setEditTarget(null);
      setRecentOpenIndex(null);
      setSearchOpenIndex(null);
      clearSearch();
    }
  };

  const handleShareLog = async (logId: string) => {
    const response = await shareLog(logId);
    if (response?.needsConfirm && (response.rejectedCount ?? 0) > 0) {
      const rejectedOpponents = (response.opponents ?? [])
        .filter((opponent) => opponent.status === 'rejected')
        .map((opponent) => ({
          userId: opponent.userId,
          name: opponent.name
        }));
      setShareConfirmTarget({
        logId,
        rejectedCount: response.rejectedCount ?? 0,
        rejectedOpponents
      });
      setShareSelectedOpponentIds(rejectedOpponents.map((opponent) => opponent.userId));
    }
  };

  const confirmReshareLog = async () => {
    if (!shareConfirmTarget) return;
    await shareLog(shareConfirmTarget.logId, {
      confirmReshare: true,
      reshareRecipientIds: shareSelectedOpponentIds
    });
    setShareConfirmTarget(null);
    setShareSelectedOpponentIds([]);
  };

  const handleAcceptSharedLog = async (logId: string) => {
    const success = await acceptSharedLog(logId);
    if (success) {
      await refreshLogs();
    }
  };

  const handleRejectSharedLog = async (logId: string) => {
    setRejectTargetId(logId);
  };

  const confirmRejectSharedLog = async () => {
    if (!rejectTargetId) return;
    await rejectSharedLog(rejectTargetId);
    setRejectTargetId(null);
  };

  const handleRefreshLogs = async () => {
    await Promise.all([refreshLogs(), refreshSharedLogs()]);
  };

  const renderLogRow = (
    log: {
      id: string;
      deckName: string | null;
      playedAt: string;
      opponents: GameLogEntry['opponents'];
      tags: string[];
      result: GameLogEntry['result'];
      durationMinutes: number | null;
      turns: number | null;
    },
    actions: ReactNode,
    keyPrefix: string
  ) => {
    const deckLabel = log.deckName ?? 'Select deck';
    const deckLabelClass = log.deckName ? 'text-white' : 'text-gray-400 italic';
    return (
      <div key={`${keyPrefix}-${log.id}`} className="flex flex-col gap-1 px-4 py-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(6rem,6.5rem)_minmax(10rem,1fr)_minmax(4.5rem,4.5rem)_minmax(12rem,1fr)_auto] sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-gray-500 sm:hidden">
              Date
            </span>
            <span className="text-xs text-gray-400">{formatDate(log.playedAt)}</span>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase tracking-wide text-gray-500 sm:hidden">
              Deck
            </span>
            <h4 className={`truncate text-sm font-semibold sm:text-base ${deckLabelClass}`}>
              {deckLabel}
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-gray-500 sm:hidden">
              Result
            </span>
            <span
              className={`text-xs font-semibold uppercase tracking-wide ${
              log.result === 'win'
                ? 'text-emerald-300'
                : log.result === 'loss'
                    ? 'text-rose-300'
                    : 'text-gray-300'
              }`}
            >
              {log.result ?? 'pending'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <span className="text-[10px] uppercase tracking-wide text-gray-500 sm:hidden">
              Game Length
            </span>
            <span>{formatGameLength(log.durationMinutes, log.turns)}</span>
          </div>
          <div className="flex items-center justify-start gap-1 sm:justify-end">
            {actions}
          </div>
        </div>

        {log.opponents.length > 0 && (
          <div className="flex flex-col gap-1">
            {log.opponents.map((opponent, index) => (
              <div
                key={`${keyPrefix}-${log.id}-opponent-${index}`}
                className="grid grid-cols-1 gap-2 text-xs text-gray-200 sm:grid-cols-[minmax(6rem,6.5rem)_12ch_5.5rem_minmax(10rem,1fr)] sm:items-center"
              >
                <span className="text-[10px] uppercase tracking-wide text-gray-500 sm:text-[11px]">
                  {index === 0 ? 'Opponents:' : ''}
                </span>
                <span className="truncate font-medium" title={opponent.name || undefined}>
                  {opponent.name
                    ? truncateLabel(getOpponentDisplayName(opponent.name))
                    : `Opponent ${index + 1}`}
                </span>
                <div className="flex items-center justify-start">
                  {opponent.colorIdentity ? (
                    <ColorIdentityIcons colors={opponent.colorIdentity} />
                  ) : null}
                </div>
                <span className="text-gray-400">
                  {opponent.deckName ? (
                    <>
                      {opponent.deckUrl ? (
                        <a
                          href={opponent.deckUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-200 hover:text-cyan-100"
                        >
                          {opponent.deckName}
                        </a>
                      ) : (
                        opponent.deckName
                      )}
                      {opponent.commanderNames.length > 0 && ' — '}
                    </>
                  ) : null}
                  {opponent.commanderNames.length > 0
                    ? opponent.commanderNames.map((cmdName, cmdIndex) => (
                      <span key={cmdIndex}>
                        {cmdIndex > 0 && ' / '}
                        {opponent.commanderLinks[cmdIndex] ? (
                          <a
                            href={opponent.commanderLinks[cmdIndex]!}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-200 hover:text-cyan-100"
                            onMouseEnter={(event) => {
                              anchorRef.current = event.currentTarget;
                              const rect = event.currentTarget.getBoundingClientRect();
                              setHoverCard({ label: cmdName, rect });
                            }}
                          >
                            {cmdName}
                          </a>
                        ) : (
                          cmdName
                        )}
                      </span>
                    ))
                    : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        {log.tags.length > 0 && (
          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-[minmax(6rem,6.5rem)_1fr] sm:items-start">
            <span className="text-[10px] uppercase tracking-wide text-gray-500 sm:text-[11px]">
              Tags:
            </span>
            <div className="flex flex-wrap gap-1">
              {log.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-gray-700/60 text-gray-300">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const sortLabels: Record<SortKey, string> = {
    playedAt: 'Date played',
    deckName: 'Deck name',
    result: 'Win/Loss',
    durationMinutes: 'Game length (minutes)',
    turns: 'Game length (turns)'
  };

  const handleSortChange = (key: SortKey) => {
    setSortKey(key);
    try {
      localStorage.setItem(sortStorageKey, JSON.stringify({ key, dir: sortDir }));
    } catch {
      // Ignore storage errors in private mode.
    }
  };

  const handleSortDirToggle = () => {
    setSortDir((prev) => {
      const next = prev === 'asc' ? 'desc' : 'asc';
      try {
        localStorage.setItem(sortStorageKey, JSON.stringify({ key: sortKey, dir: next }));
      } catch {
        // Ignore storage errors in private mode.
      }
      return next;
    });
  };

  const sortedLogs = useMemo(() => {
    const list = [...logs];
    const compare = (a: number, b: number) => (sortDir === 'asc' ? a - b : b - a);
    const compareStrings = (a: string, b: string) =>
      sortDir === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
    list.sort((first, second) => {
      switch (sortKey) {
        case 'deckName':
          return compareStrings(first.deckName, second.deckName);
        case 'result': {
          const rank = (value: typeof first.result) =>
            value === 'win' ? 2 : value === 'loss' ? 1 : 0;
          return compare(rank(first.result), rank(second.result));
        }
        case 'durationMinutes': {
          const missingValue = sortDir === 'asc' ? Number.POSITIVE_INFINITY : -1;
          const aValue = first.durationMinutes ?? missingValue;
          const bValue = second.durationMinutes ?? missingValue;
          return compare(aValue, bValue);
        }
        case 'turns': {
          const missingValue = sortDir === 'asc' ? Number.POSITIVE_INFINITY : -1;
          const aValue = first.turns ?? missingValue;
          const bValue = second.turns ?? missingValue;
          return compare(aValue, bValue);
        }
        case 'playedAt':
        default: {
          const aValue = parseLocalDate(first.playedAt).getTime();
          const bValue = parseLocalDate(second.playedAt).getTime();
          return compare(aValue, bValue);
        }
      }
    });
    return list;
  }, [logs, sortDir, sortKey]);

  if (!enabled) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-gray-900/70 border border-gray-700 rounded-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-semibold mb-3">Game Logs</h2>
        <p className="text-gray-300">
          Google login is not configured. Set `VITE_GOOGLE_CLIENT_ID` to enable game logs.
        </p>
      </div>
    );
  }

  if (!idToken) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-gray-900/70 border border-gray-700 rounded-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-semibold mb-3">Game Logs</h2>
        <p className="text-gray-300">
          Sign in from the Profile page to start logging games.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto flex h-full min-h-0 flex-col gap-6">
      {error && <p className="text-red-400">{error}</p>}
      {sharedLogs.length > 0 && (
        <div className="flex flex-col overflow-hidden bg-gray-900/70 border border-cyan-700/40 rounded-2xl p-6 sm:p-8 max-h-[50vh]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Shared Logs</h3>
              <p className="text-sm text-gray-400">Review games shared by your opponents.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{sharedLogs.length} pending</span>
              <button
                type="button"
                onClick={handleRefreshLogs}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-700 text-gray-200 hover:border-cyan-400 hover:text-cyan-200"
                aria-label="Refresh shared logs"
                title="Refresh shared logs"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 12a9 9 0 11-2.64-6.36" />
                  <path d="M21 3v6h-6" />
                </svg>
              </button>
            </div>
          </div>
          <div className="mt-6 flex flex-col overflow-hidden">
            {sharedLoading && <p className="text-gray-400">Loading shared logs...</p>}
            {sharedError && <p className="text-red-400">{sharedError}</p>}
            {!sharedLoading && sharedLogs.length > 0 && (
              <div className="flex flex-col overflow-hidden rounded-xl border border-gray-800 bg-gray-950/60">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 px-4 py-2">
                  <span className="text-xs uppercase tracking-wide text-gray-500">Pending</span>
                </div>
                <div className="overflow-y-auto divide-y divide-gray-800">
                  {sharedLogs.map((log) =>
                    renderLogRow(
                      log,
                      <>
                        <button
                          type="button"
                          onClick={() => openSharedEditModal(log)}
                          className="inline-flex h-7 w-7 items-center justify-center text-gray-300 hover:text-cyan-300"
                          aria-label={`Edit shared log`}
                          title="Edit log"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
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
                          onClick={() => handleAcceptSharedLog(log.id)}
                          disabled={!log.deckId}
                          className="inline-flex h-7 w-7 items-center justify-center text-gray-300 hover:text-emerald-300 disabled:opacity-40 disabled:hover:text-gray-300"
                          aria-label="Accept shared log"
                          title={log.deckId ? 'Accept log' : 'Select a deck before accepting'}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectSharedLog(log.id)}
                          className="inline-flex h-7 w-7 items-center justify-center text-gray-300 hover:text-red-300"
                          aria-label="Reject shared log"
                          title="Reject log"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M15 9l-6 6" />
                            <path d="M9 9l6 6" />
                          </svg>
                        </button>
                      </>,
                      'shared'
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {statusMessage && <p className="text-emerald-300">{statusMessage}</p>}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-gray-900/70 border border-gray-700 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Game Logs</h3>
            <p className="text-sm text-gray-400">
              Review recent Commander games logged from your deck list.
            </p>
          </div>
          {logs.length > 0 && <span className="text-xs text-gray-500">{logs.length} total</span>}
        </div>

        <div className="mt-6 flex flex-1 min-h-0 flex-col overflow-hidden">
          {loading && <p className="text-gray-400">Loading game logs...</p>}
          {!loading && !error && logs.length === 0 && (
            <p className="text-gray-400">No games logged yet.</p>
          )}

          {!loading && logs.length > 0 && (
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-gray-800 bg-gray-950/60">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 px-4 py-2">
                <span className="text-xs uppercase tracking-wide text-gray-500">Logs</span>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <label className="text-xs uppercase tracking-wide text-gray-500" htmlFor="game-log-sort">
                    Sort
                  </label>
                  <select
                    id="game-log-sort"
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
                    onClick={handleSortDirToggle}
                    className="rounded-md border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-200 hover:border-cyan-400 hover:text-cyan-200"
                    aria-label={`Sort ${sortDir === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    {sortDir === 'asc' ? '^' : 'v'}
                  </button>
                  <button
                    type="button"
                    onClick={handleRefreshLogs}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-700 text-gray-200 hover:border-cyan-400 hover:text-cyan-200"
                    aria-label="Refresh logs"
                    title="Refresh logs"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21 12a9 9 0 11-2.64-6.36" />
                      <path d="M21 3v6h-6" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-scroll divide-y divide-gray-800">
                {sortedLogs.map((log) =>
                  renderLogRow(
                    log,
                    <>
                      {log.opponents.some((opponent) => opponent.userId) && (
                        <button
                          type="button"
                          onClick={() => handleShareLog(log.id)}
                          className="inline-flex h-7 w-7 items-center justify-center text-gray-300 hover:text-emerald-300"
                          aria-label={`Share ${log.deckName} log`}
                          title="Share log"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" />
                            <path d="M16 6l-4-4-4 4" />
                            <path d="M12 2v14" />
                          </svg>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditModal(log)}
                        className="inline-flex h-7 w-7 items-center justify-center text-gray-300 hover:text-cyan-300"
                        aria-label={`Edit ${log.deckName}`}
                        title="Edit log"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
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
                        onClick={() => removeLog(log.id)}
                        className="inline-flex h-7 w-7 items-center justify-center text-gray-300 hover:text-red-300"
                        aria-label={`Delete ${log.deckName} log`}
                        title="Delete log"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
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
                    </>,
                    'log'
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-950/70 px-4 py-6 sm:items-center sm:py-8">
          <div className="w-full max-w-3xl rounded-2xl border border-gray-700 bg-gray-900 p-6 sm:p-8">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-lg font-semibold">Edit game log</h3>
                <p className="text-sm text-gray-400">{editTarget.deckName ?? 'Select deck'}</p>
              </div>
              {editTarget.kind === 'shared' && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-gray-300" htmlFor="shared-log-deck">
                    Your deck
                  </label>
                  <select
                    id="shared-log-deck"
                    value={editDeckId}
                    onChange={(event) => setEditDeckId(event.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200"
                  >
                    <option value="">Select deck...</option>
                    {decks.map((deck) => (
                      <option key={deck.id} value={deck.id}>
                        {deck.name} — {formatCommanderList(deck.commanderNames)}
                      </option>
                    ))}
                  </select>
                  {decksLoading && <p className="text-xs text-gray-400">Loading decks...</p>}
                  {!decksLoading && decks.length === 0 && (
                    <p className="text-xs text-gray-500">No decks found in your collection.</p>
                  )}
                </div>
              )}
              <label className="flex flex-col gap-2 text-sm text-gray-300">
                Date played
                <input
                  type="date"
                  value={editDate}
                  onChange={(event) => setEditDate(event.target.value)}
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
                    value={editTurns}
                    onChange={(event) => setEditTurns(event.target.value)}
                    className="px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-gray-300">
                  Length (minutes, optional)
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={editDurationMinutes}
                    onChange={(event) => setEditDurationMinutes(event.target.value)}
                    className="px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </label>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-300">Opponents</p>
                  {editOpponents.length === 0 && (
                    <button
                      type="button"
                      onClick={addEditOpponent}
                      className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
                      </svg>
                      Add opponent
                    </button>
                  )}
                </div>
                {editOpponents.length === 0 && (
                  <p className="text-xs text-gray-500">No opponents added yet.</p>
                )}
                {editOpponents.map((opponent, opponentIndex) => {
                  const opponentDecks = opponent.userId ? decksByUserId[opponent.userId] ?? [] : [];
                  const decksLoading = opponent.userId ? decksLoadingByUserId[opponent.userId] : false;
                  const decksError = opponent.userId ? decksErrorByUserId[opponent.userId] : null;
                  return (
                    <div
                      key={`${editTarget.id}-opponent-${opponentIndex}`}
                      className="rounded-lg border border-gray-700 bg-gray-800/50 p-3"
                      ref={opponentIndex === recentOpenIndex || opponentIndex === searchOpenIndex ? opponentDropdownRef : null}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={opponent.name}
                              onChange={(event) => updateEditOpponentField(opponentIndex, 'name', event.target.value)}
                              onFocus={() => openRecentOpponents(opponentIndex)}
                              placeholder="Name"
                              className="w-full min-w-0 px-3 py-2 rounded-lg bg-gray-800 text-white text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditOpponentSearch(opponentIndex)}
                              disabled={searchLoading && searchOpenIndex === opponentIndex}
                              className="w-full sm:w-auto rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-gray-800 disabled:opacity-60"
                            >
                              {searchLoading && searchOpenIndex === opponentIndex ? 'Searching...' : 'Search'}
                            </button>
                          </div>
                        <button
                          type="button"
                          onClick={() => removeEditOpponent(opponentIndex)}
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
                                onClick={() => applyEditOpponentUser(opponent.id, user)}
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
                                onClick={() => applyEditOpponentUser(opponent.id, user)}
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
                            <label className="text-xs text-gray-400" htmlFor={`opponent-deck-${opponent.id}`}>
                              Opponent deck
                            </label>
                            <select
                              id={`opponent-deck-${opponent.id}`}
                              value={opponent.deckId ?? ''}
                              onChange={(event) => selectEditOpponentDeck(opponentIndex, event.target.value)}
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
                                onChange={(event) => updateEditOpponentCommander(opponentIndex, cmdIndex, event.target.value)}
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
                                onClick={() => lookupOpponentCommander(opponentIndex, cmdIndex)}
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
                                  onClick={() => removeOpponentCommander(opponentIndex, cmdIndex)}
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
                              onClick={() => addOpponentCommander(opponentIndex)}
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
                            onChange={(value) => updateEditOpponentField(opponentIndex, 'colorIdentity', value)}
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
                {editOpponents.length > 0 && (
                  <button
                    type="button"
                    onClick={addEditOpponent}
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
                    onClick={() => setEditResult('win')}
                    className={`px-4 py-2 rounded-full text-sm border transition ${
                      editResult === 'win'
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                        : 'border-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    Win
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditResult('loss')}
                    className={`px-4 py-2 rounded-full text-sm border transition ${
                      editResult === 'loss'
                        ? 'border-rose-400 bg-rose-500/20 text-rose-100'
                        : 'border-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    Loss
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditResult('pending')}
                    className={`px-4 py-2 rounded-full text-sm border transition ${
                      editResult === 'pending'
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
                      onClick={() => toggleEditTag(tag)}
                      className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm border transition ${
                        editTags.includes(tag)
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                          : 'border-gray-700 text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                        {editTags.includes(tag) ? (
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        ) : (
                          <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
                        )}
                      </svg>
                      {tag}
                    </button>
                  ))}
                  {editTags
                    .filter((tag) => !PREDEFINED_TAGS.includes(tag as typeof PREDEFINED_TAGS[number]))
                    .map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleEditTag(tag)}
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
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomTag();
                      }
                    }}
                    placeholder="Add custom tag..."
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-gray-800 text-white text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={addCustomTag}
                    disabled={!customTagInput.trim()}
                    className="px-3 py-2 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800 disabled:opacity-60"
                  >
                    Add
                  </button>
                </div>
              </div>
              {editFormError && <p className="text-xs text-red-400">{editFormError}</p>}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setEditTarget(null);
                    setRecentOpenIndex(null);
                    setSearchOpenIndex(null);
                    clearSearch();
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-4 py-2 rounded-lg bg-cyan-500 text-gray-900 font-semibold hover:bg-cyan-400"
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {rejectTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/70 px-4 py-6">
          <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 sm:p-8">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Reject shared log?</h3>
                <p className="text-sm text-gray-400">
                  This removes the shared log from your queue. You can’t undo this action.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setRejectTargetId(null)}
                  className="px-4 py-2 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRejectSharedLog}
                  className="px-4 py-2 rounded-lg bg-red-500/90 text-white font-semibold hover:bg-red-500"
                >
                  Reject log
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {shareConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/70 px-4 py-6">
          <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 sm:p-8">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Reshare rejected logs?</h3>
                <p className="text-sm text-gray-400">
                  {shareConfirmTarget.rejectedCount === 1
                    ? '1 opponent rejected this log. Reshare it now?'
                    : `${shareConfirmTarget.rejectedCount} opponents rejected this log. Reshare it now?`}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {shareConfirmTarget.rejectedOpponents.map((opponent) => {
                  const label = opponent.name?.trim() || 'Unknown opponent';
                  const checked = shareSelectedOpponentIds.includes(opponent.userId);
                  return (
                    <label
                      key={opponent.userId}
                      className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950/40 px-3 py-2 text-sm text-gray-200"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setShareSelectedOpponentIds((current) => {
                            if (event.target.checked) {
                              return current.includes(opponent.userId)
                                ? current
                                : [...current, opponent.userId];
                            }
                            return current.filter((id) => id !== opponent.userId);
                          });
                        }}
                        className="h-4 w-4 accent-emerald-400"
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShareConfirmTarget(null)}
                  className="px-4 py-2 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmReshareLog}
                  disabled={shareSelectedOpponentIds.length === 0}
                  className="px-4 py-2 rounded-lg bg-emerald-500/90 text-white font-semibold hover:bg-emerald-500 disabled:opacity-60"
                >
                  Reshare
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
