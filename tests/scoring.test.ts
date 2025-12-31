import { describe, expect, it } from "vitest";
import { computeClearScore, computePlacementScore } from "../src/core/scoring";
import { updateCombo } from "../src/core/combo";


describe("scoring", () => {
  it("scores placement cells", () => {
    expect(computePlacementScore(4)).toBe(20);
  });

  it("scores single line clear", () => {
    expect(computeClearScore(1, 1)).toBe(120);
  });

  it("scores multi line bonus", () => {
    expect(computeClearScore(2, 1)).toBe(320);
  });

  it("applies combo to clear score", () => {
    expect(computeClearScore(3, 1.5)).toBe(780);
  });
});

describe("combo", () => {
  it("increments combo on clear", () => {
    expect(updateCombo(1, 1)).toBe(1.25);
  });

  it("resets combo on no clear", () => {
    expect(updateCombo(2, 0)).toBe(1);
  });
});
