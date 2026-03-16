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

type YaGamesMock = {
  init: () => Promise<{
    adv?: {
      showRewardedVideo?: (options: RewardedCallbackOptions) => void;
    };
  }>;
};

type WindowWithYaGames = Window & { YaGames?: YaGamesMock };

type GlobalWindow = {
  window?: WindowWithYaGames;
};

const globalWindow = globalThis as unknown as GlobalWindow;

const setMockWindow = (windowMock: WindowWithYaGames): void => {
  globalWindow.window = windowMock;
};

afterEach(() => {
  globalWindow.window = undefined;
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
