import { describe, expect, it } from "vitest";
import {
  applyDailyCompletionToWeeklyLoop,
  createDefaultWeeklyLoopState,
  getWeekKeyFromDateKey,
  getWeeklyLoopStatus,
  normalizeWeeklyLoopState
} from "../src/core/weeklyLoop";

describe("weekly loop", () => {
  it("derives monday-based week keys", () => {
    expect(getWeekKeyFromDateKey("20260412")).toBe("20260406");
    expect(getWeekKeyFromDateKey("20260413")).toBe("20260413");
  });

  it("resets corrupted or stale state outside the current week", () => {
    expect(
      normalizeWeeklyLoopState(
        {
          weekKey: "20260330",
          completedDateKeys: ["20260401"],
          claimedMilestoneDays: [3]
        },
        "20260412"
      )
    ).toEqual({
      weekKey: "20260406",
      completedDateKeys: [],
      claimedMilestoneDays: []
    });
  });

  it("tracks progress inside the same week", () => {
    expect(
      getWeeklyLoopStatus(
        {
          weekKey: "20260406",
          completedDateKeys: ["20260408", "20260410"],
          claimedMilestoneDays: []
        },
        "20260412"
      )
    ).toEqual({
      weekKey: "20260406",
      completedDays: 2,
      completedToday: false,
      nextMilestoneDay: 3,
      nextMilestoneTokens: 6,
      goalDays: 3,
      complete: false
    });
  });

  it("claims the 3-day weekly milestone", () => {
    expect(
      applyDailyCompletionToWeeklyLoop(
        {
          weekKey: "20260406",
          completedDateKeys: ["20260408", "20260410"],
          claimedMilestoneDays: []
        },
        "20260412"
      )
    ).toMatchObject({
      advanced: true,
      completedDays: 3,
      completedToday: true,
      nextMilestoneDay: 5,
      nextMilestoneTokens: 9,
      goalDays: 5,
      totalRewardTokens: 6,
      newlyClaimedMilestones: [{ days: 3, rewardTokens: 6 }]
    });
  });

  it("stops rewarding the same day twice", () => {
    expect(
      applyDailyCompletionToWeeklyLoop(
        {
          weekKey: "20260406",
          completedDateKeys: ["20260408", "20260410", "20260412"],
          claimedMilestoneDays: [3]
        },
        "20260412"
      )
    ).toMatchObject({
      advanced: false,
      totalRewardTokens: 0,
      completedDays: 3,
      completedToday: true
    });
  });

  it("marks the loop complete after 5 daily clears", () => {
    expect(
      applyDailyCompletionToWeeklyLoop(
        {
          weekKey: "20260406",
          completedDateKeys: ["20260407", "20260408", "20260409", "20260410"],
          claimedMilestoneDays: [3]
        },
        "20260412"
      )
    ).toMatchObject({
      advanced: true,
      completedDays: 5,
      completedToday: true,
      nextMilestoneDay: null,
      nextMilestoneTokens: 0,
      goalDays: 5,
      complete: true,
      totalRewardTokens: 9,
      newlyClaimedMilestones: [{ days: 5, rewardTokens: 9 }]
    });
  });

  it("creates an empty state by default", () => {
    expect(createDefaultWeeklyLoopState("20260406")).toEqual({
      weekKey: "20260406",
      completedDateKeys: [],
      claimedMilestoneDays: []
    });
  });
});
