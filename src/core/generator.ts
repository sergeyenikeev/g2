import { canAnyPieceFit, getPlaceablePieces } from "./board";
import { PIECES } from "./pieces";
import { Board, ActivePiece, PieceDef } from "./types";
import { Rng } from "./rng";

const LARGE_PIECE_SIZE = 5;
const EASY_PIECE_IDS = new Set([
  "dot",
  "domino_h",
  "domino_v",
  "square_2",
  "line_3_h",
  "line_3_v",
  "line_4_h",
  "line_4_v"
]);
const HARD_PIECE_IDS = new Set([
  "rect_2x3",
  "rect_3x2",
  "t_3x2",
  "s_3x2",
  "z_3x2",
  "plus"
]);

const isLarge = (piece: PieceDef): boolean => piece.size >= LARGE_PIECE_SIZE;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const getBucket = (piece: PieceDef): "easy" | "medium" | "hard" => {
  if (EASY_PIECE_IDS.has(piece.id)) {
    return "easy";
  }
  if (HARD_PIECE_IDS.has(piece.id)) {
    return "hard";
  }
  return "medium";
};

const filterPoolForStreak = (pieces: PieceDef[], largeStreak: number): PieceDef[] =>
  largeStreak >= 2 ? pieces.filter((piece) => !isLarge(piece)) : pieces;

export class PieceGenerator {
  private largeStreak = 0;
  private idCounter = 0;

  constructor(private rng: Rng) {}

  nextSet(board: Board, moveIndex: number, level = 1): ActivePiece[] {
    const maxAttempts = 24;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const candidate = this.generateSet(this.largeStreak, moveIndex, level);
      if (!canAnyPieceFit(board, candidate.pieces)) {
        continue;
      }
      this.largeStreak = candidate.largeStreak;
      return candidate.pieces.map((piece) => this.createActivePiece(piece));
    }

    const placeable = getPlaceablePieces(board, PIECES);
    if (placeable.length > 0) {
      const forced = this.generateForcedSet(placeable, this.largeStreak, moveIndex, level);
      this.largeStreak = forced.largeStreak;
      return forced.pieces.map((piece) => this.createActivePiece(piece));
    }

    const fallback = this.generateSet(this.largeStreak, moveIndex, level);
    this.largeStreak = fallback.largeStreak;
    return fallback.pieces.map((piece) => this.createActivePiece(piece));
  }

  private generateSet(
    largeStreak: number,
    moveIndex: number,
    level: number
  ): { pieces: PieceDef[]; largeStreak: number } {
    const pieces: PieceDef[] = [];
    let streak = largeStreak;
    for (let i = 0; i < 3; i += 1) {
      const pool = filterPoolForStreak(PIECES, streak);
      const piece = this.pickPiece(pool, moveIndex + i, level);
      pieces.push(piece);
      streak = isLarge(piece) ? streak + 1 : 0;
    }
    return { pieces, largeStreak: streak };
  }

  private generateForcedSet(
    placeable: PieceDef[],
    largeStreak: number,
    moveIndex: number,
    level: number
  ): { pieces: PieceDef[]; largeStreak: number } {
    const pieces: PieceDef[] = [];
    let streak = largeStreak;

    const forcedPool = filterPoolForStreak(placeable, streak);
    const forcedSource = forcedPool.length > 0 ? forcedPool : placeable;
    const forced = this.pickPiece(forcedSource, moveIndex, level);
    pieces.push(forced);
    streak = isLarge(forced) ? streak + 1 : 0;

    for (let i = 0; i < 2; i += 1) {
      const pool = filterPoolForStreak(PIECES, streak);
      const piece = this.pickPiece(pool, moveIndex + i + 1, level);
      pieces.push(piece);
      streak = isLarge(piece) ? streak + 1 : 0;
    }

    return { pieces, largeStreak: streak };
  }

  private pickPiece(source: PieceDef[], moveIndex: number, level: number): PieceDef {
    if (source.length === 0) {
      return PIECES[0];
    }

    const buckets = {
      easy: source.filter((piece) => getBucket(piece) === "easy"),
      medium: source.filter((piece) => getBucket(piece) === "medium"),
      hard: source.filter((piece) => getBucket(piece) === "hard")
    };
    const weights = this.getBucketWeights(moveIndex, level);
    const roll = this.rng();
    const preferredBucket =
      roll < weights.easy
        ? "easy"
        : roll < weights.easy + weights.medium
          ? "medium"
          : "hard";

    const bucketOrder =
      preferredBucket === "easy"
        ? [buckets.easy, buckets.medium, buckets.hard]
        : preferredBucket === "medium"
          ? [buckets.medium, buckets.easy, buckets.hard]
          : [buckets.hard, buckets.medium, buckets.easy];

    const selected = bucketOrder.find((bucket) => bucket.length > 0) ?? source;
    return selected[this.pickIndex(selected.length)];
  }

  private getBucketWeights(
    moveIndex: number,
    level: number
  ): { easy: number; medium: number; hard: number } {
    const pressure = clamp((level - 1) / 8, 0, 1);
    const openingEase = moveIndex < 6 ? 0.14 : moveIndex < 12 ? 0.08 : 0;
    const easy = clamp(0.58 - pressure * 0.28 + openingEase, 0.24, 0.74);
    const hard = clamp(0.14 + pressure * 0.24 - openingEase * 0.5, 0.08, 0.42);
    const medium = Math.max(0.14, 1 - easy - hard);
    const total = easy + medium + hard;
    return {
      easy: easy / total,
      medium: medium / total,
      hard: hard / total
    };
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
