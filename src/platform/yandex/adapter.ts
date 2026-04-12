import {
  AdContext,
  AdResult,
  AdType,
  LeaderboardBoard,
  PlatformAdapter,
  PlatformLeaderboardEntry,
  PlatformLeaderboardInfo,
  PlatformLeaderboardSnapshot,
  PlatformClientFeature,
  PlatformEventHandlers,
  PlatformPurchase,
  PlatformPurchaseCatalogResult,
  PlatformPurchaseProduct,
  PlatformPurchaseResult,
  PlatformPlayerProfile,
  PlatformLeaderboardSubmitPayload,
  PlatformLeaderboardSubmitResult
} from "../bridge";
import { resolveYandexLeaderboardNames } from "../env";
import { logger } from "../../utils/logger";

interface YandexStorage {
  get?: (key: string | string[]) => Promise<unknown>;
  set?: (data: Record<string, string>) => Promise<void>;
}

interface YandexPurchaseProduct {
  id?: string;
  title?: string;
  description?: string;
  imageURI?: string;
  price?: string;
  priceValue?: string;
  priceCurrencyCode?: string;
}

interface YandexPurchasedProduct {
  productID?: string;
  purchaseToken?: string;
  developerPayload?: string;
}

interface YandexPayments {
  getCatalog?: () => Promise<YandexPurchaseProduct[]>;
  getPurchases?: () => Promise<YandexPurchasedProduct[]>;
  purchase?: (options: { id: string; developerPayload?: string }) => Promise<YandexPurchasedProduct>;
  consumePurchase?: (purchaseToken: string) => Promise<void>;
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
  getBannerAdvStatus?: () => Promise<YandexBannerStatus> | YandexBannerStatus;
  showBannerAdv?: () => Promise<void> | void;
  hideBannerAdv?: () => Promise<void> | void;
}

interface YandexBannerStatus {
  stickyAdvIsShowing?: boolean;
  reason?: string;
}

interface YandexFeatures {
  LoadingAPI?: { ready?: () => void };
  GameplayAPI?: { start?: () => void; stop?: () => void };
}

interface YandexLeaderboardPlayer {
  publicName?: string;
  uniqueID?: string;
}

interface YandexLeaderboardTitle {
  en?: string;
  ru?: string;
}

interface YandexLeaderboardInfoBlock {
  title?: string | YandexLeaderboardTitle;
}

interface YandexLeaderboardRecord {
  rank?: number;
  score?: number;
  extraData?: string;
  player?: YandexLeaderboardPlayer;
}

interface YandexLeaderboardEntriesResponse {
  entries?: YandexLeaderboardRecord[];
  leaderboard?: YandexLeaderboardInfoBlock;
}

interface YandexLeaderboards {
  getEntries?: (
    leaderboardName: string,
    options?: {
      quantityTop?: number;
      includeUser?: boolean;
      quantityAround?: number;
    }
  ) => Promise<YandexLeaderboardEntriesResponse>;
  setScore?: (leaderboardName: string, score: number, extraData?: string) => Promise<void>;
}

interface YandexPlayer {
  getName?: () => string;
  getPhoto?: (size?: "small" | "medium" | "large") => string;
  getUniqueID?: () => string;
  isAuthorized?: () => boolean;
  getPayingStatus?: () => string;
  getData?: (
    keys?: string[] | string
  ) => Promise<Record<string, unknown>>;
  setData?: (data: Record<string, unknown>, flush?: boolean) => Promise<void>;
}

interface YandexAuth {
  openAuthDialog?: () => Promise<void>;
}

interface YandexFeedbackCanReview {
  value?: boolean;
  reason?: string;
}

interface YandexFeedbackRequestReview {
  feedbackSent?: boolean;
  sentFeedback?: boolean;
  reason?: string;
}

interface YandexFeedback {
  canReview?: () => Promise<YandexFeedbackCanReview>;
  requestReview?: () => Promise<YandexFeedbackRequestReview>;
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
  getPayments?: (options?: { signed?: boolean }) => Promise<YandexPayments>;
  storage?: YandexStorage;
  environment?: YandexEnvironment;
  leaderboards?: YandexLeaderboards;
  payments?: YandexPayments;
  auth?: YandexAuth;
  feedback?: YandexFeedback;
  isAvailableMethod?: (methodName: string) => Promise<boolean>;
  getPlayer?: () => Promise<YandexPlayer>;
  getFlags?: (options: {
    defaultFlags: Record<string, string>;
    clientFeatures?: PlatformClientFeature[];
  }) => Promise<Record<string, string>>;
  serverTime?: () => number;
  EVENTS?: {
    GAME_API_PAUSE?: string;
    GAME_API_RESUME?: string;
    ACCOUNT_SELECTION_DIALOG_OPEN?: string;
    ACCOUNT_SELECTION_DIALOG_OPENED?: string;
    ACCOUNT_SELECTION_DIALOG_CLOSED?: string;
  };
  on?: (eventName: string, listener: () => void) => void;
  off?: (eventName: string, listener: () => void) => void;
  screen?: {
    fullscreen?: {
      request?: () => Promise<void> | void;
    };
  };
}

