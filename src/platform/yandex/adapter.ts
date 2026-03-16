import { AdContext, AdResult, AdType, PlatformAdapter } from "../bridge";
import { logger } from "../../utils/logger";

interface YandexStorage {
  get?: (key: string | string[]) => Promise<unknown>;
  set?: (data: Record<string, string>) => Promise<void>;
}

interface YandexAdv {
  showFullscreenAdv?: (options: {
    callbacks?: {
      onOpen?: () => void;
      onClose?: () => void;
      onError?: () => void;
    };
  }) => void;
  showRewardedVideo?: (options: {
    callbacks?: {
      onOpen?: () => void;
      onRewarded?: () => void;
      onClose?: () => void;
      onError?: () => void;
    };
  }) => void;
}

interface YandexFeatures {
  LoadingAPI?: { ready?: () => void };
  GameplayAPI?: { start?: () => void; stop?: () => void };
}

interface YandexI18n {
  lang?: string;
}

interface YandexEnvironment {
  i18n?: YandexI18n;
  lang?: string;
  locale?: string;
}

interface YandexSDK {
  adv?: YandexAdv;
  features?: YandexFeatures;
  getStorage?: () => Promise<YandexStorage>;
  storage?: YandexStorage;
  environment?: YandexEnvironment;
}

declare global {
  interface Window {
    YaGames?: { init: () => Promise<YandexSDK> };
  }
}

const waitForSdk = async (timeoutMs = 4000, intervalMs = 100): Promise<YandexSDK | null> => {
  if (typeof window === "undefined") {
    return null;
  }
  if (window.YaGames?.init) {
    try {
      return await window.YaGames.init();
    } catch {
      return null;
    }
  }
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      if (window.YaGames?.init) {
        window.YaGames
          .init()
          .then((sdk) => resolve(sdk))
          .catch(() => resolve(null));
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        resolve(null);
        return;
      }
      setTimeout(tick, intervalMs);
    };
    tick();
  });
};

export const createYandexAdapter = (): PlatformAdapter => {
  let sdk: YandexSDK | null = null;
  let storage: YandexStorage | null = null;

  const resolveSdk = (): YandexSDK | null => sdk;

  const resolveStorage = async (): Promise<YandexStorage | null> => {
    if (storage) {
      return storage;
    }
    const resolved = resolveSdk();
    if (!resolved) {
      return null;
    }
    if (resolved.getStorage) {
      try {
        storage = await resolved.getStorage();
        return storage;
      } catch {
        return null;
      }
    }
    storage = resolved.storage ?? null;
    return storage;
  };

  return {
    id: "yandex",
    init: async () => {
      const resolved = await waitForSdk();
      if (!resolved) {
        throw new Error("sdk_missing");
      }
      sdk = resolved;
    },
    loadingStart: () => {},
    loadingStop: () => {
      resolveSdk()?.features?.LoadingAPI?.ready?.();
    },
    gameplayStart: () => {
      resolveSdk()?.features?.GameplayAPI?.start?.();
    },
    gameplayStop: () => {
      resolveSdk()?.features?.GameplayAPI?.stop?.();
    },
    getLanguage: async () => {
      const resolved = resolveSdk();
      if (!resolved) {
        return null;
      }
      return (
        resolved.environment?.i18n?.lang ??
        resolved.environment?.lang ??
        resolved.environment?.locale ??
        null
      );
    },
    showAd: async (type: AdType, ctx: AdContext): Promise<AdResult> => {
      const resolved = resolveSdk();
      if (!resolved?.adv) {
        return { shown: false, reason: "sdk_missing" };
      }
      if (type === "midgame") {
        if (!resolved.adv.showFullscreenAdv) {
          return { shown: false, reason: "sdk_missing" };
        }
        return new Promise<AdResult>((resolve) => {
          resolved.adv!.showFullscreenAdv!({
            callbacks: {
              onOpen: () => ctx.pause(),
              onClose: () => {
                ctx.resume();
                resolve({ shown: true });
              },
              onError: () => {
                ctx.resume();
                resolve({ shown: false, reason: "sdk_error" });
              }
            }
          });
        });
      }
      if (!resolved.adv.showRewardedVideo) {
        return { shown: false, reason: "sdk_missing" };
      }
      return new Promise<AdResult>((resolve) => {
        let rewarded = false;
        resolved.adv!.showRewardedVideo!({
          callbacks: {
            onOpen: () => ctx.pause(),
            onRewarded: () => {
              rewarded = true;
              ctx.grantReward();
            },
            onClose: () => {
              ctx.resume();
              resolve(rewarded ? { shown: true } : { shown: false, reason: "not_granted" });
            },
            onError: () => {
              ctx.resume();
              resolve({ shown: false, reason: "sdk_error" });
            }
          }
        });
      });
    },
    storageGet: async (key: string) => {
      const store = await resolveStorage();
      if (!store?.get) {
        throw new Error("storage_unavailable");
      }
      const result = await store.get(key);
      if (typeof result === "string") {
        return result;
      }
      if (result && typeof result === "object" && key in (result as Record<string, string>)) {
        return String((result as Record<string, string>)[key]);
      }
      return null;
    },
    storageSet: async (key: string, value: string) => {
      const store = await resolveStorage();
      if (!store?.set) {
        throw new Error("storage_unavailable");
      }
      await store.set({ [key]: value });
    },
    track: (eventName: string, payload?: Record<string, unknown>) => {
      logger.info("track", { platform: "yandex", eventName, payload });
    }
  };
};
