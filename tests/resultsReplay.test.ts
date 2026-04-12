import { describe, expect, it } from "vitest";
import { resolveResultsReplayMode } from "../src/core/resultsReplay";

describe("results replay mode", () => {
  it("promotes the daily mode after a normal run when daily is still untouched", () => {
    expect(resolveResultsReplayMode("play", false)).toBe("daily");
  });

  it("keeps the current mode once daily is already completed", () => {
    expect(resolveResultsReplayMode("play", true)).toBe("play");
  });

  it("does not redirect tutorial or daily results", () => {
    expect(resolveResultsReplayMode("tutorial", false)).toBe("tutorial");
    expect(resolveResultsReplayMode("daily", false)).toBe("daily");
  });
});
