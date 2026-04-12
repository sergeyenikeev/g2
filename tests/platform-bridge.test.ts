import { describe, expect, it, afterEach } from "vitest";
import {
  createPlatformBridge,
  PlatformAdapter,
  PlatformId
} from "../src/platform/bridge";
import { createPlatform } from "../src/platform/factory";
import { createGenericAdapter } from "../src/platform/generic/adapter";
import { createVkPlayAdapter } from "../src/platform/vkplay/adapter";
import { CONTINUE_COOLDOWN_MS, REWARDED_COOLDOWN_MS } from "../src/core/constants";

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
  if ("localStorage" in globalThis) {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});

const createTestAdapter = (id: PlatformId = "generic"): PlatformAdapter => ({
  id,
  init: async () => {},
  loadingStart: () => {},
  loadingStop: () => {},
  gameplayStart: () => {},
  gameplayStop: () => {},
  showAd: async (type, ctx) => {
    ctx.pause();
    if (type === "rewarded") {
      ctx.grantReward();
    }
    ctx.resume();
    return { shown: true };
  },
  track: () => {}
});

describe("platform factory", () => {
  it("defaults to generic when env is missing", () => {
    delete process.env.VITE_PLATFORM;
    process.env.VITE_USE_PLATFORM_MOCK = "1";
    const platform = createPlatform();
    expect(platform.id).toBe("generic");
  });

  it("uses VITE_PLATFORM when set", () => {
    process.env.VITE_PLATFORM = "vkplay";
    process.env.VITE_USE_PLATFORM_MOCK = "1";
    const platform = createPlatform();
    expect(platform.id).toBe("vkplay");
  });

  it("normalizes unknown platform to generic", () => {
    process.env.VITE_PLATFORM = "unknown";
    process.env.VITE_USE_PLATFORM_MOCK = "1";
    const platform = createPlatform();
    expect(platform.id).toBe("generic");
  });

  it("falls back to generic for retired legacy targets", () => {
    process.env.VITE_PLATFORM = "crazygames";
    process.env.VITE_USE_PLATFORM_MOCK = "1";
    const platform = createPlatform();
    expect(platform.id).toBe("generic");
  });
});

describe("platform cooldowns", () => {
  it("blocks rewarded before 90s cooldown", async () => {
    let now = 1_000;
    const bridge = createPlatformBridge(createTestAdapter(), { clock: { now: () => now } });
    await bridge.showAd("rewarded", {
      pause: () => {},
      resume: () => {},
      grantReward: () => {}
    });
    now += REWARDED_COOLDOWN_MS - 1;
    expect(bridge.canShowRewardedNow("double_tokens").ok).toBe(false);
  });

  it("allows rewarded after cooldown window", async () => {
    let now = 1_000;
    const bridge = createPlatformBridge(createTestAdapter(), { clock: { now: () => now } });
    await bridge.showAd("rewarded", {
      pause: () => {},
      resume: () => {},
      grantReward: () => {}
    });
    now += REWARDED_COOLDOWN_MS;
    expect(bridge.canShowRewardedNow("double_tokens").ok).toBe(true);
  });

  it("blocks continue after markContinueUsed", () => {
    let now = 2_000;
    const bridge = createPlatformBridge(createTestAdapter(), { clock: { now: () => now } });
    bridge.markContinueUsed();
    expect(bridge.canShowRewardedNow("continue").ok).toBe(false);
  });

  it("allows continue after cooldown window", () => {
    let now = 2_000;
    const bridge = createPlatformBridge(createTestAdapter(), { clock: { now: () => now } });
    bridge.markContinueUsed();
    now += CONTINUE_COOLDOWN_MS;
    expect(bridge.canShowRewardedNow("continue").ok).toBe(true);
  });

  it("continue cooldown does not block double tokens", () => {
    let now = 2_000;
    const bridge = createPlatformBridge(createTestAdapter(), { clock: { now: () => now } });
    bridge.markContinueUsed();
    expect(bridge.canShowRewardedNow("double_tokens").ok).toBe(true);
  });
});

describe("sdk missing behavior", () => {
  it("returns shown:false and does not grant reward", async () => {
    const bridge = createPlatformBridge(createVkPlayAdapter());
    let rewarded = false;
    const result = await bridge.showAd("rewarded", {
      pause: () => {},
      resume: () => {},
      grantReward: () => {
        rewarded = true;
      }
    });
    expect(result.shown).toBe(false);
    expect(result.reason).toBe("sdk_missing");
    expect(rewarded).toBe(false);
  });
});

describe("storage fallback", () => {
  it("reports device scope by default", () => {
    const bridge = createPlatformBridge(createTestAdapter());
    expect(bridge.getStorageScope()).toBe("device");
  });

  it("reports account scope when adapter storage is account-backed", () => {
    const bridge = createPlatformBridge({
      ...createTestAdapter(),
      storageScope: "account"
    });
    expect(bridge.getStorageScope()).toBe("account");
  });

  it("uses localStorage when adapter storage is missing", async () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      }
    };
    const bridge = createPlatformBridge(createGenericAdapter());
    await bridge.storageSet("alpha", "omega");
    await expect(bridge.storageGet("alpha")).resolves.toBe("omega");
  });

  it("prefers adapter storage when available", async () => {
    const adapterStore = new Map<string, string>();
    const adapter: PlatformAdapter = {
      ...createTestAdapter(),
      storageGet: async (key: string) => adapterStore.get(key) ?? null,
      storageSet: async (key: string, value: string) => {
        adapterStore.set(key, value);
      }
    };
    const bridge = createPlatformBridge(adapter);
    await bridge.storageSet("k", "v");
    expect(adapterStore.get("k")).toBe("v");
  });
});

