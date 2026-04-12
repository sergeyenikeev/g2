import type { LoginRewardStatus } from "./loginRewards";
import type { GameMode } from "./types";

export interface ResultsReturnPrompt {
  kind: "ready" | "next";
  day: number;
  tokens: number;
}

export const resolveResultsReturnPrompt = (
  mode: GameMode,
  reward: Pick<LoginRewardStatus, "claimedToday" | "day" | "tokens" | "nextDay" | "nextTokens">
): ResultsReturnPrompt | null => {
  if (mode === "tutorial") {
    return null;
  }

  if (reward.claimedToday) {
    return {
      kind: "next",
      day: reward.nextDay,
      tokens: reward.nextTokens
    };
  }

  return {
    kind: "ready",
    day: reward.day,
    tokens: reward.tokens
  };
};
