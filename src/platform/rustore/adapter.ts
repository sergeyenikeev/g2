import { AdContext, AdResult, AdType, PlatformAdapter, RewardedKind } from "../bridge";
import { logger } from "../../utils/logger";

type RustoreAdResponse = boolean | { success?: boolean; reason?: string };

interface RustoreBridge {
  init?: () => Promise<void> | void;
  showAd?: (options: { type: AdType; kind?: RewardedKind }) => Promise<RustoreAdResponse> | RustoreAdResponse;
  getLanguage?: () => Promise<string | null> | string | null;
  storageGet?: (key: string) => Promise<string | null> | string | null;
  storageSet?: (key: string, value: string) => Promise<void> | void;
  storageRemove?: (key: string) => Promise<void> | void;
  track?: (eventName: string, payload?: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    RustoreBridge?: RustoreBridge;
  }
}

const getBridge = (): RustoreBridge | null => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.RustoreBridge ?? null;
};

const normalizeAdResult = (result: RustoreAdResponse | null | undefined): { success: boolean; reason?: string } => {
  if (typeof result === "boolean") {
    return { success: result };
  }
  if (result && typeof result === "object") {
    return { success: result.success ?? false, reason: result.reason };
  }
  return { success: false };
};

const callBridge = <T extends (...args: unknown[]) => unknown>(
  fn: T | undefined,
  ...args: Parameters<T>
): Promise<Awaited<ReturnType<T>>> => {
  if (!fn) {
    return Promise.resolve(undefined as Awaited<ReturnType<T>>);
  }
  try {
    return Promise.resolve(fn(...args));
  } catch (error) {
    return Promise.reject(error);
  }
};

export const createRustoreAdapter = (): PlatformAdapter => {
  const resolveBridge = (): RustoreBridge | null => getBridge();

  return {
    id: "rustore",
    init: async () => {
      const bridge = resolveBridge();
      if (!bridge?.init) {
        return;
      }
      await callBridge(bridge.init);
    },
    loadingStart: () => {},
    loadingStop: () => {},
    gameplayStart: () => {},
    gameplayStop: () => {},
    showAd: async (type: AdType, ctx: AdContext): Promise<AdResult> => {
      const bridge = resolveBridge();
      if (!bridge?.showAd) {
        return { shown: false, reason: "sdk_missing" };
      }
      ctx.pause();
      try {
        const result = await callBridge(bridge.showAd, { type, kind: ctx.rewardKind });
        const normalized = normalizeAdResult(result);
        if (type === "rewarded" && normalized.success) {
          ctx.grantReward();
        }
        return normalized.success
          ? { shown: true }
          : { shown: false, reason: normalized.reason ?? "sdk_error" };
      } catch (error) {
        return { shown: false, reason: "sdk_error" };
      } finally {
        ctx.resume();
      }
    },
    hasAdblock: async () => false,
    getLanguage: async () => {
      const bridge = resolveBridge();
      if (!bridge?.getLanguage) {
        return null;
      }
      return (await callBridge(bridge.getLanguage)) ?? null;
    },
    storageGet: async (key: string) => {
      const bridge = resolveBridge();
      if (!bridge?.storageGet) {
        throw new Error("storage_unavailable");
      }
      const value = await callBridge(bridge.storageGet, key);
      if (typeof value === "string") {
        return value;
      }
      return null;
    },
    storageSet: async (key: string, value: string) => {
      const bridge = resolveBridge();
      if (!bridge?.storageSet) {
        throw new Error("storage_unavailable");
      }
      await callBridge(bridge.storageSet, key, value);
    },
    storageRemove: async (key: string) => {
      const bridge = resolveBridge();
      if (!bridge?.storageRemove) {
        return;
      }
      await callBridge(bridge.storageRemove, key);
    },
    track: (eventName: string, payload?: Record<string, unknown>) => {
      const bridge = resolveBridge();
      if (bridge?.track) {
        try {
          bridge.track(eventName, payload);
        } catch (error) {
          logger.warn("rustore_track_fail", { eventName, error });
        }
        return;
      }
      logger.info("track", { platform: "rustore", eventName, payload });
    }
  };
};
