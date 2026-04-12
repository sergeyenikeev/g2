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
      getBannerAdvStatus?: () => Promise<{ stickyAdvIsShowing?: boolean; reason?: string }>;
      showBannerAdv?: () => Promise<void> | void;
      hideBannerAdv?: () => Promise<void> | void;
    };
    auth?: {
      openAuthDialog?: () => Promise<void>;
    };
    feedback?: {
      canReview?: () => Promise<{ value?: boolean; reason?: string }>;
      requestReview?: () => Promise<{
        feedbackSent?: boolean;
        sentFeedback?: boolean;
        reason?: string;
      }>;
    };
    getPlayer?: () => Promise<{
      getName?: () => string;
      getPhoto?: () => string;
      getUniqueID?: () => string;
      isAuthorized?: () => boolean;
      getData?: (keys?: string[] | string) => Promise<Record<string, unknown>>;
      setData?: (data: Record<string, unknown>, flush?: boolean) => Promise<void>;
    }>;
    leaderboards?: {
      getEntries?: (leaderboardName: string) => Promise<YandexLeaderboardResponse>;
      setScore?: (leaderboardName: string, score: number, extraData?: string) => Promise<void>;
    };
    EVENTS?: {
      GAME_API_PAUSE?: string;
      GAME_API_RESUME?: string;
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
    isAvailableMethod?: (methodName: string) => Promise<boolean>;
    serverTime?: () => number;
    getPayments?: () => Promise<{
      getCatalog?: () => Promise<
        Array<{
          id?: string;
          title?: string;
          description?: string;
          imageURI?: string;
          price?: string;
          priceValue?: string;
          priceCurrencyCode?: string;
        }>
      >;
      getPurchases?: () => Promise<
        Array<{
          productID?: string;
          purchaseToken?: string;
          developerPayload?: string;
        }>
      >;
      purchase?: (options: {
        id: string;
        developerPayload?: string;
      }) => Promise<{
        productID?: string;
        purchaseToken?: string;
        developerPayload?: string;
      }>;
      consumePurchase?: (purchaseToken: string) => Promise<void>;
    }>;
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

describe("yandex adapter player data storage", () => {
  it("prefers player cloud data over safe storage", async () => {
    const savedData: Record<string, unknown> = { bestScore: '"42"' };
    const setCalls: Array<Record<string, unknown>> = [];

    setMockWindow({
      YaGames: {
        init: async () => ({
          getPlayer: async () => ({
            isAuthorized: () => true,
            getData: async (keys?: string[] | string) => {
              const requested = Array.isArray(keys) ? keys : typeof keys === "string" ? [keys] : [];
              return Object.fromEntries(requested.map((key) => [key, savedData[key]]));
            },
            setData: async (data: Record<string, unknown>) => {
              Object.assign(savedData, data);
              setCalls.push(data);
            }
          }),
          getStorage: async () => ({
            get: async () => "safe-storage",
            set: async () => {}
          })
        })
      }
    } as unknown as WindowWithYaGames);

    const adapter = createYandexAdapter();
    await adapter.init();

    await expect(adapter.storageGet!("bestScore")).resolves.toBe('"42"');
    await adapter.storageSet!("tokens", "7");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(setCalls).toEqual([{ tokens: "7" }]);
    expect(savedData.tokens).toBe("7");
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

  it("flushes pending player data before opening the auth dialog", async () => {
    const order: string[] = [];
    const savedData: Record<string, unknown> = {};

    setMockWindow({
      YaGames: {
        init: async () => ({
          auth: {
            openAuthDialog: async () => {
              order.push("auth");
            }
          },
          getPlayer: async () => ({
            isAuthorized: () => false,
            getName: () => "",
            getData: async () => ({}),
            setData: async (data: Record<string, unknown>) => {
              order.push("setData");
              Object.assign(savedData, data);
            }
          })
        })
      }
    } as unknown as WindowWithYaGames);

    const adapter = createYandexAdapter();
    await adapter.init();

    await adapter.storageSet!("tokens", "12");
    await adapter.requestPlayerAuth!();

    expect(order).toEqual(["setData", "auth"]);
    expect(savedData.tokens).toBe("12");
  });
});

describe("yandex adapter platform events", () => {
  it("subscribes to pause/resume and account-selection events", async () => {
    const listeners = new Map<string, () => void>();
    const removed: string[] = [];

    setMockWindow({
      YaGames: {
        init: async () => ({
          EVENTS: {
            GAME_API_PAUSE: "game_api_pause",
            GAME_API_RESUME: "game_api_resume",
            ACCOUNT_SELECTION_DIALOG_OPENED: "account_selection_dialog_opened",
            ACCOUNT_SELECTION_DIALOG_CLOSED: "account_selection_dialog_closed"
          },
          on: (eventName: string, listener: () => void) => {
            listeners.set(eventName, listener);
          },
          off: (eventName: string) => {
            removed.push(eventName);
            listeners.delete(eventName);
          }
        })
      }
    } as unknown as WindowWithYaGames);

    const adapter = createYandexAdapter();
    await adapter.init();

    let paused = 0;
    let resumed = 0;
    let opened = 0;
    let closed = 0;
    const unsubscribe =
      adapter.subscribeToPlatformEvents?.({
        pause: () => {
          paused += 1;
        },
        resume: () => {
          resumed += 1;
        },
        accountSelectionOpen: () => {
          opened += 1;
        },
        accountSelectionClose: () => {
          closed += 1;
        }
      }) ?? (() => {});

    listeners.get("game_api_pause")?.();
    listeners.get("game_api_resume")?.();
    listeners.get("account_selection_dialog_opened")?.();
    listeners.get("account_selection_dialog_closed")?.();
    unsubscribe();

    expect({ paused, resumed, opened, closed }).toEqual({
      paused: 1,
      resumed: 1,
      opened: 1,
      closed: 1
    });
    expect(removed).toEqual([
      "game_api_pause",
      "game_api_resume",
      "account_selection_dialog_opened",
      "account_selection_dialog_closed"
    ]);
  });

  it("requests fullscreen through the sdk when available", async () => {
    let requested = 0;

    setMockWindow({
      YaGames: {
        init: async () => ({
          screen: {
            fullscreen: {
              request: async () => {
                requested += 1;
              }
            }
          }
        })
      }
    } as unknown as WindowWithYaGames);

    const adapter = createYandexAdapter();
    await adapter.init();

    await expect(adapter.requestFullscreen!()).resolves.toBe(true);
    expect(requested).toBe(1);
  });

  it("flushes queued player data on explicit storage flush", async () => {
    const setCalls: Array<Record<string, unknown>> = [];

    setMockWindow({
      YaGames: {
        init: async () => ({
          getPlayer: async () => ({
            isAuthorized: () => true,
            getData: async () => ({}),
            setData: async (data: Record<string, unknown>) => {
              setCalls.push(data);
            }
          })
        })
      }
    } as unknown as WindowWithYaGames);

    const adapter = createYandexAdapter();
    await adapter.init();

    await adapter.storageSet!("bestScore", "99");
    await adapter.flushStorage?.();

    expect(setCalls).toEqual([{ bestScore: "99" }]);
  });
});

describe("yandex adapter platform extras", () => {
  it("toggles sticky banner visibility through the sdk", async () => {
    let bannerVisible = false;
    setMockWindow({
      YaGames: {
        init: async () => ({
          adv: {
            getBannerAdvStatus: async () => ({
              stickyAdvIsShowing: bannerVisible
            }),
            showBannerAdv: () => {
              bannerVisible = true;
            },
            hideBannerAdv: () => {
              bannerVisible = false;
            }
          }
        })
      }
    } as unknown as WindowWithYaGames);

    const adapter = createYandexAdapter();
    await adapter.init();

    await expect(adapter.setStickyBannerVisible!(true)).resolves.toEqual({
      supported: true,
      visible: true,
      reason: undefined
    });
    await expect(adapter.setStickyBannerVisible!(false)).resolves.toEqual({
      supported: true,
      visible: false,
      reason: undefined
    });
  });

  it("reports review availability through the sdk", async () => {
    setMockWindow({
      YaGames: {
        init: async () => ({
          feedback: {
            canReview: async () => ({ value: true }),
            requestReview: async () => ({ feedbackSent: true })
          }
        })
      }
    } as unknown as WindowWithYaGames);

    const adapter = createYandexAdapter();
    await adapter.init();

    await expect(adapter.canReview!()).resolves.toEqual({
      supported: true,
      available: true,
      reason: undefined
    });
    await expect(adapter.requestReview!()).resolves.toEqual({
      supported: true,
      completed: true,
      reason: undefined
    });
  });
});
