import { COMBO_MAX, COMBO_START, COMBO_STEP } from "./constants";

export const updateCombo = (current: number, linesCleared: number): number => {
  if (linesCleared > 0) {
    return Math.min(COMBO_MAX, parseFloat((current + COMBO_STEP).toFixed(2)));
  }
  return COMBO_START;
};
