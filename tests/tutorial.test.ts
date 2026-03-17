import { describe, expect, it } from "vitest";
import { getTutorialStep, getTutorialStepsCount, isTutorialTargetMove } from "../src/app/tutorial";

describe("tutorial steps", () => {
  it("exposes a fixed three-step lesson flow", () => {
    expect(getTutorialStepsCount()).toBe(3);

    const first = getTutorialStep(0);
    const second = getTutorialStep(1);
    const third = getTutorialStep(2);

    expect(first?.pieces[0]?.id).toBe("line_3_h");
    expect(second?.pieces[0]?.id).toBe("square_2");
    expect(third?.pieces[0]?.id).toBe("l_3x2");
  });

  it("matches only the authored placement for each lesson", () => {
    const step = getTutorialStep(0);
    expect(step).not.toBeNull();
    if (!step) {
      return;
    }

    expect(isTutorialTargetMove(step, "line_3_h", { x: 0, y: 4 })).toBe(true);
    expect(isTutorialTargetMove(step, "line_3_h", { x: 1, y: 4 })).toBe(false);
    expect(isTutorialTargetMove(step, "dot", { x: 0, y: 4 })).toBe(false);
  });
});
