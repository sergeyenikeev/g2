import { createBoard } from "../core/board";
import { getPieceById } from "../core/pieces";
import { Board, PieceDef, Point } from "../core/types";

interface TutorialStepDefinition {
  messageKey: string;
  boardCells: Point[];
  pieceIds: [string | null, string | null, string | null];
  target: {
    pieceId: string;
    origin: Point;
  };
}

export interface TutorialStep {
  index: number;
  total: number;
  messageKey: string;
  board: Board;
  pieces: [PieceDef | null, PieceDef | null, PieceDef | null];
  target: {
    pieceId: string;
    origin: Point;
    piece: PieceDef;
  };
}

const fillRow = (y: number, fromX: number, toXInclusive: number): Point[] =>
  Array.from({ length: toXInclusive - fromX + 1 }, (_, index) => ({ x: fromX + index, y }));

const fillColumn = (x: number, fromY: number, toYInclusive: number): Point[] =>
  Array.from({ length: toYInclusive - fromY + 1 }, (_, index) => ({ x, y: fromY + index }));

const requirePiece = (id: string): PieceDef => {
  const piece = getPieceById(id);
  if (!piece) {
    throw new Error(`Missing tutorial piece: ${id}`);
  }
  return piece;
};

const buildBoard = (cells: Point[]): Board => {
  const board = createBoard();
  cells.forEach(({ x, y }) => {
    board[y][x] = 1;
  });
  return board;
};

const TUTORIAL_STEP_DEFINITIONS: TutorialStepDefinition[] = [
  {
    messageKey: "tutorial.step1",
    boardCells: fillRow(4, 3, 9),
    pieceIds: ["line_3_h", null, null],
    target: {
      pieceId: "line_3_h",
      origin: { x: 0, y: 4 }
    }
  },
  {
    messageKey: "tutorial.step2",
    boardCells: fillColumn(6, 2, 9),
    pieceIds: ["square_2", null, null],
    target: {
      pieceId: "square_2",
      origin: { x: 5, y: 0 }
    }
  },
  {
    messageKey: "tutorial.step3",
    boardCells: [...fillColumn(1, 0, 4), ...fillColumn(1, 8, 9), ...fillRow(7, 0, 0), ...fillRow(7, 3, 9)],
    pieceIds: ["l_3x2", null, null],
    target: {
      pieceId: "l_3x2",
      origin: { x: 1, y: 5 }
    }
  }
];

export const getTutorialStepsCount = (): number => TUTORIAL_STEP_DEFINITIONS.length;

export const getTutorialStep = (index: number): TutorialStep | null => {
  const definition = TUTORIAL_STEP_DEFINITIONS[index];
  if (!definition) {
    return null;
  }
  const targetPiece = requirePiece(definition.target.pieceId);
  return {
    index,
    total: TUTORIAL_STEP_DEFINITIONS.length,
    messageKey: definition.messageKey,
    board: buildBoard(definition.boardCells),
    pieces: definition.pieceIds.map((pieceId) => (pieceId ? requirePiece(pieceId) : null)) as [
      PieceDef | null,
      PieceDef | null,
      PieceDef | null
    ],
    target: {
      pieceId: definition.target.pieceId,
      origin: { ...definition.target.origin },
      piece: targetPiece
    }
  };
};

export const isTutorialTargetMove = (
  step: TutorialStep,
  pieceId: string,
  origin: Point
): boolean =>
  step.target.pieceId === pieceId &&
  step.target.origin.x === origin.x &&
  step.target.origin.y === origin.y;
