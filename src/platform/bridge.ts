import {
  DEFAULT_MONETIZATION_CONFIG,
  normalizeMonetizationConfig,
  type MonetizationConfig
} from "../core/monetization";
import { logger } from "../utils/logger";

export type PlatformId = "yandex" | "vkplay" | "rustore" | "generic";
export type AdType = "midgame" | "rewarded";
export type RewardedKind = "continue" | "double_tokens" | "rewarded";
export type StorageScope = "device" | "account";
export type LeaderboardBoard = "overall" | "daily";
export type LeaderboardSubmissionState = "enabled" | "auth_required" | "unavailable";

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

export interface PlatformLeaderboardEntry {
  rank: number;
  score: number;
  playerName: string;
  extraData?: string | null;
  playerId?: string | null;
}

export interface PlatformLeaderboardSnapshot {
  board: LeaderboardBoard;
  title?: string;
  entries: PlatformLeaderboardEntry[];
}

export interface PlatformLeaderboardInfo {
  board: LeaderboardBoard;
  enabled: boolean;
  provider: PlatformId | null;
  submissionState: LeaderboardSubmissionState;
}

export interface PlatformLeaderboardSubmitPayload {
  board: LeaderboardBoard;
  score: number;
  extraData?: string;
}

export interface PlatformLeaderboardSubmitResult {
  submitted: boolean;
  reason?: string;
}

export interface PlatformPlayerProfile {
  supported: boolean;
  provider: PlatformId | null;
  authorized: boolean;
  displayName: string | null;
  avatarUrl?: string | null;
  playerId?: string | null;
}

export interface PlatformStickyBannerState {
  supported: boolean;
  visible: boolean;
  reason?: string;
}

export interface PlatformReviewAvailability {
  supported: boolean;
  available: boolean;
  reason?: string;
}

export interface PlatformReviewRequestResult {
  supported: boolean;
  completed: boolean;
  reason?: string;
}

export interface PlatformPurchaseProduct {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  priceText?: string | null;
  priceValue?: string | null;
  priceCurrencyCode?: string | null;
}

export interface PlatformPurchase {
  productId: string;
  purchaseToken?: string | null;
  developerPayload?: string | null;
}

export interface PlatformPurchaseCatalogResult {
  supported: boolean;
  products: PlatformPurchaseProduct[];
  reason?: string;
}

export interface PlatformPurchaseResult {
  supported: boolean;
  purchased: boolean;
  purchase?: PlatformPurchase | null;
  reason?: string;
}

export interface PlatformClientFeature {
  name: string;
  value: string;
}

