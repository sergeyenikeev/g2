import { BOARD_SIZE } from "./constants";
import { Board, PieceDef, Point } from "./types";

export const createBoard = (): Board =>
  Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => 0));

export const cloneBoard = (board: Board): Board => board.map((row) => [...row]);

export const isInside = (point: Point): boolean =>
  point.x >= 0 && point.x < BOARD_SIZE && point.y >= 0 && point.y < BOARD_SIZE;

export const canPlace = (board: Board, piece: PieceDef, origin: Point): boolean => {
  for (const cell of piece.cells) {
    const target = { x: origin.x + cell.x, y: origin.y + cell.y };
    if (!isInside(target)) {
      return false;
    }
    if (board[target.y][target.x] === 1) {
      return false;
    }
  }
  return true;
};

export const findClearedLines = (board: Board): { rows: number[]; cols: number[] } => {
  const rows: number[] = [];
  const cols: number[] = [];

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    if (board[y].every((cell) => cell === 1)) {
      rows.push(y);
    }
  }

  for (let x = 0; x < BOARD_SIZE; x += 1) {
    let full = true;
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      if (board[y][x] === 0) {
        full = false;
        break;
      }
    }
    if (full) {
      cols.push(x);
    }
  }

  return { rows, cols };
};

export const clearLines = (board: Board, rows: number[], cols: number[]): Board => {
  const next = cloneBoard(board);
  for (const y of rows) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      next[y][x] = 0;
    }
  }
  for (const x of cols) {
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      next[y][x] = 0;
    }
  }
  return next;
};

export const applyPlacement = (
  board: Board,
  piece: PieceDef,
  origin: Point
): {
  board: Board;
  rows: number[];
  cols: number[];
  clearedCount: number;
  cellsPlaced: number;
} | null => {
  if (!canPlace(board, piece, origin)) {
    return null;
  }

  const next = cloneBoard(board);
  for (const cell of piece.cells) {
    const target = { x: origin.x + cell.x, y: origin.y + cell.y };
    next[target.y][target.x] = 1;
  }

  const { rows, cols } = findClearedLines(next);
  const clearedBoard = clearLines(next, rows, cols);

  return {
    board: clearedBoard,
    rows,
    cols,
    clearedCount: rows.length + cols.length,
    cellsPlaced: piece.size
  };
};

export const canAnyPieceFit = (board: Board, pieces: PieceDef[]): boolean => {
  for (const piece of pieces) {
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        if (canPlace(board, piece, { x, y })) {
          return true;
        }
      }
    }
  }
  return false;
};

export const getPlaceablePieces = (board: Board, pieces: PieceDef[]): PieceDef[] => {
  const result: PieceDef[] = [];
  for (const piece of pieces) {
    if (canAnyPieceFit(board, [piece])) {
      result.push(piece);
    }
  }
  return result;
};
