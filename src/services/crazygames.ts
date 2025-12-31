import { logger } from "../utils/logger";

export type AdType = "midgame" | "rewarded";

export interface AdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error?: unknown) => void;
}

export interface CrazyDataModule {
  getItem: (key: string) => Promise<unknown>;
  setItem: (key: string, value: unknown) => Promise<void>;
}

export interface CrazyGamesSDK {
  init?: () => Promise<void>;
  game: {
    loadingStart: () => void;
    loadingStop: () => void;
    gameplayStart: () => void;
    gameplayStop: () => void;
    happytime: () => void;
  };
  ad: {
    requestAd: (type: AdType, callbacks: AdCallbacks) => void;
    hasAdblock: () => Promise<boolean>;
  };
  data?: CrazyDataModule;
}

declare global {
  interface Window {
    CrazyGames?: { SDK: CrazyGamesSDK };
  }
}

const createMockSdk = (): CrazyGamesSDK => ({
  init: async () => {
    logger.debug("sdk.mock.init");
  },
  game: {
    loadingStart: () => logger.debug("sdk.mock.loadingStart"),
    loadingStop: () => logger.debug("sdk.mock.loadingStop"),
    gameplayStart: () => logger.debug("sdk.mock.gameplayStart"),
    gameplayStop: () => logger.debug("sdk.mock.gameplayStop"),
    happytime: () => logger.debug("sdk.mock.happytime")
  },
  ad: {
    requestAd: (type: AdType, callbacks: AdCallbacks) => {
      logger.debug("sdk.mock.requestAd", { type });
      callbacks.adStarted?.();
      window.setTimeout(() => {
        callbacks.adFinished?.();
      }, 800);
    },
    hasAdblock: async () => false
  },
  data: {
    getItem: async (key: string) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    },
    setItem: async (key: string, value: unknown) => {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }
});

export class CrazyGamesService {
  private sdk: CrazyGamesSDK = createMockSdk();
  private useMock: boolean;

  constructor() {
    this.useMock = import.meta.env.VITE_USE_CRAZYGAMES_MOCK === "true";
  }

  async init(): Promise<void> {
    if (!this.useMock && window.CrazyGames?.SDK) {
      this.sdk = window.CrazyGames.SDK;
      if (this.sdk.init) {
        await this.sdk.init();
      }
      return;
    }
    this.sdk = createMockSdk();
  }

  getDataModule(): CrazyDataModule | null {
    return this.sdk.data ?? null;
  }

  loadingStart(): void {
    this.sdk.game.loadingStart();
  }

  loadingStop(): void {
    this.sdk.game.loadingStop();
  }

  gameplayStart(): void {
    this.sdk.game.gameplayStart();
  }

  gameplayStop(): void {
    this.sdk.game.gameplayStop();
  }

  happytime(): void {
    this.sdk.game.happytime();
  }

  requestAd(type: AdType, callbacks: AdCallbacks): void {
    this.sdk.ad.requestAd(type, callbacks);
  }

  hasAdblock(): Promise<boolean> {
    return this.sdk.ad.hasAdblock();
  }
}
