import { CONTINUE_COOLDOWN_MS, REWARDED_COOLDOWN_MS } from "./constants";
import { DEFAULT_MONETIZATION_CONFIG } from "./monetization";

export const nextRewardedAllowedAt = (lastRequestAt: number): number =>
  lastRequestAt + REWARDED_COOLDOWN_MS;

export const isRewardedAllowed = (lastRequestAt: number, now: number): boolean =>
  now >= nextRewardedAllowedAt(lastRequestAt);

export const continueAvailableAt = (rewardCooldownUntil: number): number => rewardCooldownUntil;

export const isContinueAllowed = (
  score: number,
  continueUsed: boolean,
  rewardCooldownUntil: number,
  now: number,
  minScore = DEFAULT_MONETIZATION_CONFIG.continueMinScore
): { ok: boolean; reason?: string } => {
  if (continueUsed) {
    return { ok: false, reason: "already_used" };
  }
  if (score < minScore) {
    return { ok: false, reason: "score_low" };
  }
  if (now < rewardCooldownUntil) {
    return { ok: false, reason: "cooldown" };
  }
  return { ok: true };
};

export const getContinueCooldownUntil = (now: number): number => now + CONTINUE_COOLDOWN_MS;
