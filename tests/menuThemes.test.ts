import { describe, expect, it } from "vitest";
import { resolveMenuThemesCta } from "../src/core/menuThemes";

describe("menu themes cta", () => {
  it("stays quiet before the tutorial is completed", () => {
    expect(
      resolveMenuThemesCta({
        tutorialCompleted: false,
        nextThemeMissingTokens: 0,
        rewardEligible: true,
        rewardTokens: 3
      })
    ).toEqual({
      highlight: false,
      reason: "none"
    });
  });

  it("highlights the themes button when the next theme is ready now", () => {
    expect(
      resolveMenuThemesCta({
        tutorialCompleted: true,
        nextThemeMissingTokens: 0,
        rewardEligible: false,
        rewardTokens: 3
      })
    ).toEqual({
      highlight: true,
      reason: "ready"
    });
  });

  it("highlights the themes button when one rewarded claim can finish the target", () => {
    expect(
      resolveMenuThemesCta({
        tutorialCompleted: true,
        nextThemeMissingTokens: 2,
        rewardEligible: true,
        rewardTokens: 3
      })
    ).toEqual({
      highlight: true,
      reason: "reward"
    });
  });
});
