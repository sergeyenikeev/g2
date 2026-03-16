import { AdContext, AdResult, AdType, PlatformAdapter } from "../bridge";
import { logger } from "../../utils/logger";

interface PokiSDK {
  init?: () => Promise<void>;
  gameLoadingStart?: () => void;
  gameLoadingFinished?: () => void;
  gameplayStart?: () => void;
  gameplayStop?: () => void;
  commercialBreak?: () => Promise<void>;
  rewardedBreak?: () => Promise<boolean>;
}

declare global {
  interface Window {
    PokiSDK?: PokiSDK;
  }
}

const getSdk = (): PokiSDK | null => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.PokiSDK ?? null;
};

export const createPokiAdapter = (): PlatformAdapter => {
  let sdk: PokiSDK | null = null;

  const resolveSdk = (): PokiSDK | null => {
    if (!sdk) {
      sdk = getSdk();
    }
    return sdk;
  };

  return {
    id: "poki",
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
      resolveSdk()?.gameLoadingStart?.();
    },
    loadingStop: () => {
      resolveSdk()?.gameLoadingFinished?.();
    },
    gameplayStart: () => {
      resolveSdk()?.gameplayStart?.();
    },
    gameplayStop: () => {
      resolveSdk()?.gameplayStop?.();
    },
    showAd: async (type: AdType, ctx: AdContext): Promise<AdResult> => {
      const resolved = resolveSdk();
      if (!resolved) {
        return { shown: false, reason: "sdk_missing" };
      }
      if (type === "midgame") {
        if (!resolved.commercialBreak) {
          return { shown: false, reason: "sdk_missing" };
        }
        ctx.pause();
        try {
          await resolved.commercialBreak();
          ctx.resume();
          return { shown: true };
        } catch {
          ctx.resume();
          return { shown: false, reason: "sdk_error" };
        }
      }
      if (!resolved.rewardedBreak) {
        return { shown: false, reason: "sdk_missing" };
      }
      ctx.pause();
      try {
        const granted = await resolved.rewardedBreak();
        if (granted) {
          ctx.grantReward();
        }
        ctx.resume();
        return granted ? { shown: true } : { shown: false, reason: "not_granted" };
      } catch {
        ctx.resume();
        return { shown: false, reason: "sdk_error" };
      }
    },
    track: (eventName: string, payload?: Record<string, unknown>) => {
      logger.info("track", { platform: "poki", eventName, payload });
    }
  };
};
