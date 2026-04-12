import {
  AdContext,
  AdResult,
  AdType,
  PlatformAdapter,
  PlatformId,
  PlatformPurchase,
  PlatformPlayerProfile
} from "../bridge";
import { STORE_OFFERS } from "../../core/purchases";
import { logger } from "../../utils/logger";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const createMockAdapter = (id: PlatformId): PlatformAdapter => ({
  ...(id === "yandex" ? createYandexMockPlatformFeatures() : {}),
  id,
  storageScope: id === "yandex" ? "account" : "device",
  init: async () => {
    logger.debug("sdk.mock.init", { platform: id });
  },
  loadingStart: () => logger.debug("sdk.mock.loadingStart", { platform: id }),
  loadingStop: () => logger.debug("sdk.mock.loadingStop", { platform: id }),
  gameplayStart: () => logger.debug("sdk.mock.gameplayStart", { platform: id }),
  gameplayStop: () => logger.debug("sdk.mock.gameplayStop", { platform: id }),
  showAd: async (type: AdType, ctx: AdContext): Promise<AdResult> => {
    logger.debug("sdk.mock.requestAd", { platform: id, type });
    ctx.pause();
    await wait(400);
    if (type === "rewarded") {
      ctx.grantReward();
    }
    ctx.resume();
    return { shown: true };
  },
  hasAdblock: async () => false,
  track: (eventName: string, payload?: Record<string, unknown>) => {
    logger.debug("sdk.mock.track", { platform: id, eventName, payload });
  },
  happytime: () => {
    logger.debug("sdk.mock.happytime", { platform: id });
  }
});

const createYandexMockAuth = (): Pick<
  PlatformAdapter,
  | "getPlayerProfile"
  | "requestPlayerAuth"
  | "setStickyBannerVisible"
  | "canReview"
  | "requestReview"
  | "getServerTime"
  | "getPurchaseCatalog"
  | "getPurchases"
  | "purchaseProduct"
  | "consumePurchase"
  | "getFlags"
> => {
  let authorized = false;
  let bannerVisible = false;
  let reviewRequested = false;
  const purchases: PlatformPurchase[] = [];
  const profile = (): PlatformPlayerProfile => ({
    supported: true,
    provider: "yandex",
    authorized,
    displayName: authorized ? "Mock Yandex" : null,
    avatarUrl: null,
    playerId: authorized ? "mock-yandex-player" : null
  });

  return {
    getPlayerProfile: async () => profile(),
    requestPlayerAuth: async () => {
      authorized = true;
      return profile();
    },
    setStickyBannerVisible: async (visible) => {
      bannerVisible = visible;
      logger.debug("sdk.mock.banner", { platform: "yandex", visible });
      return {
        supported: true,
        visible: bannerVisible
      };
    },
    canReview: async () => ({
      supported: true,
      available: !reviewRequested,
      reason: reviewRequested ? "already_requested" : undefined
    }),
    requestReview: async () => {
      reviewRequested = true;
      logger.debug("sdk.mock.review", { platform: "yandex" });
      return {
        supported: true,
        completed: true
      };
    },
    getServerTime: async () => Date.now(),
    getPurchaseCatalog: async () => ({
      supported: true,
      products: STORE_OFFERS.map((offer, index) => ({
        id: offer.defaultProductId,
        title: offer.defaultProductId,
        description: `${offer.kind} mock offer`,
        priceText: `${99 + index * 50} RUB`,
        priceValue: `${99 + index * 50}`,
        priceCurrencyCode: "RUB"
      }))
    }),
    getPurchases: async () => purchases.slice(),
    purchaseProduct: async (productId) => {
      const purchase = {
        productId,
        purchaseToken: `mock_${productId}_${purchases.length + 1}`
      };
      purchases.push(purchase);
      return {
        supported: true,
        purchased: true,
        purchase
      };
    },
    consumePurchase: async (purchaseToken) => {
      const index = purchases.findIndex((purchase) => purchase.purchaseToken === purchaseToken);
      if (index >= 0) {
        purchases.splice(index, 1);
        return true;
      }
      return false;
    },
    getFlags: async (defaultFlags) => defaultFlags
  };
};

const createYandexMockPlatformFeatures = (): Pick<
  PlatformAdapter,
  | "getPlayerProfile"
  | "requestPlayerAuth"
  | "setStickyBannerVisible"
  | "canReview"
  | "requestReview"
  | "getServerTime"
  | "getPurchaseCatalog"
  | "getPurchases"
  | "purchaseProduct"
  | "consumePurchase"
  | "getFlags"
> => {
  return createYandexMockAuth();
};
