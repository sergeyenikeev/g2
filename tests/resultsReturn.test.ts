import { describe, expect, it } from "vitest";
import { resolveResultsReturnPrompt } from "../src/core/resultsReturn";

describe("results return prompt", () => {
  it("hides the return prompt after tutorial runs", () => {
    expect(
      resolveResultsReturnPrompt("tutorial", {
        claimedToday: true,
        day: 1,
        tokens: 1,
        nextDay: 2,
        nextTokens: 2
      })
    ).toBeNull();
  });

  it("shows the current login reward when a new day is ready", () => {
    expect(
      resolveResultsReturnPrompt("play", {
        claimedToday: false,
        day: 4,
        tokens: 4,
        nextDay: 5,
        nextTokens: 5
      })
    ).toEqual({
      kind: "ready",
      day: 4,
      tokens: 4
    });
  });

  it("shows the next login reward after today's reward is already claimed", () => {
    expect(
      resolveResultsReturnPrompt("daily", {
        claimedToday: true,
        day: 3,
        tokens: 3,
        nextDay: 4,
        nextTokens: 4
      })
    ).toEqual({
      kind: "next",
      day: 4,
      tokens: 4
    });
  });
});