export interface PlatformEventHandlers {
  pause?: () => void;
  resume?: () => void;
  accountSelectionOpen?: () => void;
  accountSelectionClose?: () => void;
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
  storageScope?: StorageScope;
  storageGet?: (key: string) => Promise<string | null>;
  storageSet?: (key: string, value: string) => Promise<void>;
  storageRemove?: (key: string) => Promise<void>;
  flushStorage?: () => Promise<void>;
  getLeaderboardInfo?: (board: LeaderboardBoard) => Promise<PlatformLeaderboardInfo>;
  getLeaderboardSnapshot?: (board: LeaderboardBoard) => Promise<PlatformLeaderboardSnapshot | null>;
  submitLeaderboardScore?: (
    payload: PlatformLeaderboardSubmitPayload
  ) => Promise<PlatformLeaderboardSubmitResult>;
  getPlayerProfile?: () => Promise<PlatformPlayerProfile>;
  requestPlayerAuth?: () => Promise<PlatformPlayerProfile>;
  setStickyBannerVisible?: (visible: boolean) => Promise<PlatformStickyBannerState>;
  canReview?: () => Promise<PlatformReviewAvailability>;
  requestReview?: () => Promise<PlatformReviewRequestResult>;
  getPurchaseCatalog?: () => Promise<PlatformPurchaseCatalogResult>;
  getPurchases?: () => Promise<PlatformPurchase[]>;
  purchaseProduct?: (productId: string, developerPayload?: string) => Promise<PlatformPurchaseResult>;
  consumePurchase?: (purchaseToken: string) => Promise<boolean>;
  getFlags?: (
    defaultFlags: Record<string, string>,
    clientFeatures?: PlatformClientFeature[]
  ) => Promise<Record<string, string>>;
  subscribeToPlatformEvents?: (handlers: PlatformEventHandlers) => (() => void) | void;
  requestFullscreen?: () => Promise<boolean | void> | boolean | void;
  track: (eventName: string, payload?: Record<string, unknown>) => void;
  happytime?: () => void;
  getServerTime?: () => Promise<number | null>;
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
  getStorageScope: () => StorageScope;
  storageGet: (key: string) => Promise<string | null>;
  storageSet: (key: string, value: string) => Promise<void>;
  storageRemove?: (key: string) => Promise<void>;
  flushStorage: () => Promise<void>;
  getLeaderboardInfo: (board: LeaderboardBoard) => Promise<PlatformLeaderboardInfo>;
  getLeaderboardSnapshot: (board: LeaderboardBoard) => Promise<PlatformLeaderboardSnapshot | null>;
  submitLeaderboardScore: (
    payload: PlatformLeaderboardSubmitPayload
  ) => Promise<PlatformLeaderboardSubmitResult>;
  getPlayerProfile: () => Promise<PlatformPlayerProfile>;
  requestPlayerAuth: () => Promise<PlatformPlayerProfile>;
  setStickyBannerVisible: (visible: boolean) => Promise<PlatformStickyBannerState>;
  canReview: () => Promise<PlatformReviewAvailability>;
  requestReview: () => Promise<PlatformReviewRequestResult>;
  getPurchaseCatalog: () => Promise<PlatformPurchaseCatalogResult>;
  getPurchases: () => Promise<PlatformPurchase[]>;
  purchaseProduct: (productId: string, developerPayload?: string) => Promise<PlatformPurchaseResult>;
  consumePurchase: (purchaseToken: string) => Promise<boolean>;
  getFlags: (
    defaultFlags: Record<string, string>,
    clientFeatures?: PlatformClientFeature[]
  ) => Promise<Record<string, string>>;
  subscribeToPlatformEvents: (handlers: PlatformEventHandlers) => () => void;
  requestFullscreen: () => Promise<boolean>;
  track: (eventName: string, payload?: Record<string, unknown>) => void;
  happytime?: () => void;
  getCooldownStatus: () => { rewardedAvailableAt: number; continueAvailableAt: number };
  getServerTime: () => Promise<number | null>;
  updateMonetizationConfig: (config: Partial<MonetizationConfig>) => void;
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
  private storageScope: StorageScope;
  private monetization: MonetizationConfig;

