import { describe, expect, it } from "vitest";
import {
  applyDailyCompletionToStreak,
  createDefaultDailyStreakState,
  getDailyStreakStatus,
  normalizeDailyStreakState
} from "../src/core/dailyStreak";

describe("daily streak", () => {
  it("starts clean by default", () => {
    expect(createDefaultDailyStreakState()).toEqual({
      current: 0,
      best: 0,
      lastCompletedDate: null
    });
  });

  it("normalizes malformed stored state", () => {
    expect(
      normalizeDailyStreakState({
        current: -3,
        best: 2,
        lastCompletedDate: "today"
      })
    ).toEqual({
      current: 0,
      best: 2,
      lastCompletedDate: null
    });
  });

  it("shows an active streak only when yesterday or today is linked", () => {
    expect(
      getDailyStreakStatus(
        {
          current: 4,
          best: 4,
          lastCompletedDate: "20260411"
        },
        "20260412"
      )
    ).toEqual({
      current: 4,
      best: 4,
      activeToday: false,
      nextMilestoneDay: 5,
      nextMilestoneTokens: 7,
      remainingDays: 1
    });

    expect(
      getDailyStreakStatus(
        {
          current: 4,
          best: 4,
          lastCompletedDate: "20260409"
        },
        "20260412"
      )
    ).toEqual({
      current: 0,
      best: 4,
      activeToday: false,
      nextMilestoneDay: 3,
      nextMilestoneTokens: 5,
      remainingDays: 3
    });
  });

  it("continues streaks and awards milestone bonuses", () => {
    expect(
      applyDailyCompletionToStreak(
        {
          current: 2,
          best: 2,
          lastCompletedDate: "20260411"
        },
        "20260412"
      )
    ).toMatchObject({
      advanced: true,
      current: 3,
      best: 3,
      activeToday: true,
      milestoneReached: 3,
      milestoneRewardTokens: 5,
      nextMilestoneDay: 5,
      nextMilestoneTokens: 7,
      remainingDays: 2
    });
  });

  it("resets broken streaks back to day one", () => {
    expect(
      applyDailyCompletionToStreak(
        {
          current: 5,
          best: 5,
          lastCompletedDate: "20260409"
        },
        "20260412"
      )
    ).toMatchObject({
      advanced: true,
      current: 1,
      best: 5,
      activeToday: true,
      milestoneReached: null,
      milestoneRewardTokens: 0,
      nextMilestoneDay: 3,
      nextMilestoneTokens: 5,
      remainingDays: 2
    });
  });
});
