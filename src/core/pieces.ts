import { PieceDef, Point } from "./types";

const makePiece = (id: string, cells: Point[]): PieceDef => {
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const normalized = cells.map((c) => ({ x: c.x - minX, y: c.y - minY }));
  const maxX = Math.max(...normalized.map((c) => c.x));
  const maxY = Math.max(...normalized.map((c) => c.y));
  return {
    id,
    cells: normalized,
    size: normalized.length,
    bounds: { w: maxX + 1, h: maxY + 1 }
  };
};

export const PIECES: PieceDef[] = [
  makePiece("dot", [{ x: 0, y: 0 }]),
  makePiece("domino_v", [
    { x: 0, y: 0 },
    { x: 0, y: 1 }
  ]),
  makePiece("domino_h", [
    { x: 0, y: 0 },
    { x: 1, y: 0 }
  ]),
  makePiece("square_2", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 }
  ]),
  makePiece("line_3_h", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 }
  ]),
  makePiece("line_3_v", [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 }
  ]),
  makePiece("line_4_h", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 }
  ]),
  makePiece("line_4_v", [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 0, y: 3 }
  ]),
  makePiece("rect_2x3", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 }
  ]),
  makePiece("rect_3x2", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 }
  ]),
  makePiece("l_3x2", [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 }
  ]),
  makePiece("j_3x2", [
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 1, y: 2 },
    { x: 0, y: 2 }
  ]),
  makePiece("t_3x2", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 1, y: 1 }
  ]),
  makePiece("s_3x2", [
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 }
  ]),
  makePiece("z_3x2", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 1 }
  ]),
  makePiece("plus", [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 1, y: 2 }
  ])
];

export const getPieceById = (id: string): PieceDef | undefined =>
  PIECES.find((piece) => piece.id === id);
