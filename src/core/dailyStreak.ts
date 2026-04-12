export interface DailyStreakState {
  current: number;
  best: number;
  lastCompletedDate: string | null;
}

export interface DailyStreakMilestone {
  day: number;
  rewardTokens: number;
}

export interface DailyStreakStatus {
  current: number;
  best: number;
  activeToday: boolean;
  nextMilestoneDay: number | null;
  nextMilestoneTokens: number;
  remainingDays: number | null;
}

export interface DailyStreakResolution extends DailyStreakStatus {
  updatedState: DailyStreakState;
  advanced: boolean;
  milestoneReached: number | null;
  milestoneRewardTokens: number;
}

export const DAILY_STREAK_MILESTONES: DailyStreakMilestone[] = [
  { day: 3, rewardTokens: 5 },
  { day: 5, rewardTokens: 7 },
  { day: 7, rewardTokens: 10 }
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeDateKey = (value: unknown): string | null =>
  typeof value === "string" && /^\d{8}$/.test(value) ? value : null;

const normalizeInt = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
};

const toEpochDay = (dateKey: string): number => {
  const year = Number.parseInt(dateKey.slice(0, 4), 10);
  const month = Number.parseInt(dateKey.slice(4, 6), 10);
  const day = Number.parseInt(dateKey.slice(6, 8), 10);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
};

const getDayDistance = (fromDateKey: string, toDateKey: string): number =>
  toEpochDay(toDateKey) - toEpochDay(fromDateKey);

const getActiveStreakCount = (state: DailyStreakState, todayKey: string): number => {
  if (!state.lastCompletedDate) {
    return 0;
  }
  if (state.lastCompletedDate === todayKey) {
    return state.current;
  }
  return getDayDistance(state.lastCompletedDate, todayKey) === 1 ? state.current : 0;
};

const getNextMilestone = (current: number): DailyStreakMilestone | null =>
  DAILY_STREAK_MILESTONES.find((milestone) => milestone.day > current) ?? null;

const getMilestoneReward = (day: number): DailyStreakMilestone | null =>
  DAILY_STREAK_MILESTONES.find((milestone) => milestone.day === day) ?? null;

export const createDefaultDailyStreakState = (): DailyStreakState => ({
  current: 0,
  best: 0,
  lastCompletedDate: null
});

export const normalizeDailyStreakState = (value: unknown): DailyStreakState => {
  const raw = isRecord(value) ? value : {};
  const current = normalizeInt(raw.current);
  const best = Math.max(current, normalizeInt(raw.best));

  return {
    current,
    best,
    lastCompletedDate: normalizeDateKey(raw.lastCompletedDate)
  };
};

export const getDailyStreakStatus = (
  state: DailyStreakState,
  todayKey: string
): DailyStreakStatus => {
  const current = getActiveStreakCount(state, todayKey);
  const nextMilestone = getNextMilestone(current);

  return {
    current,
    best: Math.max(state.best, current),
    activeToday: state.lastCompletedDate === todayKey,
    nextMilestoneDay: nextMilestone?.day ?? null,
    nextMilestoneTokens: nextMilestone?.rewardTokens ?? 0,
    remainingDays: nextMilestone ? Math.max(0, nextMilestone.day - current) : null
  };
};

export const applyDailyCompletionToStreak = (
  state: DailyStreakState,
  todayKey: string
): DailyStreakResolution => {
  const normalized = normalizeDailyStreakState(state);
  if (normalized.lastCompletedDate === todayKey) {
    const status = getDailyStreakStatus(normalized, todayKey);
    return {
      updatedState: normalized,
      advanced: false,
      milestoneReached: null,
      milestoneRewardTokens: 0,
      ...status
    };
  }

  const current = getActiveStreakCount(normalized, todayKey);
  const nextCurrent =
    normalized.lastCompletedDate && getDayDistance(normalized.lastCompletedDate, todayKey) === 1
      ? current + 1
      : 1;
  const updatedState: DailyStreakState = {
    current: nextCurrent,
    best: Math.max(normalized.best, nextCurrent),
    lastCompletedDate: todayKey
  };
  const milestone = getMilestoneReward(nextCurrent);
  const status = getDailyStreakStatus(updatedState, todayKey);

  return {
    updatedState,
    advanced: true,
    milestoneReached: milestone?.day ?? null,
    milestoneRewardTokens: milestone?.rewardTokens ?? 0,
    ...status
  };
};
