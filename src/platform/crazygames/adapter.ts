import { AdContext, AdResult, AdType, PlatformAdapter } from "../bridge";
import { logger } from "../../utils/logger";

export interface CrazyGamesSDK {
  init?: () => Promise<void>;
  game: {
    loadingStart?: () => void;
    loadingStop?: () => void;
    gameplayStart?: () => void;
    gameplayStop?: () => void;
    happytime?: () => void;
  };
  ad: {
    requestAd: (type: AdType, callbacks: CrazyAdCallbacks) => void;
    hasAdblock?: () => Promise<boolean>;
  };
  data?: {
    getItem: (key: string) => Promise<unknown>;
    setItem: (key: string, value: unknown) => Promise<void>;
  };
}

export interface CrazyAdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error?: unknown) => void;
}

declare global {
  interface Window {
    CrazyGames?: { SDK: CrazyGamesSDK };
  }
}

const getSdk = (): CrazyGamesSDK | null => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.CrazyGames?.SDK ?? null;
};

export const createCrazyGamesAdapter = (): PlatformAdapter => {
  let sdk: CrazyGamesSDK | null = null;

  const resolveSdk = (): CrazyGamesSDK | null => {
    if (!sdk) {
      sdk = getSdk();
    }
    return sdk;
  };

  return {
    id: "crazygames",
    init: async () => {
      const resolved = resolveSdk();
      if (!resolved) {
        throw new Error("sdk_missing");
      }
      if (resolved.init) {
        await resolved.init();
      }
    },
    loadingStart: () => {
      resolveSdk()?.game.loadingStart?.();
    },
    loadingStop: () => {
      resolveSdk()?.game.loadingStop?.();
    },
    gameplayStart: () => {
      resolveSdk()?.game.gameplayStart?.();
    },
    gameplayStop: () => {
      resolveSdk()?.game.gameplayStop?.();
    },
    happytime: () => {
      resolveSdk()?.game.happytime?.();
    },
    showAd: async (type: AdType, ctx: AdContext): Promise<AdResult> => {
      const resolved = resolveSdk();
      if (!resolved?.ad?.requestAd) {
        return { shown: false, reason: "sdk_missing" };
      }
      return new Promise<AdResult>((resolve) => {
        resolved.ad.requestAd(type, {
          adStarted: () => {
            ctx.pause();
          },
          adFinished: () => {
            if (type === "rewarded") {
              ctx.grantReward();
            }
            ctx.resume();
            resolve({ shown: true });
          },
          adError: () => {
            ctx.resume();
            resolve({ shown: false, reason: "sdk_error" });
          }
        });
      });
    },
    hasAdblock: async () => {
      const resolved = resolveSdk();
      if (!resolved?.ad?.hasAdblock) {
        return false;
      }
      return resolved.ad.hasAdblock();
    },
    storageGet: async (key: string) => {
      const resolved = resolveSdk();
      if (!resolved?.data?.getItem) {
        throw new Error("storage_unavailable");
      }
      const value = await resolved.data.getItem(key);
      if (value === null || value === undefined) {
        return null;
      }
      return typeof value === "string" ? value : JSON.stringify(value);
    },
    storageSet: async (key: string, value: string) => {
      const resolved = resolveSdk();
      if (!resolved?.data?.setItem) {
        throw new Error("storage_unavailable");
      }
      await resolved.data.setItem(key, value);
    },
    track: (eventName: string, payload?: Record<string, unknown>) => {
      logger.info("track", { platform: "crazygames", eventName, payload });
    }
  };
};
