import type { ResultsNextStep } from "./resultsNextStep";
import type { ResultsReplayPrompt } from "./resultsReplay";

export interface ResultsFocusContext {
  replayReason: ResultsReplayPrompt["reason"];
  nextStepKind: ResultsNextStep["kind"] | null;
  themesReason: "ready" | "close" | "spotlight" | null;
  hasStoreOffer: boolean;
}

export interface ResultsFocusSelection {
  kind: "daily" | "weekly_modifier" | "themes" | "store";
  target: "replay" | "themes" | "store";
}

export const selectResultsFocus = (
  context: ResultsFocusContext
): ResultsFocusSelection | null => {
  if (context.replayReason === "daily") {
    return {
      kind: "daily",
      target: "replay"
    };
  }

  if (
    context.replayReason === "weekly_modifier" ||
    context.nextStepKind === "weekly_modifier"
  ) {
    return {
      kind: "weekly_modifier",
      target: "replay"
    };
  }

  if (context.themesReason) {
    return {
      kind: "themes",
      target: "themes"
    };
  }

  if (context.hasStoreOffer) {
    return {
      kind: "store",
      target: "store"
    };
  }

  return null;
};
