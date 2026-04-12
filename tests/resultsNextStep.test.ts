import { describe, expect, it } from "vitest";
import type { DailyMissionStatus } from "../src/core/dailyMissions";
import { resolveResultsNextStep } from "../src/core/resultsNextStep";
import type { JourneyContext, JourneyProgressState } from "../src/core/journey";

const createMissionStatus = (
  overrides: Partial<DailyMissionStatus> & {
    id: "finish_run" | "clear_12_lines" | "finish_daily";
  }
): DailyMissionStatus => ({
  definition: {
    id: overrides.id,
    titleKey: `${overrides.id}.title`,
    descriptionKey: `${overrides.id}.description`,
    rewardTokens: overrides.definition?.rewardTokens ?? 4,
    targetValue: overrides.definition?.targetValue ?? 1,
    getProgressValue: () => overrides.progressValue ?? 0
  },
  progressValue: overrides.progressValue ?? 0,
  completed: overrides.completed ?? false,
  claimed: overrides.claimed ?? false
});

const createJourneyContext = (overrides: Partial<JourneyContext> = {}): JourneyContext => ({
  tutorialCompleted: true,
  runsCount: 2,
  bestScore: 760,
  themesUnlockedCount: 1,
  hasDailyCompletion: false,
  ...overrides
});

const createJourney = (overrides: Partial<JourneyProgressState> = {}): JourneyProgressState => ({
  claimedMilestoneIds: [],
  ...overrides
});

describe("results next step", () => {
  it("prioritizes the unfinished daily challenge mission", () => {
    expect(
      resolveResultsNextStep(
        [
          createMissionStatus({ id: "finish_daily", progressValue: 0, completed: false, claimed: false })
        ],
        createJourney(),
        createJourneyContext()
      )
    ).toEqual({
      kind: "daily_mission_daily",
      rewardTokens: 4
    });
  });

  it("suggests close line missions before journey goals", () => {
    expect(
      resolveResultsNextStep(
        [
          createMissionStatus({
            id: "clear_12_lines",
            progressValue: 8,
            completed: false,
            claimed: false,
            definition: {
              id: "clear_12_lines",
              titleKey: "lines.title",
              descriptionKey: "lines.description",
              rewardTokens: 5,
              targetValue: 12,
              getProgressValue: () => 8
            }
          })
        ],
        createJourney(),
        createJourneyContext()
      )
    ).toEqual({
      kind: "daily_mission_lines",
      remaining: 4,
      rewardTokens: 5
    });
  });

  it("falls back to a near journey run goal", () => {
    expect(
      resolveResultsNextStep([], createJourney(), createJourneyContext({ runsCount: 2 }))
    ).toEqual({
      kind: "journey_runs",
      remaining: 1,
      rewardTokens: 5,
      titleKey: "journey.goal.runs_3.title"
    });
  });

  it("suggests a near score goal when run goals are already claimed", () => {
    expect(
      resolveResultsNextStep(
        [],
        createJourney({ claimedMilestoneIds: ["runs_3", "score_900"] }),
        createJourneyContext({ runsCount: 4, bestScore: 1680, hasDailyCompletion: true })
      )
    ).toEqual({
      kind: "journey_score",
      remaining: 120,
      rewardTokens: 8,
      titleKey: "journey.goal.score_1800.title"
    });
  });
});
