import type { GameMode } from "./types";

export const resolveResultsReplayMode = (
  currentMode: GameMode,
  hasDailyCompletionToday: boolean
): GameMode => {
  if (currentMode === "tutorial" || currentMode === "daily" || hasDailyCompletionToday) {
    return currentMode;
  }
  return "daily";
};