  constructor(
    private adapter: PlatformAdapter,
    options?: { clock?: Clock; monetization?: Partial<MonetizationConfig> }
  ) {
    this.id = adapter.id;
    this.fallbackStorage = getLocalStorage();
    this.clock = options?.clock ?? { now: () => Date.now() };
    this.storageScope = adapter.storageScope ?? "device";
    this.monetization = normalizeMonetizationConfig(
      options?.monetization ?? DEFAULT_MONETIZATION_CONFIG
    );
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
    this.track("adRequested", basePayload);

    if (type === "rewarded") {
      const eligibility = this.canShowRewardedNow(rewardKind ?? "rewarded");
      if (!eligibility.ok) {
        logger.warn("rewarded_denied", {
          platform: this.id,
          kind: rewardKind ?? "rewarded",
          reason: eligibility.reason ?? "cooldown"
        });
        this.track("rewardedDenied", {
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
          this.track("adStarted", basePayload);
        }
        ctx.pause();
      },
      resume: () => {
        if (started) {
          logger.info("ad_finished", basePayload);
          this.track("adFinished", basePayload);
        }
        ctx.resume();
      },
      grantReward: () => {
        if (type === "rewarded") {
          logger.info("rewarded_used", {
            kind: rewardKind ?? "rewarded",
            platform: this.id
          });
          this.track("rewardedUsed", {
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
        this.track("adError", {
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
      this.track("adError", {
        type,
        platform: this.id,
        reason: "exception"
      });
      return { shown: false, reason: "exception" };
    }
  }

  canShowRewardedNow(kind: RewardedKind): { ok: boolean; reason?: string } {
    const now = this.clock.now();
    const rewardedAvailableAt = this.lastRewardedRequestAt + this.monetization.rewardedCooldownMs;
    if (this.lastRewardedRequestAt > 0 && now < rewardedAvailableAt) {
      return { ok: false, reason: "rewarded_cooldown" };
    }
    if (kind === "continue" && now < this.continueCooldownUntil) {
      return { ok: false, reason: "continue_cooldown" };
    }
    return { ok: true };
  }

  markContinueUsed(): void {
    this.continueCooldownUntil = this.clock.now() + this.monetization.continueCooldownMs;
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

  getStorageScope(): StorageScope {
    return this.storageScope;
  }

  async getLeaderboardInfo(board: LeaderboardBoard): Promise<PlatformLeaderboardInfo> {
    if (!this.adapter.getLeaderboardInfo) {
      return {
        board,
        enabled: false,
        provider: null,
        submissionState: "unavailable"
      };
    }
    try {
      return await this.adapter.getLeaderboardInfo(board);
    } catch (error) {
      logger.warn("leaderboard_info_fail", {
        platform: this.id,
        board,
        error: toErrorString(error)
      });
      return {
        board,
        enabled: false,
        provider: null,
        submissionState: "unavailable"
      };
    }
  }

  async getLeaderboardSnapshot(board: LeaderboardBoard): Promise<PlatformLeaderboardSnapshot | null> {
    if (!this.adapter.getLeaderboardSnapshot) {
      return null;
    }
    try {
      return await this.adapter.getLeaderboardSnapshot(board);
    } catch (error) {
      logger.warn("leaderboard_snapshot_fail", {
        platform: this.id,
        board,
        error: toErrorString(error)
      });
      return null;
    }
  }

  async submitLeaderboardScore(
    payload: PlatformLeaderboardSubmitPayload
  ): Promise<PlatformLeaderboardSubmitResult> {
    if (!this.adapter.submitLeaderboardScore) {
      return { submitted: false, reason: "unavailable" };
    }
    try {
      return await this.adapter.submitLeaderboardScore(payload);
    } catch (error) {
      logger.warn("leaderboard_submit_fail", {
        platform: this.id,
        board: payload.board,
        error: toErrorString(error)
      });
      return { submitted: false, reason: "exception" };
    }
  }

  async getPlayerProfile(): Promise<PlatformPlayerProfile> {
    if (!this.adapter.getPlayerProfile) {
      return {
        supported: false,
        provider: null,
        authorized: false,
        displayName: null,
        avatarUrl: null,
        playerId: null
      };
    }
    try {
      return await this.adapter.getPlayerProfile();
    } catch (error) {
      logger.warn("player_profile_fail", {
        platform: this.id,
        error: toErrorString(error)
      });
      return {
        supported: false,
        provider: this.id,
        authorized: false,
        displayName: null,
        avatarUrl: null,
        playerId: null
      };
    }
  }

  async requestPlayerAuth(): Promise<PlatformPlayerProfile> {
    if (!this.adapter.requestPlayerAuth) {
      return this.getPlayerProfile();
    }
    try {
      return await this.adapter.requestPlayerAuth();
    } catch (error) {
      logger.warn("player_auth_fail", {
        platform: this.id,
        error: toErrorString(error)
      });
      return this.getPlayerProfile();
    }
  }

  async setStickyBannerVisible(visible: boolean): Promise<PlatformStickyBannerState> {
    if (!this.adapter.setStickyBannerVisible) {
      return {
        supported: false,
        visible: false,
        reason: "unsupported"
      };
    }
    try {
      return await this.adapter.setStickyBannerVisible(visible);
    } catch (error) {
      logger.warn("sticky_banner_fail", {
        platform: this.id,
        visible,
        error: toErrorString(error)
      });
      return {
        supported: true,
        visible: false,
        reason: "exception"
      };
    }
  }

  async canReview(): Promise<PlatformReviewAvailability> {
    if (!this.adapter.canReview) {
      return {
        supported: false,
        available: false,
        reason: "unsupported"
      };
    }
    try {
      return await this.adapter.canReview();
    } catch (error) {
      logger.warn("review_check_fail", {
        platform: this.id,
        error: toErrorString(error)
      });
      return {
        supported: true,
        available: false,
        reason: "exception"
      };
    }
  }

  async requestReview(): Promise<PlatformReviewRequestResult> {
    if (!this.adapter.requestReview) {
      return {
        supported: false,
        completed: false,
        reason: "unsupported"
      };
    }
    try {
      return await this.adapter.requestReview();
    } catch (error) {
      logger.warn("review_request_fail", {
        platform: this.id,
        error: toErrorString(error)
      });
      return {
        supported: true,
        completed: false,
        reason: "exception"
      };
    }
  }

  async getPurchaseCatalog(): Promise<PlatformPurchaseCatalogResult> {
    if (!this.adapter.getPurchaseCatalog) {
      return {
        supported: false,
        products: [],
        reason: "unsupported"
      };
    }
    try {
      return await this.adapter.getPurchaseCatalog();
    } catch (error) {
      logger.warn("purchase_catalog_fail", {
        platform: this.id,
        error: toErrorString(error)
      });
      return {
        supported: true,
        products: [],
        reason: "exception"
      };
    }
  }

  async getPurchases(): Promise<PlatformPurchase[]> {
    if (!this.adapter.getPurchases) {
      return [];
    }
    try {
      return await this.adapter.getPurchases();
    } catch (error) {
      logger.warn("purchases_load_fail", {
        platform: this.id,
        error: toErrorString(error)
      });
      return [];
    }
  }

  async purchaseProduct(productId: string, developerPayload?: string): Promise<PlatformPurchaseResult> {
    if (!this.adapter.purchaseProduct) {
      return {
        supported: false,
        purchased: false,
        reason: "unsupported"
      };
    }
    try {
      return await this.adapter.purchaseProduct(productId, developerPayload);
    } catch (error) {
      logger.warn("purchase_request_fail", {
        platform: this.id,
        productId,
        error: toErrorString(error)
      });
      return {
        supported: true,
        purchased: false,
        reason: "exception"
      };
    }
  }

  async consumePurchase(purchaseToken: string): Promise<boolean> {
    if (!this.adapter.consumePurchase) {
      return false;
    }
    try {
      return await this.adapter.consumePurchase(purchaseToken);
    } catch (error) {
      logger.warn("purchase_consume_fail", {
        platform: this.id,
        purchaseToken,
        error: toErrorString(error)
      });
      return false;
    }
  }

  async getFlags(
    defaultFlags: Record<string, string>,
    clientFeatures?: PlatformClientFeature[]
  ): Promise<Record<string, string>> {
    if (!this.adapter.getFlags) {
      return defaultFlags;
    }
    try {
      return await this.adapter.getFlags(defaultFlags, clientFeatures);
    } catch (error) {
      logger.warn("flags_load_fail", {
        platform: this.id,
        error: toErrorString(error)
      });
      return defaultFlags;
    }
  }

  subscribeToPlatformEvents(handlers: PlatformEventHandlers): () => void {
    if (!this.adapter.subscribeToPlatformEvents) {
      return () => {};
    }
    try {
      return this.adapter.subscribeToPlatformEvents(handlers) ?? (() => {});
    } catch (error) {
      logger.warn("platform_events_subscribe_fail", {
        platform: this.id,
        error: toErrorString(error)
      });
      return () => {};
    }
  }

  async requestFullscreen(): Promise<boolean> {
    if (!this.adapter.requestFullscreen) {
      return false;
    }
    try {
      const result = await this.adapter.requestFullscreen();
      return result !== false;
    } catch (error) {
      logger.warn("fullscreen_request_fail", {
        platform: this.id,
        error: toErrorString(error)
      });
      return false;
    }
  }

  updateMonetizationConfig(config: Partial<MonetizationConfig>): void {
    this.monetization = normalizeMonetizationConfig({
      ...this.monetization,
      ...config
    });
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

  async flushStorage(): Promise<void> {
    if (!this.adapter.flushStorage) {
      return;
    }
    try {
      await this.adapter.flushStorage();
    } catch (error) {
      logger.warn("storage_flush_fail", {
        platform: this.id,
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

  async getServerTime(): Promise<number | null> {
    if (!this.adapter.getServerTime) {
      return null;
    }
    try {
      return await this.adapter.getServerTime();
    } catch (error) {
      logger.warn("server_time_fail", { platform: this.id, error: toErrorString(error) });
      return null;
    }
  }

  getCooldownStatus(): { rewardedAvailableAt: number; continueAvailableAt: number } {
    return {
      rewardedAvailableAt: this.lastRewardedRequestAt + this.monetization.rewardedCooldownMs,
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
  options?: { clock?: Clock; monetization?: Partial<MonetizationConfig> }
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
