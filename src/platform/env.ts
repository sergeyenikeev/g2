import type { PlatformId } from "./bridge";
import {
  normalizeMonetizationConfig,
  type MonetizationConfig
} from "../core/monetization";
import { STORE_OFFERS, type StoreOfferId } from "../core/purchases";

const getProcessEnv = (): Record<string, string | undefined> | undefined => {
  const processLike = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process;
  return processLike?.env;
};

const isTestEnv = (): boolean => {
  const metaEnv = (import.meta as { env?: Record<string, unknown> }).env;
  if (typeof metaEnv?.VITEST === "boolean") {
    return metaEnv.VITEST;
  }
  const processEnv = getProcessEnv();
  if (processEnv) {
    return processEnv.VITEST === "true" || processEnv.NODE_ENV === "test";
  }
  return false;
};

const getEnvValue = (key: string): string | undefined => {
  const processEnv = getProcessEnv();
  if (isTestEnv()) {
    return processEnv?.[key];
  }
  const metaEnv = (import.meta as { env?: Record<string, string> }).env;
  const value = metaEnv?.[key];
  if (value && value.length > 0) {
    return value;
  }
  if (processEnv?.[key]) {
    return processEnv[key];
  }
  return undefined;
};

const normalizeOptionalEnv = (key: string): string | null => {
  const value = getEnvValue(key)?.trim();
  return value && value.length > 0 ? value : null;
};

const normalizeOptionalIntEnv = (key: string): number | undefined => {
  const value = getEnvValue(key)?.trim();
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : undefined;
};

export const resolvePlatformId = (): PlatformId => {
  const raw = (getEnvValue("VITE_PLATFORM") ?? "generic").toLowerCase();
  switch (raw) {
    case "yandex":
    case "vkplay":
    case "rustore":
    case "generic":
      return raw;
    default:
      return "generic";
  }
};

export const resolveUseMock = (): boolean => {
  const raw = getEnvValue("VITE_USE_PLATFORM_MOCK");
  if (raw !== undefined) {
    return raw === "1" || raw.toLowerCase() === "true";
  }
  const metaEnv = (import.meta as { env?: Record<string, boolean> }).env;
  if (typeof metaEnv?.DEV === "boolean") {
    return metaEnv.DEV;
  }
  const processEnv = getProcessEnv();
  return processEnv ? processEnv.NODE_ENV !== "production" : false;
};

export const resolveYandexLeaderboardNames = (): { overall: string | null; daily: string | null } => ({
  overall: normalizeOptionalEnv("VITE_YANDEX_LEADERBOARD_ALL_TIME"),
  daily: normalizeOptionalEnv("VITE_YANDEX_LEADERBOARD_DAILY")
});

const YANDEX_IAP_ENV_KEYS: Record<StoreOfferId, string> = {
  no_ads: "VITE_YANDEX_IAP_NO_ADS",
  starter_pack: "VITE_YANDEX_IAP_STARTER_PACK",
  theme_bundle: "VITE_YANDEX_IAP_THEME_BUNDLE",
  token_pack_small: "VITE_YANDEX_IAP_TOKEN_PACK_SMALL",
  token_pack_medium: "VITE_YANDEX_IAP_TOKEN_PACK_MEDIUM"
};

export const resolveYandexPurchaseProductIds = (): Record<StoreOfferId, string> => {
  const defaults = Object.fromEntries(
    STORE_OFFERS.map((offer) => [offer.id, offer.defaultProductId])
  ) as Record<StoreOfferId, string>;

  for (const [offerId, envKey] of Object.entries(YANDEX_IAP_ENV_KEYS) as Array<[StoreOfferId, string]>) {
    const override = normalizeOptionalEnv(envKey);
    if (override) {
      defaults[offerId] = override;
    }
  }

  return defaults;
};

export const resolveMonetizationConfig = (): MonetizationConfig =>
  normalizeMonetizationConfig({
    menuRewardTokens: normalizeOptionalIntEnv("VITE_MENU_REWARD_TOKENS"),
    continueMinScore: normalizeOptionalIntEnv("VITE_CONTINUE_MIN_SCORE"),
    doubleMinTokens: normalizeOptionalIntEnv("VITE_DOUBLE_MIN_TOKENS"),
    interstitialIntervalRuns: normalizeOptionalIntEnv("VITE_INTERSTITIAL_INTERVAL_RUNS"),
    rewardedCooldownMs: normalizeOptionalIntEnv("VITE_REWARDED_COOLDOWN_MS"),
    continueCooldownMs: normalizeOptionalIntEnv("VITE_CONTINUE_COOLDOWN_MS")
  });
