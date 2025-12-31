import { describe, expect, it } from "vitest";
import { getContinueCooldownUntil, isContinueAllowed, isRewardedAllowed, nextRewardedAllowedAt } from "../src/core/cooldowns";


describe("rewarded cooldowns", () => {
  it("blocks rewarded before 90s cooldown", () => {
    const last = 1000;
    const now = last + 60_000;
    expect(isRewardedAllowed(last, now)).toBe(false);
  });

  it("allows rewarded after cooldown", () => {
    const last = 1000;
    const now = nextRewardedAllowedAt(last);
    expect(isRewardedAllowed(last, now)).toBe(true);
  });

  it("validates continue usage", () => {
    const now = 1000;
    const result = isContinueAllowed(900, false, now + 1, now);
    expect(result.ok).toBe(false);
  });

  it("sets continue cooldown", () => {
    const now = 1000;
    expect(getContinueCooldownUntil(now)).toBeGreaterThan(now);
  });
});
