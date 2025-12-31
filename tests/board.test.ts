import { describe, expect, it } from "vitest";
import { applyPlacement, canAnyPieceFit, canPlace, createBoard, getPlaceablePieces } from "../src/core/board";
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
});