describe("player profile fallback", () => {
  it("returns unsupported profile when adapter auth is missing", async () => {
    const bridge = createPlatformBridge(createTestAdapter());

    await expect(bridge.getPlayerProfile()).resolves.toEqual({
      supported: false,
      provider: null,
      authorized: false,
      displayName: null,
      avatarUrl: null,
      playerId: null
    });
  });
});

describe("platform extras", () => {
  it("passes sticky banner visibility through the bridge", async () => {
    const bridge = createPlatformBridge({
      ...createTestAdapter("yandex"),
      setStickyBannerVisible: async (visible) => ({
        supported: true,
        visible
      })
    });

    await expect(bridge.setStickyBannerVisible(true)).resolves.toEqual({
      supported: true,
      visible: true
    });
  });

  it("returns unsupported review state when adapter does not expose review APIs", async () => {
    const bridge = createPlatformBridge(createTestAdapter());

    await expect(bridge.canReview()).resolves.toEqual({
      supported: false,
      available: false,
      reason: "unsupported"
    });
    await expect(bridge.requestReview()).resolves.toEqual({
      supported: false,
      completed: false,
      reason: "unsupported"
    });
  });

  it("reads server time through the bridge", async () => {
    const bridge = createPlatformBridge({
      ...createTestAdapter("yandex"),
      getServerTime: async () => 1_700_000_000_000
    });

    await expect(bridge.getServerTime()).resolves.toBe(1_700_000_000_000);
  });

  it("returns unsupported purchase state when adapter has no purchase APIs", async () => {
    const bridge = createPlatformBridge(createTestAdapter());

    await expect(bridge.getPurchaseCatalog()).resolves.toEqual({
      supported: false,
      products: [],
      reason: "unsupported"
    });
    await expect(bridge.getPurchases()).resolves.toEqual([]);
    await expect(bridge.purchaseProduct("starter_pack")).resolves.toEqual({
      supported: false,
      purchased: false,
      reason: "unsupported"
    });
    await expect(bridge.consumePurchase("pt_1")).resolves.toBe(false);
  });

  it("passes purchases through the bridge when adapter supports them", async () => {
    const bridge = createPlatformBridge({
      ...createTestAdapter("yandex"),
      getPurchaseCatalog: async () => ({
        supported: true,
        products: [
          {
            id: "starter_pack",
            title: "Starter Pack"
          }
        ]
      }),
      getPurchases: async () => [
        {
          productId: "starter_pack",
          purchaseToken: "pt_1"
        }
      ],
      purchaseProduct: async (productId) => ({
        supported: true,
        purchased: true,
        purchase: {
          productId,
          purchaseToken: "pt_buy"
        }
      }),
      consumePurchase: async () => true
    });

    await expect(bridge.getPurchaseCatalog()).resolves.toEqual({
      supported: true,
      products: [
        {
          id: "starter_pack",
          title: "Starter Pack"
        }
      ]
    });
    await expect(bridge.getPurchases()).resolves.toEqual([
      {
        productId: "starter_pack",
        purchaseToken: "pt_1"
      }
    ]);
    await expect(bridge.purchaseProduct("starter_pack")).resolves.toEqual({
      supported: true,
      purchased: true,
      purchase: {
        productId: "starter_pack",
        purchaseToken: "pt_buy"
      }
    });
    await expect(bridge.consumePurchase("pt_buy")).resolves.toBe(true);
  });
});

describe("analytics tracking", () => {
  it("tracks rewarded ad lifecycle events through the bridge", async () => {
    const tracked: Array<{ eventName: string; payload?: Record<string, unknown> }> = [];
    const adapter: PlatformAdapter = {
      ...createTestAdapter(),
      track: (eventName, payload) => {
        tracked.push({ eventName, payload });
      }
    };
    const bridge = createPlatformBridge(adapter);

    await bridge.showAd("rewarded", {
      pause: () => {},
      resume: () => {},
      grantReward: () => {}
    });

    expect(tracked.map((entry) => entry.eventName)).toEqual([
      "adRequested",
      "adStarted",
      "rewardedUsed",
      "adFinished"
    ]);
  });

  it("tracks rewarded denial when cooldown blocks the request", async () => {
    const tracked: Array<{ eventName: string; payload?: Record<string, unknown> }> = [];
    let now = 1_000;
    const adapter: PlatformAdapter = {
      ...createTestAdapter(),
      track: (eventName, payload) => {
        tracked.push({ eventName, payload });
      }
    };
    const bridge = createPlatformBridge(adapter, { clock: { now: () => now } });

    await bridge.showAd("rewarded", {
      pause: () => {},
      resume: () => {},
      grantReward: () => {}
    });
    now += REWARDED_COOLDOWN_MS - 1;

    const result = await bridge.showAd("rewarded", {
      pause: () => {},
      resume: () => {},
      grantReward: () => {}
    });

    expect(result).toEqual({ shown: false, reason: "rewarded_cooldown" });
    expect(tracked[tracked.length - 1]).toEqual({
      eventName: "rewardedDenied",
      payload: {
        platform: "generic",
        kind: "rewarded",
        reason: "rewarded_cooldown"
      }
    });
  });
});
