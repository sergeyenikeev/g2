export interface WeeklyLoopMilestone {
  days: number;
  rewardTokens: number;
}

export interface WeeklyLoopState {
  weekKey: string | null;
  completedDateKeys: string[];
  claimedMilestoneDays: number[];
}

export interface WeeklyLoopStatus {
  weekKey: string | null;
  completedDays: number;
  completedToday: boolean;
  nextMilestoneDay: number | null;
  nextMilestoneTokens: number;
  goalDays: number;
  complete: boolean;
}

export interface WeeklyLoopResolution extends WeeklyLoopStatus {
  updatedState: WeeklyLoopState;
  advanced: boolean;
  newlyClaimedMilestones: WeeklyLoopMilestone[];
  totalRewardTokens: number;
}

export const WEEKLY_LOOP_MILESTONES: WeeklyLoopMilestone[] = [
  { days: 3, rewardTokens: 6 },
  { days: 5, rewardTokens: 9 }
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

const fromEpochDay = (epochDay: number): string => {
  const date = new Date(epochDay * 86_400_000);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
};

export const getWeekKeyFromDateKey = (dateKey: string): string => {
  const epochDay = toEpochDay(dateKey);
  const date = new Date(epochDay * 86_400_000);
  const dayOfWeek = date.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  return fromEpochDay(epochDay + mondayOffset);
};

export const createDefaultWeeklyLoopState = (weekKey: string | null = null): WeeklyLoopState => ({
  weekKey,
  completedDateKeys: [],
  claimedMilestoneDays: []
});

export const normalizeWeeklyLoopState = (
  value: unknown,
  currentDateKey: string | null
): WeeklyLoopState => {
  const currentWeekKey = currentDateKey ? getWeekKeyFromDateKey(currentDateKey) : null;
  const raw = isRecord(value) ? value : {};
  const storedWeekKey = normalizeDateKey(raw.weekKey);
  if (!currentWeekKey || storedWeekKey !== currentWeekKey) {
    return createDefaultWeeklyLoopState(currentWeekKey);
  }

  const completedDateKeys = Array.isArray(raw.completedDateKeys)
    ? Array.from(
        new Set(
          raw.completedDateKeys.filter((entry): entry is string => normalizeDateKey(entry) !== null)
        )
      ).sort()
    : [];
  const claimedMilestoneDays = Array.isArray(raw.claimedMilestoneDays)
    ? Array.from(
        new Set(
          raw.claimedMilestoneDays.filter((entry): entry is number =>
            WEEKLY_LOOP_MILESTONES.some((milestone) => milestone.days === normalizeInt(entry))
          )
        )
      ).sort((left, right) => left - right)
    : [];

  return {
    weekKey: currentWeekKey,
    completedDateKeys: completedDateKeys.filter(
      (entry) => getWeekKeyFromDateKey(entry) === currentWeekKey
    ),
    claimedMilestoneDays
  };
};

export const getWeeklyLoopStatus = (
  state: WeeklyLoopState,
  currentDateKey: string | null
): WeeklyLoopStatus => {
  const normalized = normalizeWeeklyLoopState(state, currentDateKey);
  const completedDays = normalized.completedDateKeys.length;
  const nextMilestone =
    WEEKLY_LOOP_MILESTONES.find((milestone) => !normalized.claimedMilestoneDays.includes(milestone.days)) ??
    null;

  return {
    weekKey: normalized.weekKey,
    completedDays,
    completedToday: currentDateKey ? normalized.completedDateKeys.includes(currentDateKey) : false,
    nextMilestoneDay: nextMilestone?.days ?? null,
    nextMilestoneTokens: nextMilestone?.rewardTokens ?? 0,
    goalDays:
      nextMilestone?.days ??
      Math.max(completedDays, WEEKLY_LOOP_MILESTONES[WEEKLY_LOOP_MILESTONES.length - 1]!.days),
    complete: nextMilestone === null
  };
};

export const applyDailyCompletionToWeeklyLoop = (
  state: WeeklyLoopState,
  currentDateKey: string
): WeeklyLoopResolution => {
  const normalized = normalizeWeeklyLoopState(state, currentDateKey);
  if (normalized.completedDateKeys.includes(currentDateKey)) {
    const status = getWeeklyLoopStatus(normalized, currentDateKey);
    return {
      updatedState: normalized,
      advanced: false,
      newlyClaimedMilestones: [],
      totalRewardTokens: 0,
      ...status
    };
  }

  const updatedState: WeeklyLoopState = {
    weekKey: normalized.weekKey,
    completedDateKeys: [...normalized.completedDateKeys, currentDateKey].sort(),
    claimedMilestoneDays: normalized.claimedMilestoneDays.slice()
  };

  const newlyClaimedMilestones: WeeklyLoopMilestone[] = [];
  for (const milestone of WEEKLY_LOOP_MILESTONES) {
    if (
      updatedState.completedDateKeys.length >= milestone.days &&
      !updatedState.claimedMilestoneDays.includes(milestone.days)
    ) {
      updatedState.claimedMilestoneDays.push(milestone.days);
      newlyClaimedMilestones.push(milestone);
    }
  }

  updatedState.claimedMilestoneDays.sort((left, right) => left - right);
  const status = getWeeklyLoopStatus(updatedState, currentDateKey);

  return {
    updatedState,
    advanced: true,
    newlyClaimedMilestones,
    totalRewardTokens: newlyClaimedMilestones.reduce(
      (sum, milestone) => sum + milestone.rewardTokens,
      0
    ),
    ...status
  };
};
