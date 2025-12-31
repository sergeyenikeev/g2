import { CONTINUE_COOLDOWN_MS, REWARDED_COOLDOWN_MS } from "./constants";

export const nextRewardedAllowedAt = (lastRequestAt: number): number =>
  lastRequestAt + REWARDED_COOLDOWN_MS;

export const isRewardedAllowed = (lastRequestAt: number, now: number): boolean =>
  now >= nextRewardedAllowedAt(lastRequestAt);

export const continueAvailableAt = (rewardCooldownUntil: number): number => rewardCooldownUntil;

export const isContinueAllowed = (
  score: number,
  continueUsed: boolean,
  rewardCooldownUntil: number,
  now: number
): { ok: boolean; reason?: string } => {
  if (continueUsed) {
    return { ok: false, reason: "already_used" };
  }
  if (score < 800) {
    return { ok: false, reason: "score_low" };
  }
  if (now < rewardCooldownUntil) {
    return { ok: false, reason: "cooldown" };
  }
  return { ok: true };
};

export const getContinueCooldownUntil = (now: number): number => now + CONTINUE_COOLDOWN_MS;
