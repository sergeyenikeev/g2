import { canAnyPieceFit, createBoard, getPlaceablePieces } from "../core/board";
import { applyMove, createEmptyState, GameState, MoveResult } from "../core/game";
import { PieceGenerator } from "../core/generator";
import { getPieceById, PIECES } from "../core/pieces";
import { ActivePiece, Board, GameMode, PieceDef, Point } from "../core/types";
import { Rng } from "../core/rng";

const CONTINUE_PREFERRED_IDS = [
  "dot",
  "domino_h",
  "domino_v",
  "square_2",
  "line_3_h",
  "line_3_v",
  "l_3x2",
  "j_3x2"
] as const;

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
    if (this.state.mode !== "tutorial" && this.pieces.every((slot) => slot === null)) {
      this.pieces = this.generator.nextSet(this.state.board, this.state.moves);
    }
    return result;
  }

  setBoardAndPieces(board: Board, pieces: Array<PieceDef | null>): void {
    this.state = {
      ...this.state,
      board,
      combo: 1
    };
    this.pieces = pieces.map((piece) => (piece ? this.wrapPiece(piece, "t") : null));
  }

  canOfferContinue(): boolean {
    return this.buildContinueLoadout().length > 0;
  }

  setContinuePieces(): boolean {
    const loadout = this.buildContinueLoadout();
    if (loadout.length === 0) {
      return false;
    }
    this.pieces = loadout.map((piece) => this.wrapPiece(piece));
    this.state = { ...this.state, combo: 1 };
    this.continueUsed = true;
    return true;
  }

  canPlaceAny(): boolean {
    const available = this.pieces.filter((piece): piece is ActivePiece => piece !== null);
    return canAnyPieceFit(
      this.state.board,
      available.map((piece) => piece.def)
    );
  }

  private wrapPiece(def: PieceDef, prefix = "c"): ActivePiece {
    const instanceId = `${prefix}_${this.idCounter}`;
    this.idCounter += 1;
    return { instanceId, def };
  }

  private buildContinueLoadout(): PieceDef[] {
    const preferred = CONTINUE_PREFERRED_IDS.map((id) => getPieceById(id)).filter(
      (piece): piece is PieceDef => piece !== undefined
    );
    const orderedPool = [
      ...preferred,
      ...PIECES.filter((piece) => !preferred.some((candidate) => candidate.id === piece.id))
    ];
    const placeable = getPlaceablePieces(this.state.board, orderedPool);
    if (placeable.length === 0) {
      return [];
    }

    const selected: PieceDef[] = [];
    for (const piece of placeable) {
      if (selected.some((candidate) => candidate.id === piece.id)) {
        continue;
      }
      selected.push(piece);
      if (selected.length === 3) {
        return selected;
      }
    }

    while (selected.length < 3) {
      selected.push(selected[selected.length % placeable.length] ?? placeable[0]);
    }

    return selected;
  }
}
