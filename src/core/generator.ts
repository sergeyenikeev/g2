import { canAnyPieceFit, getPlaceablePieces } from "./board";
import { PIECES } from "./pieces";
import { Board, ActivePiece, PieceDef } from "./types";
import { Rng } from "./rng";

const LARGE_PIECE_SIZE = 5;

const isLarge = (piece: PieceDef): boolean => piece.size >= LARGE_PIECE_SIZE;

export class PieceGenerator {
  private largeStreak = 0;
  private idCounter = 0;

  constructor(private rng: Rng) {}

  nextSet(board: Board, moveIndex: number): ActivePiece[] {
    const maxAttempts = 24;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const candidate = this.generateSet(this.largeStreak);
      if (moveIndex < 10 && !canAnyPieceFit(board, candidate.pieces)) {
        continue;
      }
      this.largeStreak = candidate.largeStreak;
      return candidate.pieces.map((piece) => this.createActivePiece(piece));
    }

    const placeable = getPlaceablePieces(board, PIECES);
    if (moveIndex < 10 && placeable.length > 0) {
      const forced = this.generateForcedSet(placeable, this.largeStreak);
      this.largeStreak = forced.largeStreak;
      return forced.pieces.map((piece) => this.createActivePiece(piece));
    }

    const fallback = this.generateSet(this.largeStreak);
    this.largeStreak = fallback.largeStreak;
    return fallback.pieces.map((piece) => this.createActivePiece(piece));
  }

  private generateSet(largeStreak: number): { pieces: PieceDef[]; largeStreak: number } {
    const pieces: PieceDef[] = [];
    let streak = largeStreak;
    for (let i = 0; i < 3; i += 1) {
      const pool = streak >= 2 ? PIECES.filter((piece) => !isLarge(piece)) : PIECES;
      const piece = pool[this.pickIndex(pool.length)];
      pieces.push(piece);
      streak = isLarge(piece) ? streak + 1 : 0;
    }
    return { pieces, largeStreak: streak };
  }

  private generateForcedSet(
    placeable: PieceDef[],
    largeStreak: number
  ): { pieces: PieceDef[]; largeStreak: number } {
    const pieces: PieceDef[] = [];
    let streak = largeStreak;
    const forcedPool = streak >= 2 ? placeable.filter((piece) => !isLarge(piece)) : placeable;
    const forcedSource = forcedPool.length > 0 ? forcedPool : placeable;
    const forced = forcedSource[this.pickIndex(forcedSource.length)];
    pieces.push(forced);
    streak = isLarge(forced) ? streak + 1 : 0;

    for (let i = 0; i < 2; i += 1) {
      const pool = streak >= 2 ? PIECES.filter((piece) => !isLarge(piece)) : PIECES;
      const piece = pool[this.pickIndex(pool.length)];
      pieces.push(piece);
      streak = isLarge(piece) ? streak + 1 : 0;
    }

    return { pieces, largeStreak: streak };
  }

  private pickIndex(length: number): number {
    return Math.floor(this.rng() * length);
  }

  private createActivePiece(def: PieceDef): ActivePiece {
    const instanceId = `p_${this.idCounter}`;
    this.idCounter += 1;
    return { instanceId, def };
  }
}
