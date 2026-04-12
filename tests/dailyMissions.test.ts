import { describe, expect, it } from "vitest";
import {
  applyCompletedRunToDailyMissions,
  createDefaultDailyMissionProgress,
  getDailyMissionStatuses,
  normalizeDailyMissionProgress
} from "../src/core/dailyMissions";

describe("daily missions", () => {
  it("resets stale mission state for a new day", () => {
    expect(
      normalizeDailyMissionProgress(
        {
          dateKey: "20260411",
          claimedMissionIds: ["finish_run"],
          stats: {
            completedRuns: 2,
            totalLinesCleared: 8,
            completedDaily: false
          }
        },
        "20260412"
      )
    ).toEqual({
      dateKey: "20260412",
      claimedMissionIds: [],
      stats: {
        completedRuns: 0,
        totalLinesCleared: 0,
        completedDaily: false
      }
    });
  });

  it("claims missions completed by a finished play run", () => {
    const resolution = applyCompletedRunToDailyMissions(
      createDefaultDailyMissionProgress("20260412"),
      "20260412",
      {
        mode: "play",
        linesCleared: 12
      }
    );

    expect(resolution.newlyClaimed.map((mission) => mission.id)).toEqual([
      "finish_run",
      "clear_12_lines"
    ]);
    expect(resolution.totalRewardTokens).toBe(7);
  });

  it("tracks daily completion separately from generic runs", () => {
    const resolution = applyCompletedRunToDailyMissions(
      {
        dateKey: "20260412",
        claimedMissionIds: ["finish_run"],
        stats: {
          completedRuns: 1,
          totalLinesCleared: 4,
          completedDaily: false
        }
      },
      "20260412",
      {
        mode: "daily",
        linesCleared: 3
      }
    );

    expect(resolution.newlyClaimed.map((mission) => mission.id)).toEqual(["finish_daily"]);
    expect(
      getDailyMissionStatuses(resolution.updatedState, "20260412").find(
        (status) => status.definition.id === "finish_daily"
      )?.claimed
    ).toBe(true);
  });
});
