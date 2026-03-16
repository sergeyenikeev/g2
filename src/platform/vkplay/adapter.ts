import { AdContext, AdResult, AdType, PlatformAdapter } from "../bridge";
import { logger } from "../../utils/logger";

interface VkBridge {
  send: (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

declare global {
  interface Window {
    vkBridge?: VkBridge;
    VKBridge?: VkBridge;
    VKPlayBridge?: VkBridge;
  }
}

const getBridge = (): VkBridge | null => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.VKPlayBridge ?? window.vkBridge ?? window.VKBridge ?? null;
};

export const createVkPlayAdapter = (): PlatformAdapter => {
  let bridge: VkBridge | null = null;

  const resolveBridge = (): VkBridge | null => {
    if (!bridge) {
      bridge = getBridge();
    }
    return bridge;
  };

  const showVkAd = async (format: "interstitial" | "reward", ctx: AdContext): Promise<AdResult> => {
    const resolved = resolveBridge();
    if (!resolved) {
      return { shown: false, reason: "sdk_missing" };
    }
    ctx.pause();
    try {
      const response = await resolved.send("VKWebAppShowNativeAds", { ad_format: format });
      const result = Boolean(response?.result);
      if (format === "reward" && result) {
        ctx.grantReward();
      }
      ctx.resume();
      return result ? { shown: true } : { shown: false, reason: "no_fill" };
    } catch {
      ctx.resume();
      return { shown: false, reason: "sdk_error" };
    }
  };

  return {
    id: "vkplay",
    init: async () => {
      if (!resolveBridge()) {
        throw new Error("sdk_missing");
      }
    },
    loadingStart: () => {},
    loadingStop: () => {},
    gameplayStart: () => {},
    gameplayStop: () => {},
    showAd: async (type: AdType, ctx: AdContext): Promise<AdResult> => {
      if (type === "midgame") {
        return showVkAd("interstitial", ctx);
      }
      return showVkAd("reward", ctx);
    },
    track: (eventName: string, payload?: Record<string, unknown>) => {
      logger.info("track", { platform: "vkplay", eventName, payload });
    }
  };
};
