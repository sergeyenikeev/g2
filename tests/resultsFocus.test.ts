import { describe, expect, it } from "vitest";
import { selectResultsFocus } from "../src/core/resultsFocus";

describe("results focus selection", () => {
  it("prioritizes the daily replay push", () => {
    expect(
      selectResultsFocus({
        replayReason: "daily",
        nextStepKind: "daily_mission_daily",
        themesReason: "spotlight",
        hasStoreOffer: true
      })
    ).toEqual({
      kind: "daily",
      target: "replay"
    });
  });

  it("promotes the weekly modifier before themes or store", () => {
    expect(
      selectResultsFocus({
        replayReason: "weekly_modifier",
        nextStepKind: "weekly_modifier",
        themesReason: "ready",
        hasStoreOffer: true
      })
    ).toEqual({
      kind: "weekly_modifier",
      target: "replay"
    });
  });

  it("falls back to themes when replay is neutral", () => {
    expect(
      selectResultsFocus({
        replayReason: "default",
        nextStepKind: "journey_runs",
        themesReason: "close",
        hasStoreOffer: true
      })
    ).toEqual({
      kind: "themes",
      target: "themes"
    });
  });

  it("uses store when there is no stronger progression focus", () => {
    expect(
      selectResultsFocus({
        replayReason: "default",
        nextStepKind: null,
        themesReason: null,
        hasStoreOffer: true
      })
    ).toEqual({
      kind: "store",
      target: "store"
    });
  });

  it("returns null when no strong post-run action exists", () => {
    expect(
      selectResultsFocus({
        replayReason: "default",
        nextStepKind: "journey_runs",
        themesReason: null,
        hasStoreOffer: false
      })
    ).toBeNull();
  });
});
