import { GameMode } from "../core/types";

export type LeaderboardMode = Exclude<GameMode, "tutorial">;

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  score: number;
  mode: LeaderboardMode;
  level: number;
  lines: number;
  moves: number;
  durationMs: number;
  seed: string;
  createdAt: number;
  dateKey: string;
}

export interface LeaderboardState {
  allTime: LeaderboardEntry[];
  daily: LeaderboardEntry[];
}

export interface StoredLeaderboardSnapshot {
  allTime: unknown;
  daily: unknown;
}

export interface RecordLeaderboardResult {
  state: LeaderboardState;
  overallRank: number | null;
  dailyRank: number | null;
}

export interface LeaderboardEntryExtraData {
  playerName?: string;
  mode?: LeaderboardMode;
  level?: number;
  lines?: number;
  moves?: number;
  durationMs?: number;
  seed?: string;
  createdAt?: number;
  dateKey?: string;
}

export const MAX_LEADERBOARD_ENTRIES = 10;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isLeaderboardMode = (value: unknown): value is LeaderboardMode =>
  value === "play" || value === "daily";

const isDateKey = (value: unknown): value is string =>
  typeof value === "string" && /^\d{8}$/.test(value);

const coerceInt = (value: unknown, fallback: number, minimum = 0): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(minimum, Math.floor(value));
};

const compareEntries = (left: LeaderboardEntry, right: LeaderboardEntry): number =>
  right.score - left.score ||
  right.level - left.level ||
  right.lines - left.lines ||
  right.moves - left.moves ||
  left.durationMs - right.durationMs ||
  left.createdAt - right.createdAt;

const sortEntries = (entries: LeaderboardEntry[]): LeaderboardEntry[] =>
  [...entries].sort(compareEntries);

const normalizeEntry = (
  value: unknown,
  fallbackDateKey: string,
  index: number
): LeaderboardEntry | null => {
  if (!isRecord(value) || !isLeaderboardMode(value.mode)) {
    return null;
  }

  const score = coerceInt(value.score, -1);
  if (score < 0) {
    return null;
  }

  const level = coerceInt(value.level, 1, 1);
  const lines = coerceInt(value.lines, 0);
  const moves = coerceInt(value.moves, 0);
  const durationMs = coerceInt(value.durationMs, 0);
  const createdAt = coerceInt(value.createdAt, 0);
  const seed = typeof value.seed === "string" ? value.seed : "unknown";
  const dateKey = isDateKey(value.dateKey) ? value.dateKey : fallbackDateKey;
  const id =
    typeof value.id === "string" && value.id.trim().length > 0
      ? value.id
      : `${value.mode}_${dateKey}_${score}_${index}`;
  const playerName =
    typeof value.playerName === "string" ? value.playerName.replace(/\s+/g, " ").trim().slice(0, 18) : "";

  return {
    id,
    playerName,
    score,
    mode: value.mode,
    level,
    lines,
    moves,
    durationMs,
    seed,
    createdAt,
    dateKey
  };
};

const normalizeCollection = (value: unknown, fallbackDateKey: string): LeaderboardEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries = value.flatMap((item, index) => {
    const normalized = normalizeEntry(item, fallbackDateKey, index);
    return normalized ? [normalized] : [];
  });

  return sortEntries(entries).slice(0, MAX_LEADERBOARD_ENTRIES);
};

export const createEmptyLeaderboard = (): LeaderboardState => ({
  allTime: [],
  daily: []
});

export const serializeLeaderboardEntryExtraData = (entry: LeaderboardEntry): string =>
  JSON.stringify({
    playerName: entry.playerName,
    mode: entry.mode,
    level: entry.level,
    lines: entry.lines,
    moves: entry.moves,
    durationMs: entry.durationMs,
    seed: entry.seed,
    createdAt: entry.createdAt,
    dateKey: entry.dateKey
  } satisfies LeaderboardEntryExtraData);

export const parseLeaderboardEntryExtraData = (
  value: unknown,
  fallbackDateKey: string
): LeaderboardEntryExtraData => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed)) {
      return {};
    }
    const playerName =
      typeof parsed.playerName === "string"
        ? parsed.playerName.replace(/\s+/g, " ").trim().slice(0, 18)
        : undefined;
    return {
      playerName,
      mode: isLeaderboardMode(parsed.mode) ? parsed.mode : undefined,
      level: coerceInt(parsed.level, 1, 1),
      lines: coerceInt(parsed.lines, 0),
      moves: coerceInt(parsed.moves, 0),
      durationMs: coerceInt(parsed.durationMs, 0),
      seed: typeof parsed.seed === "string" ? parsed.seed : undefined,
      createdAt: coerceInt(parsed.createdAt, 0),
      dateKey: isDateKey(parsed.dateKey) ? parsed.dateKey : fallbackDateKey
    };
  } catch {
    return {};
  }
};

export const normalizeStoredLeaderboard = (snapshot: unknown, fallbackDateKey: string): LeaderboardState => {
  if (!snapshot || !isRecord(snapshot)) {
    return createEmptyLeaderboard();
  }

  const dailyEntries = Array.isArray(snapshot.daily)
    ? snapshot.daily.flatMap((item, index) => {
        const normalized = normalizeEntry(item, fallbackDateKey, index);
        return normalized && normalized.mode === "daily" ? [normalized] : [];
      })
    : [];

  return {
    allTime: normalizeCollection(snapshot.allTime, fallbackDateKey),
    daily: sortEntries(dailyEntries).slice(0, MAX_LEADERBOARD_ENTRIES)
  };
};

export const recordLeaderboardEntry = (
  state: LeaderboardState,
  entry: LeaderboardEntry
): RecordLeaderboardResult => {
  const allTimeSorted = sortEntries([...state.allTime, entry]);
  const overallIndex = allTimeSorted.findIndex((candidate) => candidate.id === entry.id);
  const dailySorted =
    entry.mode === "daily" ? sortEntries([...state.daily, entry]) : sortEntries(state.daily);
  const dailyIndex = dailySorted.findIndex((candidate) => candidate.id === entry.id);

  return {
    state: {
      allTime: allTimeSorted.slice(0, MAX_LEADERBOARD_ENTRIES),
      daily: dailySorted
        .filter((candidate) => candidate.mode === "daily")
        .slice(0, MAX_LEADERBOARD_ENTRIES)
    },
    overallRank:
      overallIndex >= 0 && overallIndex < MAX_LEADERBOARD_ENTRIES ? overallIndex + 1 : null,
    dailyRank:
      dailyIndex >= 0 && dailyIndex < MAX_LEADERBOARD_ENTRIES ? dailyIndex + 1 : null
  };
};
