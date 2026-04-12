import type { DailyMissionStatus } from "./dailyMissions";
import { getJourneyMilestones, type JourneyContext, type JourneyProgressState } from "./journey";

export type ResultsNextStep =
  | {
      kind: "daily_mission_daily";
      rewardTokens: number;
    }
  | {
      kind: "daily_mission_lines";
      remaining: number;
      rewardTokens: number;
    }
  | {
      kind: "journey_runs";
      remaining: number;
      rewardTokens: number;
      titleKey: string;
    }
  | {
      kind: "journey_score";
      remaining: number;
      rewardTokens: number;
      titleKey: string;
    };

const JOURNEY_MILESTONES = getJourneyMilestones();

const getJourneyMilestone = (id: string) => JOURNEY_MILESTONES.find((milestone) => milestone.id === id);

export const resolveResultsNextStep = (
  dailyStatuses: DailyMissionStatus[],
  journey: JourneyProgressState,
  context: JourneyContext
): ResultsNextStep | null => {
  const unfinishedDaily = dailyStatuses.filter((status) => !status.claimed && !status.completed);
  const dailyFinish = unfinishedDaily.find((status) => status.definition.id === "finish_daily");
  if (dailyFinish) {
    return {
      kind: "daily_mission_daily",
      rewardTokens: dailyFinish.definition.rewardTokens
    };
  }

  const linesMission = unfinishedDaily.find((status) => status.definition.id === "clear_12_lines");
  if (linesMission) {
    const remaining = Math.max(0, linesMission.definition.targetValue - linesMission.progressValue);
    if (remaining > 0 && remaining <= 6) {
      return {
        kind: "daily_mission_lines",
        remaining,
        rewardTokens: linesMission.definition.rewardTokens
      };
    }
  }

  const claimed = new Set(journey.claimedMilestoneIds);

  if (!claimed.has("runs_3")) {
    const remainingRuns = Math.max(0, 3 - context.runsCount);
    const milestone = getJourneyMilestone("runs_3");
    if (milestone && remainingRuns > 0 && remainingRuns <= 1) {
      return {
        kind: "journey_runs",
        remaining: remainingRuns,
        rewardTokens: milestone.rewardTokens,
        titleKey: milestone.titleKey
      };
    }
  }

  if (!claimed.has("score_900")) {
    const remainingScore = Math.max(0, 900 - context.bestScore);
    const milestone = getJourneyMilestone("score_900");
    if (milestone && remainingScore > 0 && remainingScore <= 250) {
      return {
        kind: "journey_score",
        remaining: remainingScore,
        rewardTokens: milestone.rewardTokens,
        titleKey: milestone.titleKey
      };
    }
  }

  if (claimed.has("score_900") && !claimed.has("score_1800")) {
    const remainingScore = Math.max(0, 1800 - context.bestScore);
    const milestone = getJourneyMilestone("score_1800");
    if (milestone && remainingScore > 0 && remainingScore <= 400) {
      return {
        kind: "journey_score",
        remaining: remainingScore,
        rewardTokens: milestone.rewardTokens,
        titleKey: milestone.titleKey
      };
    }
  }

  return null;
};
