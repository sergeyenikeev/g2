import { applyPlacement, clearDensestLane } from "./board";
import {
  COMBO_START,
  LEVEL_BASE_GOAL,
  LEVEL_GOAL_STEP,
  LEVEL_PROGRESS_PER_CELL,
  LEVEL_PROGRESS_PER_LINE,
  LEVEL_UP_SCORE_BASE,
  LEVEL_UP_SCORE_STEP,
  TOKEN_SCORE_DIVISOR
} from "./constants";
import { updateCombo } from "./combo";
import { computeClearScore, computePlacementScore } from "./scoring";
import { Board, GameMode, PieceDef, Point } from "./types";

export interface GameState {
  board: Board;
  score: number;
  combo: number;
  peakCombo: number;
  bestClear: number;
  moves: number;
  linesCleared: number;
  level: number;
  levelProgress: number;
  levelGoal: number;
  mode: GameMode;
  seed: string;
  startedAt: number;
}

export interface LevelUpResult {
  level: number;
  bonusScore: number;
  pulseRows: number[];
  pulseCols: number[];
  clearedCells: number;
}

export interface MoveResult {
  state: GameState;
  placementScore: number;
  clearScore: number;
  linesCleared: number;
  rows: number[];
  cols: number[];
  pulseRows: number[];
  pulseCols: number[];
  levelProgressGained: number;
  levelUps: LevelUpResult[];
}

export const getLevelGoal = (level: number): number =>
  LEVEL_BASE_GOAL + Math.max(0, level - 1) * LEVEL_GOAL_STEP;

export const computeLevelProgressGain = (cellsPlaced: number, linesCleared: number): number =>
  cellsPlaced * LEVEL_PROGRESS_PER_CELL + linesCleared * LEVEL_PROGRESS_PER_LINE;

export const computeLevelUpScore = (level: number): number =>
  LEVEL_UP_SCORE_BASE + Math.max(0, level - 1) * LEVEL_UP_SCORE_STEP;

export const createEmptyState = (
  mode: GameMode,
  seed: string,
  board: Board,
  startedAt: number
): GameState => ({
  board,
  score: 0,
  combo: COMBO_START,
  peakCombo: COMBO_START,
  bestClear: 0,
  moves: 0,
  linesCleared: 0,
  level: 1,
  levelProgress: 0,
  levelGoal: getLevelGoal(1),
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
  const levelProgressGained =
    state.mode === "tutorial"
      ? 0
      : computeLevelProgressGain(placement.cellsPlaced, placement.clearedCount);

  let nextBoard = placement.board;
  let nextScore = state.score + placementScore + clearScore;
  let nextLevel = state.level;
  let nextLevelProgress = state.levelProgress + levelProgressGained;
  let nextLevelGoal = state.levelGoal;
  const levelUps: LevelUpResult[] = [];

  while (nextLevelProgress >= nextLevelGoal) {
    nextLevelProgress -= nextLevelGoal;
    nextLevel += 1;

    const bonusScore = computeLevelUpScore(nextLevel);
    nextScore += bonusScore;

    const pulse = clearDensestLane(nextBoard);
    nextBoard = pulse.board;
    nextLevelGoal = getLevelGoal(nextLevel);
    levelUps.push({
      level: nextLevel,
      bonusScore,
      pulseRows: pulse.rows,
      pulseCols: pulse.cols,
      clearedCells: pulse.clearedCells
    });
  }

  const nextState: GameState = {
    ...state,
    board: nextBoard,
    score: nextScore,
    combo: nextCombo,
    peakCombo: Math.max(state.peakCombo, nextCombo),
    bestClear: Math.max(state.bestClear, placement.clearedCount),
    moves: state.moves + 1,
    linesCleared: state.linesCleared + placement.clearedCount,
    level: nextLevel,
    levelProgress: nextLevelProgress,
    levelGoal: nextLevelGoal
  };

  return {
    state: nextState,
    placementScore,
    clearScore,
    linesCleared: placement.clearedCount,
    rows: placement.rows,
    cols: placement.cols,
    pulseRows: Array.from(new Set(levelUps.flatMap((levelUp) => levelUp.pulseRows))),
    pulseCols: Array.from(new Set(levelUps.flatMap((levelUp) => levelUp.pulseCols))),
    levelProgressGained,
    levelUps
  };
};

export const tokensFromScore = (score: number): number =>
  Math.max(1, Math.floor(score / TOKEN_SCORE_DIVISOR));
