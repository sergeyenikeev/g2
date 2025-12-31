export type Cell = 0 | 1;
export type Board = Cell[][];

export interface Point {
  x: number;
  y: number;
}

export interface PieceDef {
  id: string;
  cells: Point[];
  size: number;
  bounds: {
    w: number;
    h: number;
  };
}

export interface ActivePiece {
  instanceId: string;
  def: PieceDef;
}

export type GameMode = "play" | "daily";