declare global {
  interface Window {
    YaGames?: { init: () => Promise<YandexSDK> };
    __lumelinesYandexSdkReady?: Promise<void> | null;
  }
}

const waitForSdk = async (timeoutMs = 10_000, intervalMs = 100): Promise<YandexSDK | null> => {
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
  if (window.__lumelinesYandexSdkReady) {
    try {
      await window.__lumelinesYandexSdkReady;
      return window.YaGames?.init ? await window.YaGames.init() : null;
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
  let player: YandexPlayer | null = null;
  let payments: YandexPayments | null = null;
  let playerDataCache: Record<string, string> = {};
  let pendingPlayerData: Record<string, string> = {};
  let playerDataFlushTimer: ReturnType<typeof setTimeout> | null = null;
  let playerDataFlushPromise: Promise<void> | null = null;
  const leaderboardNames = resolveYandexLeaderboardNames();

  const resolveSdk = (): YandexSDK | null => sdk;

  const resolvePayments = async (): Promise<YandexPayments | null> => {
    if (payments) {
      return payments;
    }
    const resolved = resolveSdk();
    if (!resolved) {
      return null;
    }
    if (resolved.payments) {
      payments = resolved.payments;
      return payments;
    }
    if (!resolved.getPayments) {
      return null;
    }
    try {
      payments = await resolved.getPayments();
      return payments;
    } catch {
      return null;
    }
  };

  const resolvePlayer = async (force = false): Promise<YandexPlayer | null> => {
    if (player && !force) {
      return player;
    }
    const resolved = resolveSdk();
    if (!resolved?.getPlayer) {
      return null;
    }
    try {
      player = await resolved.getPlayer();
      if (force) {
        playerDataCache = {};
        pendingPlayerData = {};
      }
      return player;
    } catch {
      return null;
    }
  };

  const flushPlayerData = async (): Promise<void> => {
    if (playerDataFlushTimer) {
      clearTimeout(playerDataFlushTimer);
      playerDataFlushTimer = null;
    }
    const queuedEntries = Object.entries(pendingPlayerData);
    if (queuedEntries.length === 0) {
      return;
    }
    const resolvedPlayer = await resolvePlayer();
    if (!resolvedPlayer?.setData) {
      return;
    }
    const snapshot = Object.fromEntries(queuedEntries);
    pendingPlayerData = {};
    playerDataFlushPromise = resolvedPlayer
      .setData(snapshot, true)
      .catch(() => {
        for (const [key, value] of Object.entries(snapshot)) {
          pendingPlayerData[key] = value;
        }
      })
      .finally(() => {
        playerDataFlushPromise = null;
      });
    await playerDataFlushPromise;
  };

  const schedulePlayerDataFlush = (): void => {
    if (playerDataFlushTimer) {
      clearTimeout(playerDataFlushTimer);
    }
    playerDataFlushTimer = setTimeout(() => {
      void flushPlayerData();
    }, 0);
  };

  const readPlayerDataValue = async (key: string): Promise<string | null> => {
    if (key in pendingPlayerData) {
      return pendingPlayerData[key];
    }
    if (key in playerDataCache) {
      return playerDataCache[key];
    }
    const resolvedPlayer = await resolvePlayer();
    if (!resolvedPlayer?.getData) {
      return null;
    }
    try {
      const data = await resolvedPlayer.getData([key]);
      const value = data?.[key];
      if (typeof value === "string") {
        playerDataCache[key] = value;
        return value;
      }
      if (value == null) {
        return null;
      }
      const serialized = typeof value === "object" ? JSON.stringify(value) : String(value);
      playerDataCache[key] = serialized;
      return serialized;
    } catch {
      return null;
    }
  };

  const toPlayerProfile = async (): Promise<PlatformPlayerProfile> => {
    const resolved = resolveSdk();
    if (!resolved?.getPlayer) {
      return {
        supported: false,
        provider: "yandex",
        authorized: false,
        displayName: null,
        avatarUrl: null,
        playerId: null
      };
    }
    const resolvedPlayer = await resolvePlayer();
    const authorized = Boolean(resolvedPlayer?.isAuthorized?.());
    const displayName = resolvedPlayer?.getName?.().trim() || null;
    return {
      supported: true,
      provider: "yandex",
      authorized,
      displayName,
      avatarUrl: resolvedPlayer?.getPhoto?.("small") ?? null,
      playerId: resolvedPlayer?.getUniqueID?.() ?? null
    };
  };

  const getBoardName = (board: LeaderboardBoard): string | null =>
    board === "overall" ? leaderboardNames.overall : leaderboardNames.daily;

  const resolveBannerStatus = async (): Promise<YandexBannerStatus | null> => {
    const resolved = resolveSdk();
    if (!resolved?.adv?.getBannerAdvStatus) {
      return null;
    }
    try {
      return await resolved.adv.getBannerAdvStatus();
    } catch {
      return null;
    }
  };

  const normalizePurchase = (purchase: YandexPurchasedProduct): PlatformPurchase | null => {
    if (typeof purchase.productID !== "string" || purchase.productID.trim().length === 0) {
      return null;
    }
    return {
      productId: purchase.productID,
      purchaseToken: purchase.purchaseToken ?? null,
      developerPayload: purchase.developerPayload ?? null
    };
  };

  const normalizeCatalogProduct = (product: YandexPurchaseProduct): PlatformPurchaseProduct | null => {
    if (typeof product.id !== "string" || product.id.trim().length === 0) {
      return null;
    }
    return {
      id: product.id,
      title: product.title?.trim() || product.id,
      description: product.description?.trim() || null,
      imageUrl: product.imageURI ?? null,
      priceText: product.price ?? null,
      priceValue: product.priceValue ?? null,
      priceCurrencyCode: product.priceCurrencyCode ?? null
    };
  };

  const isMethodAvailable = async (methodName: string): Promise<boolean> => {
    const resolved = resolveSdk();
    if (!resolved) {
      return false;
    }
    if (resolved.isAvailableMethod) {
      try {
        return await resolved.isAvailableMethod(methodName);
      } catch {
        return false;
      }
    }
    if (methodName === "leaderboards.setScore") {
      return typeof resolved.leaderboards?.setScore === "function";
    }
    if (methodName === "leaderboards.getPlayerEntry") {
      return true;
    }
    return false;
  };

  const getSubmissionState = async (): Promise<PlatformLeaderboardInfo["submissionState"]> => {
    const resolved = resolveSdk();
    if (!resolved?.leaderboards?.setScore) {
      return "unavailable";
    }
    return (await isMethodAvailable("leaderboards.setScore")) ? "enabled" : "auth_required";
  };

  const pickLeaderboardTitle = (value: string | YandexLeaderboardTitle | undefined): string | undefined => {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
    if (!value || typeof value !== "object") {
      return undefined;
    }
    return value.ru ?? value.en;
  };

  const normalizeLeaderboardEntry = (
    entry: YandexLeaderboardRecord,
    fallbackRank: number
  ): PlatformLeaderboardEntry => ({
    rank: typeof entry.rank === "number" && Number.isFinite(entry.rank) ? entry.rank : fallbackRank,
    score: typeof entry.score === "number" && Number.isFinite(entry.score) ? Math.max(0, Math.floor(entry.score)) : 0,
    playerName: entry.player?.publicName ?? "",
    extraData: typeof entry.extraData === "string" ? entry.extraData : null,
    playerId: entry.player?.uniqueID ?? null
  });

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

  const subscribeToEvent = (
    resolved: YandexSDK,
    eventName: string | undefined,
    listener: (() => void) | undefined,
    subscriptions: Array<{ eventName: string; listener: () => void }>
  ): void => {
    if (!eventName || !listener || !resolved.on) {
      return;
    }
    resolved.on(eventName, listener);
    subscriptions.push({ eventName, listener });
  };

  return {
    id: "yandex",
    storageScope: "account",
    init: async () => {
      const resolved = await waitForSdk();
      if (!resolved) {
        throw new Error("sdk_missing");
      }
      sdk = resolved;
      await resolvePayments();
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
      const playerValue = await readPlayerDataValue(key);
      if (playerValue !== null) {
        return playerValue;
      }
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
      const resolvedPlayer = await resolvePlayer();
      if (resolvedPlayer?.setData) {
        playerDataCache[key] = value;
        pendingPlayerData[key] = value;
        schedulePlayerDataFlush();
        return;
      }
      const store = await resolveStorage();
      if (!store?.set) {
        throw new Error("storage_unavailable");
      }
      await store.set({ [key]: value });
    },
    getLeaderboardInfo: async (board: LeaderboardBoard): Promise<PlatformLeaderboardInfo> => {
      const leaderboardName = getBoardName(board);
      const resolved = resolveSdk();
      if (!leaderboardName || !resolved?.leaderboards?.getEntries) {
        return {
          board,
          enabled: false,
          provider: null,
          submissionState: "unavailable"
        };
      }
      return {
        board,
        enabled: true,
        provider: "yandex",
        submissionState: await getSubmissionState()
      };
    },
    getLeaderboardSnapshot: async (
      board: LeaderboardBoard
    ): Promise<PlatformLeaderboardSnapshot | null> => {
      const leaderboardName = getBoardName(board);
      const resolved = resolveSdk();
      if (!leaderboardName || !resolved?.leaderboards?.getEntries) {
        return null;
      }
      const includeUser = await isMethodAvailable("leaderboards.getPlayerEntry");
      const response = await resolved.leaderboards.getEntries(leaderboardName, {
        quantityTop: 10,
        includeUser,
        quantityAround: includeUser ? 1 : undefined
      });
      const entries = Array.isArray(response.entries)
        ? response.entries.slice(0, 10).map((entry, index) => normalizeLeaderboardEntry(entry, index + 1))
        : [];
      return {
        board,
        title: pickLeaderboardTitle(response.leaderboard?.title),
        entries
      };
    },
    submitLeaderboardScore: async (
      payload: PlatformLeaderboardSubmitPayload
    ): Promise<PlatformLeaderboardSubmitResult> => {
      const leaderboardName = getBoardName(payload.board);
      const resolved = resolveSdk();
      if (!leaderboardName) {
        return { submitted: false, reason: "not_configured" };
      }
      if (!resolved?.leaderboards?.setScore) {
        return { submitted: false, reason: "unavailable" };
      }
      if (!(await isMethodAvailable("leaderboards.setScore"))) {
        return { submitted: false, reason: "auth_required" };
      }
      await resolved.leaderboards.setScore(
        leaderboardName,
        Math.max(0, Math.floor(payload.score)),
        payload.extraData
      );
      return { submitted: true };
    },
    getPlayerProfile: async (): Promise<PlatformPlayerProfile> => toPlayerProfile(),
    requestPlayerAuth: async (): Promise<PlatformPlayerProfile> => {
      const resolved = resolveSdk();
      if (!resolved?.auth?.openAuthDialog) {
        return toPlayerProfile();
      }
      if (playerDataFlushTimer) {
        clearTimeout(playerDataFlushTimer);
        playerDataFlushTimer = null;
      }
      await flushPlayerData();
      if (playerDataFlushPromise) {
        await playerDataFlushPromise;
      }
      await resolved.auth.openAuthDialog();
      playerDataCache = {};
      pendingPlayerData = {};
      await resolvePlayer(true);
      return toPlayerProfile();
    },
    setStickyBannerVisible: async (visible) => {
      const resolved = resolveSdk();
      if (
        !resolved?.adv?.getBannerAdvStatus ||
        !resolved.adv.showBannerAdv ||
        !resolved.adv.hideBannerAdv
      ) {
        return {
          supported: false,
          visible: false,
          reason: "unsupported"
        };
      }
      if (visible) {
        await Promise.resolve(resolved.adv.showBannerAdv());
      } else {
        await Promise.resolve(resolved.adv.hideBannerAdv());
      }
      const status = await resolveBannerStatus();
      return {
        supported: true,
        visible: status?.stickyAdvIsShowing === true,
        reason: status?.reason
      };
    },
    canReview: async () => {
      const resolved = resolveSdk();
      if (!resolved?.feedback?.canReview) {
        return {
          supported: false,
          available: false,
          reason: "unsupported"
        };
      }
      const result = await resolved.feedback.canReview();
      return {
        supported: true,
        available: result?.value === true,
        reason: result?.reason
      };
    },
    requestReview: async () => {
      const resolved = resolveSdk();
      if (!resolved?.feedback?.requestReview) {
        return {
          supported: false,
          completed: false,
          reason: "unsupported"
        };
      }
      const result = await resolved.feedback.requestReview();
      return {
        supported: true,
        completed: result?.feedbackSent === true || result?.sentFeedback === true,
        reason: result?.reason
      };
    },
    getServerTime: async () => {
      const resolved = resolveSdk();
      if (typeof resolved?.serverTime !== "function") {
        return null;
      }
      const value = resolved.serverTime();
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    },
    getPurchaseCatalog: async (): Promise<PlatformPurchaseCatalogResult> => {
      const resolvedPayments = await resolvePayments();
      if (!resolvedPayments?.getCatalog) {
        return {
          supported: false,
          products: [],
          reason: "unsupported"
        };
      }
      const products = await resolvedPayments.getCatalog();
      return {
        supported: true,
        products: (Array.isArray(products) ? products : [])
          .map((product) => normalizeCatalogProduct(product))
          .filter((product): product is PlatformPurchaseProduct => product !== null)
      };
    },
    getPurchases: async (): Promise<PlatformPurchase[]> => {
      const resolvedPayments = await resolvePayments();
      if (!resolvedPayments?.getPurchases) {
        return [];
      }
      const purchases = await resolvedPayments.getPurchases();
      return (Array.isArray(purchases) ? purchases : [])
        .map((purchase) => normalizePurchase(purchase))
        .filter((purchase): purchase is PlatformPurchase => purchase !== null);
    },
    purchaseProduct: async (productId, developerPayload): Promise<PlatformPurchaseResult> => {
      const resolvedPayments = await resolvePayments();
      if (!resolvedPayments?.purchase) {
        return {
          supported: false,
          purchased: false,
          reason: "unsupported"
        };
      }
      try {
        const purchase = await resolvedPayments.purchase({ id: productId, developerPayload });
        return {
          supported: true,
          purchased: true,
          purchase: normalizePurchase(purchase)
        };
      } catch (error) {
        return {
          supported: true,
          purchased: false,
          reason: error instanceof Error ? error.message : "purchase_failed"
        };
      }
    },
    consumePurchase: async (purchaseToken) => {
      const resolvedPayments = await resolvePayments();
      if (!resolvedPayments?.consumePurchase) {
        return false;
      }
      await resolvedPayments.consumePurchase(purchaseToken);
      return true;
    },
    getFlags: async (defaultFlags, clientFeatures) => {
      const resolved = resolveSdk();
      if (!resolved?.getFlags) {
        return defaultFlags;
      }
      const resolvedPlayer = await resolvePlayer();
      const payingStatus =
        typeof resolvedPlayer?.getPayingStatus === "function" ? resolvedPlayer.getPayingStatus() : null;
      const mergedClientFeatures = [...(clientFeatures ?? [])];
      if (
        typeof payingStatus === "string" &&
        payingStatus.trim().length > 0 &&
        !mergedClientFeatures.some((feature) => feature.name === "payingStatus")
      ) {
        mergedClientFeatures.push({
          name: "payingStatus",
          value: payingStatus
        });
      }
      try {
        return await resolved.getFlags({
          defaultFlags,
          clientFeatures: mergedClientFeatures
        });
      } catch {
        return defaultFlags;
      }
    },
    subscribeToPlatformEvents: (handlers: PlatformEventHandlers) => {
      const resolved = resolveSdk();
      if (!resolved?.on || !resolved.EVENTS) {
        return () => {};
      }
      const subscriptions: Array<{ eventName: string; listener: () => void }> = [];
      subscribeToEvent(resolved, resolved.EVENTS.GAME_API_PAUSE, handlers.pause, subscriptions);
      subscribeToEvent(resolved, resolved.EVENTS.GAME_API_RESUME, handlers.resume, subscriptions);
      subscribeToEvent(
        resolved,
        resolved.EVENTS.ACCOUNT_SELECTION_DIALOG_OPENED ?? resolved.EVENTS.ACCOUNT_SELECTION_DIALOG_OPEN,
        handlers.accountSelectionOpen,
        subscriptions
      );
      subscribeToEvent(
        resolved,
        resolved.EVENTS.ACCOUNT_SELECTION_DIALOG_CLOSED,
        handlers.accountSelectionClose,
        subscriptions
      );
      return () => {
        if (!resolved.off) {
          return;
        }
        for (const subscription of subscriptions) {
          resolved.off(subscription.eventName, subscription.listener);
        }
      };
    },
    requestFullscreen: async () => {
      const resolved = resolveSdk();
      if (!resolved?.screen?.fullscreen?.request) {
        return false;
      }
      await resolved.screen.fullscreen.request();
      return true;
    },
    flushStorage: async () => {
      await flushPlayerData();
      if (playerDataFlushPromise) {
        await playerDataFlushPromise;
      }
    },
    track: (eventName: string, payload?: Record<string, unknown>) => {
      logger.info("track", { platform: "yandex", eventName, payload });
    }
  };
};
