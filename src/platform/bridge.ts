import { CONTINUE_COOLDOWN_MS, REWARDED_COOLDOWN_MS } from "../core/constants";
import { logger } from "../utils/logger";

export type PlatformId = "crazygames" | "poki" | "yandex" | "vkplay" | "rustore" | "generic";
export type AdType = "midgame" | "rewarded";
export type RewardedKind = "continue" | "double_tokens" | "rewarded";

export interface AdContext {
  pause: () => void;
  resume: () => void;
  grantReward: () => void;
  rewardKind?: RewardedKind;
}

export interface AdResult {
  shown: boolean;
  reason?: string;
}

export interface PlatformAdapter {
  id: PlatformId;
  init: () => Promise<void>;
  loadingStart: () => void;
  loadingStop: () => void;
  gameplayStart: () => void;
  gameplayStop: () => void;
  showAd: (type: AdType, ctx: AdContext) => Promise<AdResult>;
  hasAdblock?: () => Promise<boolean>;
  getLanguage?: () => Promise<string | null>;
  storageGet?: (key: string) => Promise<string | null>;
  storageSet?: (key: string, value: string) => Promise<void>;
  storageRemove?: (key: string) => Promise<void>;
  track: (eventName: string, payload?: Record<string, unknown>) => void;
  happytime?: () => void;
}

export interface PlatformBridge {
  readonly id: PlatformId;
  init: () => Promise<void>;
  loadingStart: () => void;
  loadingStop: () => void;
  gameplayStart: () => void;
  gameplayStop: () => void;
  showAd: (type: AdType, ctx: AdContext) => Promise<AdResult>;
  canShowRewardedNow: (kind: RewardedKind) => { ok: boolean; reason?: string };
  markContinueUsed: () => void;
  hasAdblock: () => Promise<boolean>;
  getLanguage: () => Promise<string | null>;
  storageGet: (key: string) => Promise<string | null>;
  storageSet: (key: string, value: string) => Promise<void>;
  storageRemove?: (key: string) => Promise<void>;
  track: (eventName: string, payload?: Record<string, unknown>) => void;
  happytime?: () => void;
  getCooldownStatus: () => { rewardedAvailableAt: number; continueAvailableAt: number };
}

export interface Clock {
  now: () => number;
}

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

class MemoryStorage implements StorageLike {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

const getLocalStorage = (): StorageLike => {
  if (typeof globalThis === "undefined" || !("localStorage" in globalThis)) {
    return new MemoryStorage();
  }
  const storage = (globalThis as { localStorage?: Storage }).localStorage;
  if (!storage) {
    return new MemoryStorage();
  }
  try {
    const probeKey = "__ll_probe__";
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return new MemoryStorage();
  }
};

export class PlatformBridgeImpl implements PlatformBridge {
  readonly id: PlatformId;
  private lastRewardedRequestAt = 0;
  private continueCooldownUntil = 0;
  private fallbackStorage: StorageLike;
  private clock: Clock;

  constructor(private adapter: PlatformAdapter, options?: { clock?: Clock }) {
    this.id = adapter.id;
    this.fallbackStorage = getLocalStorage();
    this.clock = options?.clock ?? { now: () => Date.now() };
  }

  async init(): Promise<void> {
    try {
      await this.adapter.init();
      logger.info("sdk_init_ok", { platform: this.id });
    } catch (error) {
      logger.error("sdk_init_fail", { platform: this.id, error: toErrorString(error) });
    }
    await this.loadContinueCooldown();
  }

  loadingStart(): void {
    try {
      this.adapter.loadingStart();
    } catch (error) {
      logger.warn("sdk_loading_start_fail", { platform: this.id, error: toErrorString(error) });
    }
  }

  loadingStop(): void {
    try {
      this.adapter.loadingStop();
    } catch (error) {
      logger.warn("sdk_loading_stop_fail", { platform: this.id, error: toErrorString(error) });
    }
  }

  gameplayStart(): void {
    try {
      this.adapter.gameplayStart();
    } catch (error) {
      logger.warn("sdk_gameplay_start_fail", { platform: this.id, error: toErrorString(error) });
    }
  }

  gameplayStop(): void {
    try {
      this.adapter.gameplayStop();
    } catch (error) {
      logger.warn("sdk_gameplay_stop_fail", { platform: this.id, error: toErrorString(error) });
    }
  }

