import { canAnyPieceFit, createBoard } from "../core/board";
import { applyMove, createEmptyState, GameState, MoveResult } from "../core/game";
import { PieceGenerator } from "../core/generator";
import { getPieceById } from "../core/pieces";
import { ActivePiece, GameMode, PieceDef, Point } from "../core/types";
import { Rng } from "../core/rng";

export class GameSession {
  private generator: PieceGenerator;
  private idCounter = 0;
  pieces: Array<ActivePiece | null> = [null, null, null];
  state: GameState;
  continueUsed = false;
  doubleTokensUsed = false;

  constructor(mode: GameMode, seed: string, rng: Rng, startedAt: number) {
    this.generator = new PieceGenerator(rng);
    this.state = createEmptyState(mode, seed, createBoard(), startedAt);
    this.pieces = this.generator.nextSet(this.state.board, 0);
  }

  placePiece(pieceId: string, origin: Point): MoveResult | null {
    const slotIndex = this.pieces.findIndex((piece) => piece?.instanceId === pieceId);
    if (slotIndex === -1) {
      return null;
    }
    const piece = this.pieces[slotIndex];
    if (!piece) {
      return null;
    }
    const result = applyMove(this.state, piece.def, origin);
    if (!result) {
      return null;
    }
    this.state = result.state;
    this.pieces[slotIndex] = null;
    if (this.pieces.every((slot) => slot === null)) {
      this.pieces = this.generator.nextSet(this.state.board, this.state.moves);
    }
    return result;
  }

  setContinuePieces(): void {
    const dot = getPieceById("dot");
    const domino = getPieceById("domino_h");
    const square = getPieceById("square_2");
    if (!dot || !domino || !square) {
      return;
    }
    this.pieces = [
      this.wrapPiece(dot),
      this.wrapPiece(domino),
      this.wrapPiece(square)
    ];
    this.state = { ...this.state, combo: 1 };
    this.continueUsed = true;
  }

  canPlaceAny(): boolean {
    const available = this.pieces.filter((piece): piece is ActivePiece => piece !== null);
    return canAnyPieceFit(
      this.state.board,
      available.map((piece) => piece.def)
    );
  }

  private wrapPiece(def: PieceDef): ActivePiece {
    const instanceId = `c_${this.idCounter}`;
    this.idCounter += 1;
    return { instanceId, def };
  }
}
