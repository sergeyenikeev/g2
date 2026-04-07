import { afterEach, describe, expect, it } from "vitest";
import { createYandexAdapter } from "../src/platform/yandex/adapter";

type RewardedCallbackOptions = {
  callbacks?: {
    onOpen?: () => void;
    onRewarded?: () => void;
    onClose?: () => void;
    onError?: () => void;
  };
};

type YandexLeaderboardResponse = {
  entries?: Array<{
    rank?: number;
    score?: number;
    extraData?: string;
    player?: {
      publicName?: string;
      uniqueID?: string;
    };
  }>;
};

type YaGamesMock = {
  init: () => Promise<{
    adv?: {
      showRewardedVideo?: (options: RewardedCallbackOptions) => void;
    };
    auth?: {
      openAuthDialog?: () => Promise<void>;
    };
    getPlayer?: () => Promise<{
      getName?: () => string;
      getPhoto?: () => string;
      getUniqueID?: () => string;
      isAuthorized?: () => boolean;
    }>;
    leaderboards?: {
      getEntries?: (leaderboardName: string) => Promise<YandexLeaderboardResponse>;
      setScore?: (leaderboardName: string, score: number, extraData?: string) => Promise<void>;
    };
    isAvailableMethod?: (methodName: string) => Promise<boolean>;
  }>;
};

type WindowWithYaGames = Window & { YaGames?: YaGamesMock };

type GlobalWindow = {
  window?: WindowWithYaGames;
};

const originalEnv = { ...process.env };
const globalWindow = globalThis as unknown as GlobalWindow;

const setMockWindow = (windowMock: WindowWithYaGames): void => {
  globalWindow.window = windowMock;
};

afterEach(() => {
  globalWindow.window = undefined;
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    process.env[key] = value;
  }
});

describe("yandex adapter rewarded flow", () => {
  it("returns not_granted when rewarded callback is not fired", async () => {
    setMockWindow({
      YaGames: {
        init: async () => ({
          adv: {
            showRewardedVideo: (options: RewardedCallbackOptions) => {
              options.callbacks?.onOpen?.();
              options.callbacks?.onClose?.();
            }
          }
        })
      }
    } as unknown as WindowWithYaGames);

    const adapter = createYandexAdapter();
    await adapter.init();

    let granted = false;
    let paused = 0;
    let resumed = 0;
    const result = await adapter.showAd("rewarded", {
      pause: () => {
        paused += 1;
      },
      resume: () => {
        resumed += 1;
      },
      grantReward: () => {
        granted = true;
      }
    });

    expect(result).toEqual({ shown: false, reason: "not_granted" });
    expect(granted).toBe(false);
    expect(paused).toBe(1);
    expect(resumed).toBe(1);
  });

  it("returns shown when rewarded callback is fired", async () => {
    setMockWindow({
      YaGames: {
        init: async () => ({
          adv: {
            showRewardedVideo: (options: RewardedCallbackOptions) => {
              options.callbacks?.onOpen?.();
              options.callbacks?.onRewarded?.();
              options.callbacks?.onClose?.();
            }
          }
        })
      }
    } as unknown as WindowWithYaGames);

    const adapter = createYandexAdapter();
    await adapter.init();

    let granted = false;
    const result = await adapter.showAd("rewarded", {
      pause: () => {},
      resume: () => {},
      grantReward: () => {
        granted = true;
      }
    });

    expect(result).toEqual({ shown: true });
    expect(granted).toBe(true);
  });
});

