import {
  AdContext,
  AdResult,
  AdType,
  PlatformAdapter,
  PlatformId,
  PlatformPlayerProfile
} from "../bridge";
import { logger } from "../../utils/logger";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const createMockAdapter = (id: PlatformId): PlatformAdapter => ({
  ...(id === "yandex" ? createYandexMockAuth() : {}),
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
  "getPlayerProfile" | "requestPlayerAuth"
> => {
  let authorized = false;
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
    }
  };
};
