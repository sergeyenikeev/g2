import { describe, expect, it } from "vitest";
import { createBoard, canAnyPieceFit } from "../src/core/board";
import { PieceGenerator } from "../src/core/generator";
import { createSeededRng } from "../src/core/rng";

const isLarge = (size: number): boolean => size >= 5;

describe("piece generator", () => {
  it("guarantees a placeable piece in early moves", () => {
    const board = createBoard();
    const generator = new PieceGenerator(createSeededRng("early"));
    const set = generator.nextSet(board, 0);
    expect(canAnyPieceFit(board, set.map((piece) => piece.def))).toBe(true);
  });

  it("avoids three large pieces in a row", () => {
    const board = createBoard();
    const generator = new PieceGenerator(createSeededRng("large-test"));
    const defs = [] as { size: number }[];
    for (let i = 0; i < 8; i += 1) {
      const set = generator.nextSet(board, i);
      defs.push(...set.map((piece) => piece.def));
    }
    for (let i = 0; i < defs.length - 2; i += 1) {
      const largeRun = isLarge(defs[i].size) && isLarge(defs[i + 1].size) && isLarge(defs[i + 2].size);
      expect(largeRun).toBe(false);
    }
  });

  it("is deterministic with the same seed", () => {
    const board = createBoard();
    const genA = new PieceGenerator(createSeededRng("daily_seed"));
    const genB = new PieceGenerator(createSeededRng("daily_seed"));
    const setA = genA.nextSet(board, 0).map((piece) => piece.def.id);
    const setB = genB.nextSet(board, 0).map((piece) => piece.def.id);
    expect(setA).toEqual(setB);
  });
});
