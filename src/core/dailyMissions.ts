import type { GameMode } from "./types";

export type DailyMissionId = "finish_run" | "clear_12_lines" | "finish_daily";

export interface DailyMissionStats {
  completedRuns: number;
  totalLinesCleared: number;
  completedDaily: boolean;
}

export interface DailyMissionProgressState {
  dateKey: string | null;
  claimedMissionIds: DailyMissionId[];
  stats: DailyMissionStats;
}

export interface DailyMissionDefinition {
  id: DailyMissionId;
  titleKey: string;
  descriptionKey: string;
  rewardTokens: number;
  targetValue: number;
  getProgressValue: (stats: DailyMissionStats) => number;
}

export interface DailyMissionStatus {
  definition: DailyMissionDefinition;
  progressValue: number;
  completed: boolean;
  claimed: boolean;
}

export interface DailyMissionRunSummary {
  mode: GameMode;
  linesCleared: number;
}

export interface DailyMissionResolution {
  updatedState: DailyMissionProgressState;
  statuses: DailyMissionStatus[];
  newlyClaimed: DailyMissionDefinition[];
  totalRewardTokens: number;
}

const DAILY_MISSIONS: DailyMissionDefinition[] = [
  {
    id: "finish_run",
    titleKey: "daily_mission.finish_run.title",
    descriptionKey: "daily_mission.finish_run.description",
    rewardTokens: 3,
    targetValue: 1,
    getProgressValue: (stats) => stats.completedRuns
  },
  {
    id: "clear_12_lines",
    titleKey: "daily_mission.clear_12_lines.title",
    descriptionKey: "daily_mission.clear_12_lines.description",
    rewardTokens: 4,
    targetValue: 12,
    getProgressValue: (stats) => stats.totalLinesCleared
  },
  {
    id: "finish_daily",
    titleKey: "daily_mission.finish_daily.title",
    descriptionKey: "daily_mission.finish_daily.description",
    rewardTokens: 5,
    targetValue: 1,
    getProgressValue: (stats) => (stats.completedDaily ? 1 : 0)
  }
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sanitizeDateKey = (value: unknown): string | null =>
  typeof value === "string" && /^\d{8}$/.test(value) ? value : null;

const sanitizeInt = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
};

const isDailyMissionId = (value: unknown): value is DailyMissionId =>
  DAILY_MISSIONS.some((mission) => mission.id === value);

const createDefaultStats = (): DailyMissionStats => ({
  completedRuns: 0,
  totalLinesCleared: 0,
  completedDaily: false
});

export const createDefaultDailyMissionProgress = (
  dateKey: string | null = null
): DailyMissionProgressState => ({
  dateKey,
  claimedMissionIds: [],
  stats: createDefaultStats()
});

export const normalizeDailyMissionProgress = (
  value: unknown,
  currentDateKey: string | null
): DailyMissionProgressState => {
  const raw = isRecord(value) ? value : {};
  const storedDateKey = sanitizeDateKey(raw.dateKey);
  if (!currentDateKey || storedDateKey !== currentDateKey) {
    return createDefaultDailyMissionProgress(currentDateKey);
  }

  const rawStats = isRecord(raw.stats) ? raw.stats : {};
  const claimedMissionIds = Array.isArray(raw.claimedMissionIds)
    ? Array.from(
        new Set(
          raw.claimedMissionIds.filter((entry): entry is DailyMissionId => isDailyMissionId(entry))
        )
      )
    : [];

  return {
    dateKey: currentDateKey,
    claimedMissionIds,
    stats: {
      completedRuns: sanitizeInt(rawStats.completedRuns),
      totalLinesCleared: sanitizeInt(rawStats.totalLinesCleared),
      completedDaily: rawStats.completedDaily === true
    }
  };
};

const buildStatuses = (state: DailyMissionProgressState): DailyMissionStatus[] => {
  const claimed = new Set<DailyMissionId>(state.claimedMissionIds);
  return DAILY_MISSIONS.map((definition) => {
    const progressValue = Math.min(
      definition.targetValue,
      definition.getProgressValue(state.stats)
    );
    return {
      definition,
      progressValue,
      completed: progressValue >= definition.targetValue,
      claimed: claimed.has(definition.id)
    };
  });
};

export const getDailyMissionStatuses = (
  state: DailyMissionProgressState,
  currentDateKey: string | null
): DailyMissionStatus[] => buildStatuses(normalizeDailyMissionProgress(state, currentDateKey));

export const applyCompletedRunToDailyMissions = (
  state: DailyMissionProgressState,
  currentDateKey: string,
  summary: DailyMissionRunSummary
): DailyMissionResolution => {
  const normalized = normalizeDailyMissionProgress(state, currentDateKey);
  const nextStats: DailyMissionStats = {
    completedRuns: normalized.stats.completedRuns + 1,
    totalLinesCleared: normalized.stats.totalLinesCleared + Math.max(0, summary.linesCleared),
    completedDaily: normalized.stats.completedDaily || summary.mode === "daily"
  };

  const claimed = new Set<DailyMissionId>(normalized.claimedMissionIds);
  const updatedState: DailyMissionProgressState = {
    dateKey: currentDateKey,
    claimedMissionIds: normalized.claimedMissionIds.slice(),
    stats: nextStats
  };

  const statuses = buildStatuses(updatedState);
  const newlyClaimed: DailyMissionDefinition[] = [];

  for (const status of statuses) {
    if (!status.completed || claimed.has(status.definition.id)) {
      continue;
    }
    claimed.add(status.definition.id);
    updatedState.claimedMissionIds.push(status.definition.id);
    newlyClaimed.push(status.definition);
  }

  return {
    updatedState,
    statuses: buildStatuses(updatedState),
    newlyClaimed,
    totalRewardTokens: newlyClaimed.reduce((sum, mission) => sum + mission.rewardTokens, 0)
  };
};
