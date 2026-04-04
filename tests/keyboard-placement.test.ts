import { describe, expect, it } from "vitest";
import { getNextPlacementOrigin } from "../src/app/keyboardPlacement";

describe("keyboard placement navigation", () => {
  it("moves to the closest placement in the requested direction", () => {
    const origins = [
      { x: 1, y: 1 },
      { x: 4, y: 1 },
      { x: 5, y: 2 },
      { x: 4, y: 4 }
    ];

    expect(getNextPlacementOrigin(origins, { x: 1, y: 1 }, "right")).toEqual({ x: 4, y: 1 });
    expect(getNextPlacementOrigin(origins, { x: 4, y: 1 }, "down")).toEqual({ x: 4, y: 4 });
  });

  it("prefers smaller side drift when several placements are in range", () => {
    const origins = [
      { x: 3, y: 3 },
      { x: 5, y: 2 },
      { x: 5, y: 3 },
      { x: 5, y: 4 }
    ];

    expect(getNextPlacementOrigin(origins, { x: 3, y: 3 }, "right")).toEqual({ x: 5, y: 3 });
  });

  it("keeps the current placement when there is no valid step in that direction", () => {
    const origins = [
      { x: 2, y: 2 },
      { x: 4, y: 2 }
    ];

    expect(getNextPlacementOrigin(origins, { x: 2, y: 2 }, "left")).toEqual({ x: 2, y: 2 });
  });
});
