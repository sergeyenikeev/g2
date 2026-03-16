import { ActivePiece } from "../core/types";

export interface DebugStats {
  fps: number;
  seed: string;
  combo: number;
  nextPieces: Array<ActivePiece | null>;
  platform: string;
  mode: string;
  rewardedCooldownMs: number;
  continueCooldownMs: number;
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
    const rewardedSeconds = Math.ceil(stats.rewardedCooldownMs / 1000);
    const continueSeconds = Math.ceil(stats.continueCooldownMs / 1000);
    const rewardedLabel = rewardedSeconds > 0 ? `${rewardedSeconds}s` : "ready";
    const continueLabel = continueSeconds > 0 ? `${continueSeconds}s` : "ready";
    this.element.textContent = `Platform: ${stats.platform}\nMode: ${stats.mode}\nFPS: ${stats.fps.toFixed(
      0
    )}\nSeed: ${stats.seed}\nCombo: x${stats.combo.toFixed(
      2
    )}\nRewarded CD: ${rewardedLabel}\nContinue CD: ${continueLabel}\nNext: ${pieceIds}`;
  }
}
