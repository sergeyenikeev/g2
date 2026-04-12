import { describe, expect, it } from "vitest";
import {
  createDefaultJourneyProgress,
  normalizeJourneyProgress,
  resolveJourneyProgress
} from "../src/core/journey";

describe("journey progression", () => {
  it("normalizes malformed stored state", () => {
    expect(
      normalizeJourneyProgress({
        claimedMilestoneIds: ["first_run", "ghost_goal", "first_run", 12]
      })
    ).toEqual({
      claimedMilestoneIds: ["first_run"]
    });
  });

  it("claims newly completed goals and exposes the next queue", () => {
    const summary = resolveJourneyProgress(createDefaultJourneyProgress(), {
      tutorialCompleted: true,
      runsCount: 3,
      bestScore: 1_100,
      themesUnlockedCount: 1,
      hasDailyCompletion: false
    });

    expect(summary.updatedState.claimedMilestoneIds).toEqual([
      "tutorial_complete",
      "first_run",
      "runs_3",
      "score_900"
    ]);
    expect(summary.totalRewardTokens).toBe(19);
    expect(summary.nextMilestones.map((milestone) => milestone.id)).toEqual([
      "daily_complete",
      "theme_unlock",
      "score_1800"
    ]);
  });

  it("does not re-grant already claimed goals", () => {
    const summary = resolveJourneyProgress(
      {
        claimedMilestoneIds: ["tutorial_complete", "first_run", "runs_3"]
      },
      {
        tutorialCompleted: true,
        runsCount: 4,
        bestScore: 2_000,
        themesUnlockedCount: 2,
        hasDailyCompletion: true
      }
    );

    expect(summary.newlyClaimed.map((milestone) => milestone.id)).toEqual([
      "score_900",
      "daily_complete",
      "theme_unlock",
      "score_1800"
    ]);
    expect(summary.totalRewardTokens).toBe(27);
  });
});
