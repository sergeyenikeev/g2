import { describe, expect, it } from "vitest";
import { createBoard } from "../src/core/board";
import { applyMove, createEmptyState, tokensFromScore } from "../src/core/game";
import { PIECES } from "../src/core/pieces";

const dot = PIECES.find((piece) => piece.id === "dot");
const line3h = PIECES.find((piece) => piece.id === "line_3_h");

if (!dot || !line3h) {
  throw new Error("Missing test pieces");
}

describe("game state", () => {
  it("applies move and updates score", () => {
    const board = createBoard();
    const state = createEmptyState("play", "seed", board, 0);
    const result = applyMove(state, line3h, { x: 0, y: 0 });
    expect(result).not.toBeNull();
    expect(result?.state.score).toBe(15);
    expect(result?.state.combo).toBe(1);
  });

  it("counts tokens with minimum", () => {
    expect(tokensFromScore(0)).toBe(1);
    expect(tokensFromScore(3000)).toBe(2);
  });

  it("applies combo to line clears", () => {
    const board = createBoard();
    for (let x = 0; x < 10; x += 1) {
      board[0][x] = 1;
    }
    board[0][0] = 0;
    const state = createEmptyState("play", "seed", board, 0);
    const result = applyMove(state, dot, { x: 0, y: 0 });
    expect(result).not.toBeNull();
    expect(result?.linesCleared).toBe(1);
    expect(result?.state.combo).toBe(1.25);
  });
});
