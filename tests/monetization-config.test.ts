import { afterEach, describe, expect, it } from "vitest";
import { resolveMonetizationConfig } from "../src/platform/env";
import {
  createPlatformBridge,
  type PlatformAdapter
} from "../src/platform/bridge";

const originalEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    process.env[key] = value;
  }
});

const createAdapter = (): PlatformAdapter => ({
  id: "generic",
  init: async () => {},
  loadingStart: () => {},
  loadingStop: () => {},
  gameplayStart: () => {},
  gameplayStop: () => {},
  showAd: async (_type, ctx) => {
    ctx.pause();
    ctx.resume();
    return { shown: true };
  },
  track: () => {}
});

describe("monetization config", () => {
  it("reads overrides from env", () => {
    process.env.VITE_MENU_REWARD_TOKENS = "5";
    process.env.VITE_CONTINUE_MIN_SCORE = "300";
    process.env.VITE_DOUBLE_MIN_TOKENS = "2";
    process.env.VITE_INTERSTITIAL_INTERVAL_RUNS = "4";

    expect(resolveMonetizationConfig()).toMatchObject({
      menuRewardTokens: 5,
      continueMinScore: 300,
      doubleMinTokens: 2,
      interstitialIntervalRuns: 4
    });
  });

  it("uses bridge cooldown overrides", async () => {
    let now = 1_000;
    const bridge = createPlatformBridge(createAdapter(), {
      clock: { now: () => now },
      monetization: {
        rewardedCooldownMs: 30_000
      }
    });

    await bridge.showAd("rewarded", {
      pause: () => {},
      resume: () => {},
      grantReward: () => {}
    });

    now += 29_999;
    expect(bridge.canShowRewardedNow("rewarded")).toEqual({
      ok: false,
      reason: "rewarded_cooldown"
    });

    now += 1;
    expect(bridge.canShowRewardedNow("rewarded").ok).toBe(true);
  });
});
