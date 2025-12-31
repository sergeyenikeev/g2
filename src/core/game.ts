import { applyPlacement } from "./board";
import { COMBO_START, TOKEN_SCORE_DIVISOR } from "./constants";
import { updateCombo } from "./combo";
import { computeClearScore, computePlacementScore } from "./scoring";
import { Board, GameMode, PieceDef, Point } from "./types";

export interface GameState {
  board: Board;
  score: number;
  combo: number;
  moves: number;
  linesCleared: number;
  mode: GameMode;
  seed: string;
  startedAt: number;
}

export interface MoveResult {
  state: GameState;
  placementScore: number;
  clearScore: number;
  linesCleared: number;
  rows: number[];
  cols: number[];
}

export const createEmptyState = (
  mode: GameMode,
  seed: string,
  board: Board,
  startedAt: number
): GameState => ({
  board,
  score: 0,
  combo: COMBO_START,
  moves: 0,
  linesCleared: 0,
  mode,
  seed,
  startedAt
});

export const applyMove = (
  state: GameState,
  piece: PieceDef,
  origin: Point
): MoveResult | null => {
  const placement = applyPlacement(state.board, piece, origin);
  if (!placement) {
    return null;
  }

  const placementScore = computePlacementScore(placement.cellsPlaced);
  const clearScore = computeClearScore(placement.clearedCount, state.combo);
  const nextCombo = updateCombo(state.combo, placement.clearedCount);

  const nextState: GameState = {
    ...state,
    board: placement.board,
    score: state.score + placementScore + clearScore,
    combo: nextCombo,
    moves: state.moves + 1,
    linesCleared: state.linesCleared + placement.clearedCount
  };

  return {
    state: nextState,
    placementScore,
    clearScore,
    linesCleared: placement.clearedCount,
    rows: placement.rows,
    cols: placement.cols
  };
};

export const tokensFromScore = (score: number): number =>
  Math.max(1, Math.floor(score / TOKEN_SCORE_DIVISOR));
