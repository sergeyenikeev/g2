import {
  DEFAULT_MONETIZATION_CONFIG,
  normalizeMonetizationConfig,
  type MonetizationConfig
} from "./monetization";
import { STORE_OFFERS, type StoreOfferId } from "./purchases";

export interface StoreExperimentConfig {
  storeEnabled: boolean;
  starterPackResultsEnabled: boolean;
  starterPackResultsMinScore: number;
  starterPackResultsMaxRuns: number;
  enabledOfferIds: StoreOfferId[];
}

export interface RuntimeRemoteConfig {
  monetization: MonetizationConfig;
  store: StoreExperimentConfig;
  rawFlags: Record<string, string>;
}

const DEFAULT_STARTER_PACK_RESULTS_MIN_SCORE = 500;
const DEFAULT_STARTER_PACK_RESULTS_MAX_RUNS = 8;

const OFFER_FLAG_KEYS: Record<StoreOfferId, string> = {
  no_ads: "offer_no_ads_enabled",
  starter_pack: "offer_starter_pack_enabled",
  theme_bundle: "offer_theme_bundle_enabled",
  token_pack_small: "offer_token_pack_small_enabled",
  token_pack_medium: "offer_token_pack_medium_enabled"
};

const parseBooleanFlag = (value: string | undefined, fallback: boolean): boolean => {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
    return false;
  }
  return fallback;
};

const parseIntFlag = (value: string | undefined, fallback: number): number => {
  if (typeof value !== "string") {
    return fallback;
  }
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
};

export const buildDefaultRemoteFlags = (
  monetization: MonetizationConfig = DEFAULT_MONETIZATION_CONFIG
): Record<string, string> => ({
  menu_reward_tokens: `${monetization.menuRewardTokens}`,
  continue_min_score: `${monetization.continueMinScore}`,
  double_min_tokens: `${monetization.doubleMinTokens}`,
  interstitial_interval_runs: `${monetization.interstitialIntervalRuns}`,
  rewarded_cooldown_ms: `${monetization.rewardedCooldownMs}`,
  continue_cooldown_ms: `${monetization.continueCooldownMs}`,
  store_enabled: "true",
  starter_pack_results_enabled: "true",
  starter_pack_results_min_score: `${DEFAULT_STARTER_PACK_RESULTS_MIN_SCORE}`,
  starter_pack_results_max_runs: `${DEFAULT_STARTER_PACK_RESULTS_MAX_RUNS}`,
  offer_no_ads_enabled: "true",
  offer_starter_pack_enabled: "true",
  offer_theme_bundle_enabled: "true",
  offer_token_pack_small_enabled: "true",
  offer_token_pack_medium_enabled: "true"
});

export const parseRemoteConfig = (
  flags: Record<string, string>,
  fallbackMonetization: MonetizationConfig = DEFAULT_MONETIZATION_CONFIG
): RuntimeRemoteConfig => {
  const monetization = normalizeMonetizationConfig({
    menuRewardTokens: parseIntFlag(flags.menu_reward_tokens, fallbackMonetization.menuRewardTokens),
    continueMinScore: parseIntFlag(flags.continue_min_score, fallbackMonetization.continueMinScore),
    doubleMinTokens: parseIntFlag(flags.double_min_tokens, fallbackMonetization.doubleMinTokens),
    interstitialIntervalRuns: parseIntFlag(
      flags.interstitial_interval_runs,
      fallbackMonetization.interstitialIntervalRuns
    ),
    rewardedCooldownMs: parseIntFlag(flags.rewarded_cooldown_ms, fallbackMonetization.rewardedCooldownMs),
    continueCooldownMs: parseIntFlag(flags.continue_cooldown_ms, fallbackMonetization.continueCooldownMs)
  });

  const enabledOfferIds = STORE_OFFERS.map((offer) => offer.id).filter((offerId) =>
    parseBooleanFlag(flags[OFFER_FLAG_KEYS[offerId]], true)
  );

  return {
    monetization,
    store: {
      storeEnabled: parseBooleanFlag(flags.store_enabled, true),
      starterPackResultsEnabled: parseBooleanFlag(flags.starter_pack_results_enabled, true),
      starterPackResultsMinScore: parseIntFlag(
        flags.starter_pack_results_min_score,
        DEFAULT_STARTER_PACK_RESULTS_MIN_SCORE
      ),
      starterPackResultsMaxRuns: parseIntFlag(
        flags.starter_pack_results_max_runs,
        DEFAULT_STARTER_PACK_RESULTS_MAX_RUNS
      ),
      enabledOfferIds
    },
    rawFlags: flags
  };
};
