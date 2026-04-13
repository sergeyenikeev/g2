import { describe, expect, it } from "vitest";
import {
  applyRunToWeeklyModifier,
  createDefaultWeeklyModifierState,
  getWeeklyModifierDefinition,
  getWeeklyModifierStatus,
  isWeeklyModifierClose,
  normalizeWeeklyModifierState
} from "../src/core/weeklyModifier";

describe("weekly modifier", () => {
  it("rotates deterministically by week", () => {
    expect(getWeeklyModifierDefinition("20260406")?.id).not.toBeNull();
    expect(getWeeklyModifierDefinition("20260406")?.id).toBe(
      getWeeklyModifierDefinition("20260406")?.id
    );
    expect(getWeeklyModifierDefinition("20260413")?.id).not.toBeNull();
  });

  it("resets stale state when the week changes", () => {
    expect(
      normalizeWeeklyModifierState(
        {
          weekKey: "20260330",
          claimedModifierId: "score_sprint",
          claimedDateKey: "20260401"
        },
        "20260412"
      )
    ).toEqual({
      weekKey: "20260406",
      claimedModifierId: null,
      claimedDateKey: null
    });
  });

  it("claims the modifier once when a run meets the weekly target", () => {
    const resolution = applyRunToWeeklyModifier(createDefaultWeeklyModifierState("20260406"), "20260412", {
      score: 1600,
      linesCleared: 10,
      level: 3,
      peakCombo: 1.75
    });

    expect(resolution.newlyClaimed).toBe(true);
    expect(resolution.rewardTokens).toBe(8);
    expect(resolution.updatedState.claimedModifierId).toBe(resolution.definition?.id ?? null);
  });

  it("does not reward the same weekly modifier twice", () => {
    const first = applyRunToWeeklyModifier(createDefaultWeeklyModifierState("20260406"), "20260412", {
      score: 1600,
      linesCleared: 10,
      level: 3,
      peakCombo: 1.75
    });
    const second = applyRunToWeeklyModifier(first.updatedState, "20260412", {
      score: 2000,
      linesCleared: 20,
      level: 5,
      peakCombo: 2.5
    });

    expect(second.newlyClaimed).toBe(false);
    expect(second.rewardTokens).toBe(0);
  });

  it("marks close runs for the next-step prompt", () => {
    const status = getWeeklyModifierStatus(createDefaultWeeklyModifierState("20260406"), "20260412", {
      score: 1180,
      linesCleared: 14,
      level: 3,
      peakCombo: 2
    });

    expect(isWeeklyModifierClose(status)).toBe(true);
  });
});
