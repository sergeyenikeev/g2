import { createPlatformBridge, PlatformBridge, PlatformId } from "./bridge";
import { resolvePlatformId, resolveUseMock } from "./env";
import { createCrazyGamesAdapter } from "./crazygames/adapter";
import { createPokiAdapter } from "./poki/adapter";
import { createYandexAdapter } from "./yandex/adapter";
import { createVkPlayAdapter } from "./vkplay/adapter";
import { createGenericAdapter } from "./generic/adapter";
import { createMockAdapter } from "./mocks/mockAdapter";
import { createRustoreAdapter } from "./rustore/adapter";
import { logger } from "../utils/logger";

const createAdapter = (platform: PlatformId) => {
  switch (platform) {
    case "crazygames":
      return createCrazyGamesAdapter();
    case "poki":
      return createPokiAdapter();
    case "yandex":
      return createYandexAdapter();
    case "vkplay":
      return createVkPlayAdapter();
    case "rustore":
      return createRustoreAdapter();
    case "generic":
    default:
      return createGenericAdapter();
  }
};

export const createPlatform = (): PlatformBridge => {
  const platform = resolvePlatformId();
  const useMock = resolveUseMock();
  logger.info("platform_selected", { platform, mock: useMock });
  const adapter = useMock ? createMockAdapter(platform) : createAdapter(platform);
  return createPlatformBridge(adapter);
};

export { resolvePlatformId, resolveUseMock };