  async showAd(type: AdType, ctx: AdContext): Promise<AdResult> {
    const rewardKind = type === "rewarded" ? (ctx.rewardKind ?? "rewarded") : undefined;
    const basePayload = rewardKind
      ? { type, platform: this.id, kind: rewardKind }
      : { type, platform: this.id };
    logger.info("ad_requested", basePayload);

    if (type === "rewarded") {
      const eligibility = this.canShowRewardedNow(rewardKind ?? "rewarded");
      if (!eligibility.ok) {
        logger.warn("rewarded_denied", {
          platform: this.id,
          kind: rewardKind ?? "rewarded",
          reason: eligibility.reason ?? "cooldown"
        });
        return { shown: false, reason: eligibility.reason ?? "cooldown" };
      }
      this.lastRewardedRequestAt = this.clock.now();
    }

    let started = false;
    const wrappedCtx: AdContext = {
      pause: () => {
        if (!started) {
          started = true;
          logger.info("ad_started", basePayload);
        }
        ctx.pause();
      },
      resume: () => {
        if (started) {
          logger.info("ad_finished", basePayload);
        }
        ctx.resume();
      },
      grantReward: () => {
        if (type === "rewarded") {
          logger.info("rewarded_used", {
            kind: rewardKind ?? "rewarded",
            platform: this.id
          });
        }
        ctx.grantReward();
      },
      rewardKind
    };

    try {
      const result = await this.adapter.showAd(type, wrappedCtx);
      if (!result.shown) {
        logger.warn("ad_error", {
          type,
          platform: this.id,
          reason: result.reason ?? "not_shown"
        });
      }
      return result;
    } catch (error) {
      logger.error("ad_error", {
        type,
        platform: this.id,
        reason: "exception",
        error: toErrorString(error)
      });
      return { shown: false, reason: "exception" };
    }
  }

  canShowRewardedNow(kind: RewardedKind): { ok: boolean; reason?: string } {
    const now = this.clock.now();
    const rewardedAvailableAt = this.lastRewardedRequestAt + REWARDED_COOLDOWN_MS;
    if (this.lastRewardedRequestAt > 0 && now < rewardedAvailableAt) {
      return { ok: false, reason: "rewarded_cooldown" };
    }
    if (kind === "continue" && now < this.continueCooldownUntil) {
      return { ok: false, reason: "continue_cooldown" };
    }
    return { ok: true };
  }

  markContinueUsed(): void {
    this.continueCooldownUntil = this.clock.now() + CONTINUE_COOLDOWN_MS;
    void this.storageSet("rewardCooldownUntil", `${this.continueCooldownUntil}`);
  }

  async hasAdblock(): Promise<boolean> {
    if (!this.adapter.hasAdblock) {
      return false;
    }
    try {
      return await this.adapter.hasAdblock();
    } catch (error) {
      logger.warn("adblock_check_fail", { platform: this.id, error: toErrorString(error) });
      return false;
    }
  }

  async getLanguage(): Promise<string | null> {
    if (!this.adapter.getLanguage) {
      return null;
    }
    try {
      return await this.adapter.getLanguage();
    } catch (error) {
      logger.warn("language_detect_fail", { platform: this.id, error: toErrorString(error) });
      return null;
    }
  }

  async storageGet(key: string): Promise<string | null> {
    if (this.adapter.storageGet) {
      try {
        const value = await this.adapter.storageGet(key);
        if (value !== undefined) {
          return value;
        }
      } catch (error) {
        logger.warn("storage_get_fail", {
          platform: this.id,
          key,
          error: toErrorString(error)
        });
      }
    }
    try {
      return this.fallbackStorage.getItem(key);
    } catch (error) {
      logger.warn("storage_get_fail", {
        platform: this.id,
        key,
        error: toErrorString(error)
      });
      return null;
    }
  }

  async storageSet(key: string, value: string): Promise<void> {
    if (this.adapter.storageSet) {
      try {
        await this.adapter.storageSet(key, value);
        return;
      } catch (error) {
        logger.warn("storage_set_fail", {
          platform: this.id,
          key,
          error: toErrorString(error)
        });
      }
    }
    try {
      this.fallbackStorage.setItem(key, value);
    } catch (error) {
      logger.warn("storage_set_fail", {
        platform: this.id,
        key,
        error: toErrorString(error)
      });
    }
  }

  async storageRemove(key: string): Promise<void> {
    if (this.adapter.storageRemove) {
      try {
        await this.adapter.storageRemove(key);
        return;
      } catch (error) {
        logger.warn("storage_remove_fail", {
          platform: this.id,
          key,
          error: toErrorString(error)
        });
      }
    }
    try {
      this.fallbackStorage.removeItem?.(key);
    } catch (error) {
      logger.warn("storage_remove_fail", {
        platform: this.id,
        key,
        error: toErrorString(error)
      });
    }
  }

  track(eventName: string, payload?: Record<string, unknown>): void {
    try {
      this.adapter.track(eventName, payload);
    } catch (error) {
      logger.warn("track_fail", { platform: this.id, eventName, error: toErrorString(error) });
    }
  }

  happytime(): void {
    if (!this.adapter.happytime) {
      return;
    }
    try {
      this.adapter.happytime();
    } catch (error) {
      logger.warn("happytime_fail", { platform: this.id, error: toErrorString(error) });
    }
  }

  getCooldownStatus(): { rewardedAvailableAt: number; continueAvailableAt: number } {
    return {
      rewardedAvailableAt: this.lastRewardedRequestAt + REWARDED_COOLDOWN_MS,
      continueAvailableAt: this.continueCooldownUntil
    };
  }

  private async loadContinueCooldown(): Promise<void> {
    const raw = await this.storageGet("rewardCooldownUntil");
    const parsed = raw ? Number(raw) : 0;
    this.continueCooldownUntil = Number.isFinite(parsed) ? parsed : 0;
  }
}

export const createPlatformBridge = (
  adapter: PlatformAdapter,
  options?: { clock?: Clock }
): PlatformBridge => new PlatformBridgeImpl(adapter, options);

const toErrorString = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "unknown_error";
};
