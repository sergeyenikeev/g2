import { describe, expect, it, afterEach } from "vitest";
import {
  createPlatformBridge,
  PlatformAdapter,
  PlatformId
} from "../src/platform/bridge";
import { createPlatform } from "../src/platform/factory";
import { createGenericAdapter } from "../src/platform/generic/adapter";
import { createPokiAdapter } from "../src/platform/poki/adapter";
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
    process.env.VITE_PLATFORM = "poki";
    process.env.VITE_USE_PLATFORM_MOCK = "1";
    const platform = createPlatform();
    expect(platform.id).toBe("poki");
  });

  it("normalizes unknown platform to generic", () => {
    process.env.VITE_PLATFORM = "unknown";
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
    const bridge = createPlatformBridge(createPokiAdapter());
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
