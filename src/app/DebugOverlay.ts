import { ActivePiece } from "../core/types";

export interface DebugStats {
  fps: number;
  seed: string;
  combo: number;
  nextPieces: Array<ActivePiece | null>;
}

export class DebugOverlay {
  constructor(private element: HTMLElement) {}

  setVisible(visible: boolean): void {
    this.element.hidden = !visible;
  }

  update(stats: DebugStats): void {
    const pieceIds = stats.nextPieces
      .map((piece) => piece?.def.id ?? "-")
      .join(", ");
    this.element.textContent = `FPS: ${stats.fps.toFixed(0)}\nSeed: ${stats.seed}\nCombo: x${stats.combo.toFixed(
      2
    )}\nNext: ${pieceIds}`;
  }
}
