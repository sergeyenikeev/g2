export interface MonetizationConfig {
  menuRewardTokens: number;
  continueMinScore: number;
  doubleMinTokens: number;
  interstitialIntervalRuns: number;
  rewardedCooldownMs: number;
  continueCooldownMs: number;
}

export const DEFAULT_MONETIZATION_CONFIG: MonetizationConfig = {
  menuRewardTokens: 3,
  continueMinScore: 350,
  doubleMinTokens: 1,
  interstitialIntervalRuns: 3,
  rewardedCooldownMs: 90_000,
  continueCooldownMs: 10 * 60 * 1000
};

const coerceInt = (value: unknown, fallback: number, minimum = 0): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(minimum, Math.floor(value));
};

export const normalizeMonetizationConfig = (
  value?: Partial<MonetizationConfig>
): MonetizationConfig => ({
  menuRewardTokens: coerceInt(
    value?.menuRewardTokens,
    DEFAULT_MONETIZATION_CONFIG.menuRewardTokens,
    1
  ),
  continueMinScore: coerceInt(
    value?.continueMinScore,
    DEFAULT_MONETIZATION_CONFIG.continueMinScore,
    0
  ),
  doubleMinTokens: coerceInt(
    value?.doubleMinTokens,
    DEFAULT_MONETIZATION_CONFIG.doubleMinTokens,
    1
  ),
  interstitialIntervalRuns: coerceInt(
    value?.interstitialIntervalRuns,
    DEFAULT_MONETIZATION_CONFIG.interstitialIntervalRuns,
    0
  ),
  rewardedCooldownMs: coerceInt(
    value?.rewardedCooldownMs,
    DEFAULT_MONETIZATION_CONFIG.rewardedCooldownMs,
    0
  ),
  continueCooldownMs: coerceInt(
    value?.continueCooldownMs,
    DEFAULT_MONETIZATION_CONFIG.continueCooldownMs,
    0
  )
});