describe("yandex adapter leaderboards", () => {
  it("reports configured leaderboard boards and auth-gated submission state", async () => {
    process.env.VITE_YANDEX_LEADERBOARD_ALL_TIME = "all-time";
    setMockWindow({
      YaGames: {
        init: async () => ({
          leaderboards: {
            getEntries: async () => ({ entries: [] }),
            setScore: async () => {}
          },
          isAvailableMethod: async (methodName: string) => methodName !== "leaderboards.setScore"
        })
      }
    } as unknown as WindowWithYaGames);

    const adapter = createYandexAdapter();
    await adapter.init();

    await expect(adapter.getLeaderboardInfo!("overall")).resolves.toEqual({
      board: "overall",
      enabled: true,
      provider: "yandex",
      submissionState: "auth_required"
    });
    await expect(adapter.getLeaderboardInfo!("daily")).resolves.toEqual({
      board: "daily",
      enabled: false,
      provider: null,
      submissionState: "unavailable"
    });
  });

  it("maps leaderboard entries from the sdk response", async () => {
    process.env.VITE_YANDEX_LEADERBOARD_ALL_TIME = "all-time";
    setMockWindow({
      YaGames: {
        init: async () => ({
          leaderboards: {
            getEntries: async () => ({
              entries: [
                {
                  rank: 1,
                  score: 640,
                  extraData: '{"playerName":"Nova","level":4}',
                  player: {
                    publicName: "Portal Hero",
                    uniqueID: "ya-1"
                  }
                }
              ]
            })
          },
          isAvailableMethod: async () => true
        })
      }
    } as unknown as WindowWithYaGames);

    const adapter = createYandexAdapter();
    await adapter.init();

    await expect(adapter.getLeaderboardSnapshot!("overall")).resolves.toEqual({
      board: "overall",
      title: undefined,
      entries: [
        {
          rank: 1,
          score: 640,
          playerName: "Portal Hero",
          extraData: '{"playerName":"Nova","level":4}',
          playerId: "ya-1"
        }
      ]
    });
  });

  it("submits scores only when the sdk allows it", async () => {
    process.env.VITE_YANDEX_LEADERBOARD_ALL_TIME = "all-time";
    const submissions: Array<{ leaderboardName: string; score: number; extraData?: string }> = [];
    setMockWindow({
      YaGames: {
        init: async () => ({
          leaderboards: {
            getEntries: async () => ({ entries: [] }),
            setScore: async (leaderboardName: string, score: number, extraData?: string) => {
              submissions.push({ leaderboardName, score, extraData });
            }
          },
          isAvailableMethod: async (methodName: string) => methodName === "leaderboards.setScore"
        })
      }
    } as unknown as WindowWithYaGames);

    const adapter = createYandexAdapter();
    await adapter.init();

    await expect(
      adapter.submitLeaderboardScore!({
        board: "overall",
        score: 123,
        extraData: '{"mode":"play"}'
      })
    ).resolves.toEqual({ submitted: true });
    expect(submissions).toEqual([
      {
        leaderboardName: "all-time",
        score: 123,
        extraData: '{"mode":"play"}'
      }
    ]);
  });
});

describe("yandex adapter player auth", () => {
  it("returns guest profile without forcing auth", async () => {
    setMockWindow({
      YaGames: {
        init: async () => ({
          getPlayer: async () => ({
            isAuthorized: () => false,
            getName: () => ""
          })
        })
      }
    } as unknown as WindowWithYaGames);

    const adapter = createYandexAdapter();
    await adapter.init();

    await expect(adapter.getPlayerProfile!()).resolves.toEqual({
      supported: true,
      provider: "yandex",
      authorized: false,
      displayName: null,
      avatarUrl: null,
      playerId: null
    });
  });

  it("opens optional auth dialog and returns connected profile", async () => {
    let authorized = false;
    let authOpened = 0;
    setMockWindow({
      YaGames: {
        init: async () => ({
          auth: {
            openAuthDialog: async () => {
              authOpened += 1;
              authorized = true;
            }
          },
          getPlayer: async () => ({
            isAuthorized: () => authorized,
            getName: () => (authorized ? "Nova" : ""),
            getUniqueID: () => (authorized ? "ya-player" : ""),
            getPhoto: () => (authorized ? "avatar.png" : "")
          })
        })
      }
    } as unknown as WindowWithYaGames);

    const adapter = createYandexAdapter();
    await adapter.init();

    await expect(adapter.requestPlayerAuth!()).resolves.toEqual({
      supported: true,
      provider: "yandex",
      authorized: true,
      displayName: "Nova",
      avatarUrl: "avatar.png",
      playerId: "ya-player"
    });
    expect(authOpened).toBe(1);
  });
});
