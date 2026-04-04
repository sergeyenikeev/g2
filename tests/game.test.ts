import { describe, expect, it } from "vitest";
import { GameSession } from "../src/app/GameSession";
import { createBoard } from "../src/core/board";
import { applyMove, createEmptyState, tokensFromScore } from "../src/core/game";
import { PIECES } from "../src/core/pieces";
import { createSeededRng } from "../src/core/rng";

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
    expect(result?.state.peakCombo).toBe(1);
    expect(result?.state.bestClear).toBe(0);
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
    expect(result?.state.peakCombo).toBe(1.25);
    expect(result?.state.bestClear).toBe(1);
  });

  it("does not offer continue when the board has no rescue placements", () => {
    const session = new GameSession("play", "seed", createSeededRng("continue-full"), 0);
    const board = createBoard();
    for (let y = 0; y < 10; y += 1) {
      for (let x = 0; x < 10; x += 1) {
        board[y][x] = 1;
      }
    }

    session.state = { ...session.state, board };

    expect(session.canOfferContinue()).toBe(false);
    expect(session.setContinuePieces()).toBe(false);
    expect(session.continueUsed).toBe(false);
  });

  it("builds a valid continue loadout from pieces that fit the board", () => {
    const session = new GameSession("play", "seed", createSeededRng("continue-open"), 0);
    const board = createBoard();
    for (let y = 0; y < 10; y += 1) {
      for (let x = 0; x < 10; x += 1) {
        board[y][x] = 1;
      }
    }
    board[4][4] = 0;
    session.state = { ...session.state, board, combo: 2 };

    expect(session.canOfferContinue()).toBe(true);
    expect(session.setContinuePieces()).toBe(true);
    expect(session.continueUsed).toBe(true);
    expect(session.state.combo).toBe(1);
    expect(session.canPlaceAny()).toBe(true);
    expect(session.pieces.every((piece) => piece?.def.id === "dot")).toBe(true);
  });

  it("reports how many placements are left across current pieces", () => {
    const session = new GameSession("play", "seed", createSeededRng("stats"), 0);
    const board = createBoard();
    for (let y = 0; y < 10; y += 1) {
      for (let x = 0; x < 10; x += 1) {
        board[y][x] = 1;
      }
    }
    board[4][4] = 0;
    session.state = { ...session.state, board };
    session.pieces = [
      { instanceId: "a", def: dot },
      { instanceId: "b", def: line3h },
      null
    ];

    expect(session.getPlacementStats()).toEqual({
      placeablePieces: 1,
      totalPlacements: 1
    });
    expect(session.getPiecePlacementCounts()).toEqual({
      a: 1,
      b: 0
    });
  });
});
