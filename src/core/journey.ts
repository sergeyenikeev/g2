export type JourneyMilestoneId =
  | "tutorial_complete"
  | "first_run"
  | "runs_3"
  | "score_900"
  | "daily_complete"
  | "theme_unlock"
  | "score_1800";

export interface JourneyProgressState {
  claimedMilestoneIds: JourneyMilestoneId[];
}

export interface JourneyContext {
  tutorialCompleted: boolean;
  runsCount: number;
  bestScore: number;
  themesUnlockedCount: number;
  hasDailyCompletion: boolean;
}

export interface JourneyMilestoneDefinition {
  id: JourneyMilestoneId;
  titleKey: string;
  descriptionKey: string;
  rewardTokens: number;
  isComplete: (context: JourneyContext) => boolean;
}

export interface JourneyProgressSummary {
  updatedState: JourneyProgressState;
  newlyClaimed: JourneyMilestoneDefinition[];
  nextMilestones: JourneyMilestoneDefinition[];
  claimedCount: number;
  totalCount: number;
  totalRewardTokens: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const JOURNEY_MILESTONES: JourneyMilestoneDefinition[] = [
  {
    id: "tutorial_complete",
    titleKey: "journey.goal.tutorial_complete.title",
    descriptionKey: "journey.goal.tutorial_complete.description",
    rewardTokens: 4,
    isComplete: (context) => context.tutorialCompleted
  },
  {
    id: "first_run",
    titleKey: "journey.goal.first_run.title",
    descriptionKey: "journey.goal.first_run.description",
    rewardTokens: 4,
    isComplete: (context) => context.runsCount >= 1
  },
  {
    id: "runs_3",
    titleKey: "journey.goal.runs_3.title",
    descriptionKey: "journey.goal.runs_3.description",
    rewardTokens: 5,
    isComplete: (context) => context.runsCount >= 3
  },
  {
    id: "score_900",
    titleKey: "journey.goal.score_900.title",
    descriptionKey: "journey.goal.score_900.description",
    rewardTokens: 6,
    isComplete: (context) => context.bestScore >= 900
  },
  {
    id: "daily_complete",
    titleKey: "journey.goal.daily_complete.title",
    descriptionKey: "journey.goal.daily_complete.description",
    rewardTokens: 6,
    isComplete: (context) => context.hasDailyCompletion
  },
  {
    id: "theme_unlock",
    titleKey: "journey.goal.theme_unlock.title",
    descriptionKey: "journey.goal.theme_unlock.description",
    rewardTokens: 7,
    isComplete: (context) => context.themesUnlockedCount >= 2
  },
  {
    id: "score_1800",
    titleKey: "journey.goal.score_1800.title",
    descriptionKey: "journey.goal.score_1800.description",
    rewardTokens: 8,
    isComplete: (context) => context.bestScore >= 1800
  }
];

const isJourneyMilestoneId = (value: unknown): value is JourneyMilestoneId =>
  JOURNEY_MILESTONES.some((milestone) => milestone.id === value);

export const createDefaultJourneyProgress = (): JourneyProgressState => ({
  claimedMilestoneIds: []
});

export const normalizeJourneyProgress = (value: unknown): JourneyProgressState => {
  const raw = isRecord(value) ? value : {};
  const claimedSource = Array.isArray(raw.claimedMilestoneIds) ? raw.claimedMilestoneIds : [];
  const claimedMilestoneIds = Array.from(
    new Set(claimedSource.filter((entry): entry is JourneyMilestoneId => isJourneyMilestoneId(entry)))
  );

  return {
    claimedMilestoneIds
  };
};

export const getJourneyMilestones = (): JourneyMilestoneDefinition[] => JOURNEY_MILESTONES.slice();

export const resolveJourneyProgress = (
  state: JourneyProgressState,
  context: JourneyContext
): JourneyProgressSummary => {
  const claimed = new Set<JourneyMilestoneId>(state.claimedMilestoneIds);
  const newlyClaimed: JourneyMilestoneDefinition[] = [];

  for (const milestone of JOURNEY_MILESTONES) {
    if (claimed.has(milestone.id) || !milestone.isComplete(context)) {
      continue;
    }
    claimed.add(milestone.id);
    newlyClaimed.push(milestone);
  }

  const updatedState: JourneyProgressState = {
    claimedMilestoneIds: JOURNEY_MILESTONES.filter((milestone) => claimed.has(milestone.id)).map(
      (milestone) => milestone.id
    )
  };

  return {
    updatedState,
    newlyClaimed,
    nextMilestones: JOURNEY_MILESTONES.filter((milestone) => !claimed.has(milestone.id)),
    claimedCount: updatedState.claimedMilestoneIds.length,
    totalCount: JOURNEY_MILESTONES.length,
    totalRewardTokens: newlyClaimed.reduce((sum, milestone) => sum + milestone.rewardTokens, 0)
  };
};
