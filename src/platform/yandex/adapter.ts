import {
  AdContext,
  AdResult,
  AdType,
  LeaderboardBoard,
  PlatformAdapter,
  PlatformLeaderboardEntry,
  PlatformLeaderboardInfo,
  PlatformLeaderboardSnapshot,
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
}

interface YandexAuth {
  openAuthDialog?: () => Promise<void>;
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
  storage?: YandexStorage;
  environment?: YandexEnvironment;
  leaderboards?: YandexLeaderboards;
  auth?: YandexAuth;
  isAvailableMethod?: (methodName: string) => Promise<boolean>;
  getPlayer?: () => Promise<YandexPlayer>;
}

declare global {
  interface Window {
    YaGames?: { init: () => Promise<YandexSDK> };
  }
}

const waitForSdk = async (timeoutMs = 4000, intervalMs = 100): Promise<YandexSDK | null> => {
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
  const leaderboardNames = resolveYandexLeaderboardNames();

  const resolveSdk = (): YandexSDK | null => sdk;

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
      return player;
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

  return {
    id: "yandex",
    storageScope: "account",
    init: async () => {
      const resolved = await waitForSdk();
      if (!resolved) {
        throw new Error("sdk_missing");
      }
      sdk = resolved;
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
      await resolved.auth.openAuthDialog();
      await resolvePlayer(true);
      return toPlayerProfile();
    },
    track: (eventName: string, payload?: Record<string, unknown>) => {
      logger.info("track", { platform: "yandex", eventName, payload });
    }
  };
};
