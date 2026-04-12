import { describe, expect, it } from "vitest";
import {
  claimLoginReward,
  createDefaultLoginRewardState,
  getLoginRewardStatus,
  getLoginRewardTrack
} from "../src/core/loginRewards";

const createLocalDate = (day: number): Date => new Date(2026, 3, day, 12, 0, 0, 0);

describe("login rewards", () => {
  it("grants the first-day reward on the first login of a date", () => {
    const result = claimLoginReward(createDefaultLoginRewardState(), createLocalDate(1));

    expect(result.granted).toBe(true);
    expect(result.day).toBe(1);
    expect(result.tokens).toBe(1);
    expect(result.nextDay).toBe(2);
    expect(result.nextTokens).toBe(2);
    expect(result.state).toEqual({
      cycleDay: 1,
      lastClaimDate: "20260401"
    });
  });

  it("does not grant the same daily login reward twice on one date", () => {
    const firstClaim = claimLoginReward(createDefaultLoginRewardState(), createLocalDate(1));
    const secondClaim = claimLoginReward(firstClaim.state, createLocalDate(1));

    expect(secondClaim.granted).toBe(false);
    expect(secondClaim.day).toBe(1);
    expect(secondClaim.tokens).toBe(1);
    expect(secondClaim.nextDay).toBe(2);
  });

  it("increases rewards up to day five and then loops back to day one", () => {
    let state = createDefaultLoginRewardState();
    const days = [] as number[];
    const rewards = [] as number[];

    for (let day = 1; day <= 6; day += 1) {
      const claim = claimLoginReward(state, createLocalDate(day));
      state = claim.state;
      days.push(claim.day);
      rewards.push(claim.tokens);
    }

    expect(days).toEqual([1, 2, 3, 4, 5, 1]);
    expect(rewards).toEqual([1, 2, 3, 4, 5, 1]);
    expect(state).toEqual({
      cycleDay: 1,
      lastClaimDate: "20260406"
    });
  });

  it("resets the streak to day one after a missed day", () => {
    const firstClaim = claimLoginReward(createDefaultLoginRewardState(), createLocalDate(1));
    const resetClaim = claimLoginReward(firstClaim.state, createLocalDate(3));

    expect(resetClaim.granted).toBe(true);
    expect(resetClaim.day).toBe(1);
    expect(resetClaim.tokens).toBe(1);
    expect(resetClaim.nextDay).toBe(2);
    expect(resetClaim.state).toEqual({
      cycleDay: 1,
      lastClaimDate: "20260403"
    });
  });

  it("shows the next unclaimed reward in the menu state", () => {
    const claimed = claimLoginReward(createDefaultLoginRewardState(), createLocalDate(1));
    const status = getLoginRewardStatus(claimed.state, createLocalDate(2));

    expect(status.claimedToday).toBe(false);
    expect(status.day).toBe(2);
    expect(status.tokens).toBe(2);
  });

  it("shows day one again in the menu after a missed day", () => {
    const claimed = claimLoginReward(createDefaultLoginRewardState(), createLocalDate(1));
    const status = getLoginRewardStatus(claimed.state, createLocalDate(3));

    expect(status.claimedToday).toBe(false);
    expect(status.day).toBe(1);
    expect(status.tokens).toBe(1);
  });

  it("accepts a precomputed calendar date key for trusted server time", () => {
    const claimed = claimLoginReward(createDefaultLoginRewardState(), "20260401");
    const status = getLoginRewardStatus(claimed.state, "20260402");

    expect(claimed.state.lastClaimDate).toBe("20260401");
    expect(status.claimedToday).toBe(false);
    expect(status.day).toBe(2);
    expect(status.tokens).toBe(2);
  });

  it("builds a visible reward track for the current streak", () => {
    const dayOne = claimLoginReward(createDefaultLoginRewardState(), createLocalDate(1));
    const track = getLoginRewardTrack(dayOne.state, createLocalDate(2));

    expect(track).toEqual([
      { day: 1, tokens: 1, state: "claimed" },
      { day: 2, tokens: 2, state: "ready" },
      { day: 3, tokens: 3, state: "next" },
      { day: 4, tokens: 4, state: "locked" },
      { day: 5, tokens: 5, state: "locked" }
    ]);
  });

  it("resets the track after a missed day", () => {
    const dayOne = claimLoginReward(createDefaultLoginRewardState(), createLocalDate(1));
    const track = getLoginRewardTrack(dayOne.state, createLocalDate(3));

    expect(track).toEqual([
      { day: 1, tokens: 1, state: "ready" },
      { day: 2, tokens: 2, state: "next" },
      { day: 3, tokens: 3, state: "locked" },
      { day: 4, tokens: 4, state: "locked" },
      { day: 5, tokens: 5, state: "locked" }
    ]);
  });
});
