import { AdContext, AdResult, AdType, PlatformAdapter } from "../bridge";
import { logger } from "../../utils/logger";

export const createGenericAdapter = (): PlatformAdapter => ({
  id: "generic",
  init: async () => {},
  loadingStart: () => {},
  loadingStop: () => {},
  gameplayStart: () => {},
  gameplayStop: () => {},
  showAd: async (_type: AdType, _ctx: AdContext): Promise<AdResult> => ({
    shown: false,
    reason: "unsupported"
  }),
  hasAdblock: async () => false,
  track: (eventName: string, payload?: Record<string, unknown>) => {
    logger.info("track", { platform: "generic", eventName, payload });
  }
});
