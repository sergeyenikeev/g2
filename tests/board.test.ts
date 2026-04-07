import { describe, expect, it } from "vitest";
import {
  applyPlacement,
  canAnyPieceFit,
  canPlace,
  clearDensestLane,
  createBoard,
  getPlaceablePieces,
  getValidOrigins,
  placementOccupiesCell
} from "../src/core/board";
import { PIECES } from "../src/core/pieces";

const dot = PIECES.find((piece) => piece.id === "dot");
const line3h = PIECES.find((piece) => piece.id === "line_3_h");

if (!dot || !line3h) {
  throw new Error("Missing test pieces");
}

describe("board placement", () => {
  it("allows placement on empty board", () => {
    const board = createBoard();
    expect(canPlace(board, dot, { x: 0, y: 0 })).toBe(true);
  });

  it("rejects placement outside board", () => {
    const board = createBoard();
    expect(canPlace(board, dot, { x: 10, y: 0 })).toBe(false);
  });

  it("rejects overlap", () => {
    const board = createBoard();
    board[0][0] = 1;
    expect(canPlace(board, dot, { x: 0, y: 0 })).toBe(false);
  });

  it("returns null when placement is invalid", () => {
    const board = createBoard();
    board[0][0] = 1;
    expect(applyPlacement(board, dot, { x: 0, y: 0 })).toBeNull();
  });

  it("clears full row", () => {
    const board = createBoard();
    for (let x = 0; x < 10; x += 1) {
      board[0][x] = 1;
    }
    const result = applyPlacement(board, dot, { x: 0, y: 1 });
    expect(result).not.toBeNull();
    expect(result?.rows).toEqual([0]);
    expect(result?.clearedCount).toBe(1);
  });

  it("clears full column", () => {
    const board = createBoard();
    for (let y = 0; y < 10; y += 1) {
      board[y][0] = 1;
    }
    const result = applyPlacement(board, dot, { x: 1, y: 0 });
    expect(result).not.toBeNull();
    expect(result?.cols).toEqual([0]);
    expect(result?.clearedCount).toBe(1);
  });

  it("clears row and column together", () => {
    const board = createBoard();
    for (let x = 0; x < 10; x += 1) {
      board[4][x] = 1;
    }
    for (let y = 0; y < 10; y += 1) {
      board[y][7] = 1;
    }
    board[4][7] = 0;
    const result = applyPlacement(board, dot, { x: 7, y: 4 });
    expect(result).not.toBeNull();
    expect(result?.rows).toEqual([4]);
    expect(result?.cols).toEqual([7]);
    expect(result?.clearedCount).toBe(2);
  });

  it("detects full board has no fits", () => {
    const board = createBoard();
    for (let y = 0; y < 10; y += 1) {
      for (let x = 0; x < 10; x += 1) {
        board[y][x] = 1;
      }
    }
    expect(canAnyPieceFit(board, [dot, line3h])).toBe(false);
  });

  it("finds placeable pieces on empty board", () => {
    const board = createBoard();
    const placeable = getPlaceablePieces(board, [dot, line3h]);
    expect(placeable.length).toBe(2);
  });

  it("lists valid origins for a piece on a constrained board", () => {
    const board = createBoard();
    board[0][0] = 1;
    board[0][1] = 1;

    const origins = getValidOrigins(board, dot);

    expect(origins).not.toContainEqual({ x: 0, y: 0 });
    expect(origins).toContainEqual({ x: 2, y: 0 });
  });

  it("detects whether a placement covers a tapped cell", () => {
    expect(placementOccupiesCell(line3h, { x: 2, y: 4 }, { x: 3, y: 4 })).toBe(true);
    expect(placementOccupiesCell(line3h, { x: 2, y: 4 }, { x: 3, y: 5 })).toBe(false);
  });

  it("clears the densest lane for a level pulse", () => {
    const board = createBoard();
    board[5][1] = 1;
    board[5][2] = 1;
    board[5][3] = 1;
    board[5][4] = 1;
    board[2][8] = 1;
    board[3][8] = 1;
    board[4][8] = 1;

    const pulse = clearDensestLane(board);

    expect(pulse.rows).toEqual([5]);
    expect(pulse.cols).toEqual([]);
    expect(pulse.clearedCells).toBe(4);
    expect(pulse.board[5].every((cell) => cell === 0)).toBe(true);
    expect(pulse.board[2][8]).toBe(1);
  });
});
