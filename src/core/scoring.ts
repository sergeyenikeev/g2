import { LINE_CLEAR_SCORE, LINE_MULTI_BONUS, PLACEMENT_SCORE_PER_CELL } from "./constants";

export const computePlacementScore = (cellsPlaced: number): number =>
  cellsPlaced * PLACEMENT_SCORE_PER_CELL;

export const computeClearScore = (linesCleared: number, combo: number): number => {
  if (linesCleared <= 0) {
    return 0;
  }
  const base = linesCleared * LINE_CLEAR_SCORE;
  const bonus = linesCleared > 1 ? LINE_MULTI_BONUS * (linesCleared - 1) : 0;
  return Math.round((base + bonus) * combo);
};

export const computeTotalScore = (
  cellsPlaced: number,
  linesCleared: number,
  combo: number
): number => computePlacementScore(cellsPlaced) + computeClearScore(linesCleared, combo);
