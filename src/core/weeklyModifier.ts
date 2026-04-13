import { getWeekKeyFromDateKey } from "./weeklyLoop";

export interface WeeklyModifierRunContext {
  score: number;
  linesCleared: number;
  level: number;
  peakCombo: number;
}

export interface WeeklyModifierDefinition {
  id: "score_sprint" | "line_sweep" | "level_climb" | "combo_pulse";
  titleKey: string;
  goalKey: string;
  metric: "score" | "lines" | "level" | "combo";
  targetValue: number;
  rewardTokens: number;
  nearThreshold: number;
}

export interface WeeklyModifierState {
  weekKey: string | null;
  claimedModifierId: string | null;
  claimedDateKey: string | null;
}

export interface WeeklyModifierStatus {
  weekKey: string | null;
  definition: WeeklyModifierDefinition | null;
  claimed: boolean;
  completed: boolean;
  progressValue: number;
  remaining: number;
}

export interface WeeklyModifierResolution extends WeeklyModifierStatus {
  updatedState: WeeklyModifierState;
  newlyClaimed: boolean;
  rewardTokens: number;
}

export const WEEKLY_MODIFIER_DEFINITIONS: WeeklyModifierDefinition[] = [
  {
    id: "score_sprint",
    titleKey: "weekly_modifier.name.score",
    goalKey: "weekly_modifier.goal.score",
    metric: "score",
    targetValue: 1400,
    rewardTokens: 8,
    nearThreshold: 300
  },
  {
    id: "line_sweep",
    titleKey: "weekly_modifier.name.lines",
    goalKey: "weekly_modifier.goal.lines",
    metric: "lines",
    targetValue: 18,
    rewardTokens: 8,
    nearThreshold: 4
  },
  {
    id: "level_climb",
    titleKey: "weekly_modifier.name.level",
    goalKey: "weekly_modifier.goal.level",
    metric: "level",
    targetValue: 4,
    rewardTokens: 8,
    nearThreshold: 1
  },
  {
    id: "combo_pulse",
    titleKey: "weekly_modifier.name.combo",
    goalKey: "weekly_modifier.goal.combo",
    metric: "combo",
    targetValue: 2.25,
    rewardTokens: 8,
    nearThreshold: 0.25
  }
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeDateKey = (value: unknown): string | null =>
  typeof value === "string" && /^\d{8}$/.test(value) ? value : null;

const getWeekHash = (weekKey: string): number =>
  weekKey.split("").reduce((sum, char) => sum + Number.parseInt(char, 10), 0);

const getProgressValue = (
  definition: WeeklyModifierDefinition,
  run?: WeeklyModifierRunContext
): number => {
  if (!run) {
    return 0;
  }
  switch (definition.metric) {
    case "score":
      return run.score;
    case "lines":
      return run.linesCleared;
    case "level":
      return run.level;
    case "combo":
      return Number.parseFloat(run.peakCombo.toFixed(2));
  }
};

const getRemainingValue = (definition: WeeklyModifierDefinition, progressValue: number): number => {
  const remaining = definition.targetValue - progressValue;
  if (definition.metric === "combo") {
    return Math.max(0, Number.parseFloat(remaining.toFixed(2)));
  }
  return Math.max(0, Math.ceil(remaining));
};

export const createDefaultWeeklyModifierState = (
  weekKey: string | null = null
): WeeklyModifierState => ({
  weekKey,
  claimedModifierId: null,
  claimedDateKey: null
});

export const getWeeklyModifierDefinition = (
  weekKey: string | null
): WeeklyModifierDefinition | null => {
  if (!weekKey) {
    return null;
  }
  const index = getWeekHash(weekKey) % WEEKLY_MODIFIER_DEFINITIONS.length;
  return WEEKLY_MODIFIER_DEFINITIONS[index] ?? WEEKLY_MODIFIER_DEFINITIONS[0] ?? null;
};

export const normalizeWeeklyModifierState = (
  value: unknown,
  currentDateKey: string | null
): WeeklyModifierState => {
  const currentWeekKey = currentDateKey ? getWeekKeyFromDateKey(currentDateKey) : null;
  const raw = isRecord(value) ? value : {};
  const storedWeekKey = normalizeDateKey(raw.weekKey);
  if (!currentWeekKey || storedWeekKey !== currentWeekKey) {
    return createDefaultWeeklyModifierState(currentWeekKey);
  }

  const definition = getWeeklyModifierDefinition(currentWeekKey);
  const claimedModifierId =
    typeof raw.claimedModifierId === "string" && raw.claimedModifierId === definition?.id
      ? raw.claimedModifierId
      : null;

  return {
    weekKey: currentWeekKey,
    claimedModifierId,
    claimedDateKey: claimedModifierId ? normalizeDateKey(raw.claimedDateKey) : null
  };
};

export const getWeeklyModifierStatus = (
  state: WeeklyModifierState,
  currentDateKey: string | null,
  run?: WeeklyModifierRunContext
): WeeklyModifierStatus => {
  const normalized = normalizeWeeklyModifierState(state, currentDateKey);
  const definition = getWeeklyModifierDefinition(normalized.weekKey);
  if (!definition) {
    return {
      weekKey: normalized.weekKey,
      definition: null,
      claimed: false,
      completed: false,
      progressValue: 0,
      remaining: 0
    };
  }

  const progressValue = getProgressValue(definition, run);
  return {
    weekKey: normalized.weekKey,
    definition,
    claimed: normalized.claimedModifierId === definition.id,
    completed: progressValue >= definition.targetValue,
    progressValue,
    remaining: getRemainingValue(definition, progressValue)
  };
};

export const isWeeklyModifierClose = (status: WeeklyModifierStatus): boolean =>
  Boolean(
    status.definition &&
      !status.claimed &&
      !status.completed &&
      status.remaining > 0 &&
      status.remaining <= status.definition.nearThreshold
  );

export const applyRunToWeeklyModifier = (
  state: WeeklyModifierState,
  currentDateKey: string,
  run: WeeklyModifierRunContext
): WeeklyModifierResolution => {
  const normalized = normalizeWeeklyModifierState(state, currentDateKey);
  const status = getWeeklyModifierStatus(normalized, currentDateKey, run);
  if (!status.definition || status.claimed || !status.completed) {
    return {
      updatedState: normalized,
      newlyClaimed: false,
      rewardTokens: 0,
      ...status
    };
  }

  const updatedState: WeeklyModifierState = {
    weekKey: normalized.weekKey,
    claimedModifierId: status.definition.id,
    claimedDateKey: currentDateKey
  };

  return {
    updatedState,
    newlyClaimed: true,
    rewardTokens: status.definition.rewardTokens,
    ...status
  };
};
