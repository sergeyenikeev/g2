import { describe, expect, it } from "vitest";
import { LeaderboardService } from "../src/app/LeaderboardService";
import { createPlatformBridge, type PlatformAdapter } from "../src/platform/bridge";
import { StorageService } from "../src/services/storage";

const createStorage = () => {
  const data = new Map<string, string>();
  return new StorageService({
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    }
  });
};

const createAdapter = (overrides: Partial<PlatformAdapter> = {}): PlatformAdapter => ({
  id: "generic",
  init: async () => {},
  loadingStart: () => {},
  loadingStop: () => {},
  gameplayStart: () => {},
  gameplayStop: () => {},
  showAd: async () => ({ shown: false, reason: "unsupported" }),
  track: () => {},
  ...overrides
});

describe("LeaderboardService", () => {
  it("loads local leaderboard state and exposes storage scope per board", async () => {
    const storage = createStorage();
    await storage.set("leaderboard", {
      allTime: [
        {
          id: "a",
          playerName: "Nova",
          score: 500,
          mode: "play",
          level: 3,
          lines: 8,
          moves: 9,
          durationMs: 1000,
          seed: "seed-a",
          createdAt: 1,
          dateKey: "20260406"
        }
      ],
      daily: []
    });
    const service = new LeaderboardService(
      storage,
      createPlatformBridge(createAdapter({ storageScope: "account" }))
    );

    const result = await service.load("20260406");

    expect(result.meta.overall.scope).toBe("account");
    expect(result.meta.daily.source).toBe("local");
    expect(result.state.allTime[0]?.playerName).toBe("Nova");
  });

  it("prefers platform entries per board and keeps local fallback for the rest", async () => {
    const storage = createStorage();
    await storage.set("leaderboard", {
      allTime: [],
      daily: [
        {
          id: "daily-local",
          playerName: "Glow",
          score: 120,
          mode: "daily",
          level: 2,
          lines: 4,
          moves: 6,
          durationMs: 900,
          seed: "seed-d",
          createdAt: 2,
          dateKey: "20260406"
        }
      ]
    });
    const service = new LeaderboardService(
      storage,
      createPlatformBridge(
        createAdapter({
          storageScope: "device",
          getLeaderboardInfo: async (board) => ({
            board,
            enabled: board === "overall",
            provider: board === "overall" ? "yandex" : null,
            submissionState: board === "overall" ? "enabled" : "unavailable"
          }),
          getLeaderboardSnapshot: async (board) =>
            board === "overall"
              ? {
                  board,
                  entries: [
                    {
                      rank: 1,
                      score: 999,
                      playerName: "Portal Hero",
                      playerId: "ya-1",
                      extraData:
                        '{"playerName":"Nova","mode":"daily","level":7,"lines":21,"moves":30,"durationMs":45000,"seed":"portal","createdAt":5,"dateKey":"20260406"}'
                    }
                  ]
                }
              : null
        })
      )
    );

    const result = await service.load("20260406");

    expect(result.meta.overall.source).toBe("platform");
    expect(result.meta.daily.source).toBe("local");
    expect(result.state.allTime[0]).toMatchObject({
      playerName: "Nova",
      mode: "daily",
      level: 7,
      score: 999
    });
    expect(result.state.daily[0]?.id).toBe("daily-local");
  });

  it("clears local storage without wiping platform-backed boards", async () => {
    const storage = createStorage();
    const service = new LeaderboardService(
      storage,
      createPlatformBridge(
        createAdapter({
          getLeaderboardInfo: async (board) => ({
            board,
            enabled: board === "overall",
            provider: board === "overall" ? "yandex" : null,
            submissionState: board === "overall" ? "enabled" : "unavailable"
          }),
          getLeaderboardSnapshot: async (board) =>
            board === "overall"
              ? {
                  board,
                  entries: [
                    {
                      rank: 1,
                      score: 700,
                      playerName: "Portal Hero"
                    }
                  ]
                }
              : null
        })
      )
    );

    await service.save({
      allTime: [
        {
          id: "local-all",
          playerName: "",
          score: 100,
          mode: "play",
          level: 1,
          lines: 1,
          moves: 1,
          durationMs: 1,
          seed: "seed",
          createdAt: 1,
          dateKey: "20260406"
        }
      ],
      daily: [
        {
          id: "local-daily",
          playerName: "",
          score: 90,
          mode: "daily",
          level: 1,
          lines: 1,
          moves: 1,
          durationMs: 1,
          seed: "seed",
          createdAt: 1,
          dateKey: "20260406"
        }
      ]
    });

    const cleared = await service.clear("20260406");

    expect(cleared.meta.overall.source).toBe("platform");
    expect(cleared.state.allTime[0]?.score).toBe(700);
    expect(cleared.state.daily).toEqual([]);
  });

  it("submits daily runs into overall and daily platform boards", async () => {
    const storage = createStorage();
    const submissions: Array<{ board: string; score: number; extraData?: string }> = [];
    const service = new LeaderboardService(
      storage,
      createPlatformBridge(
        createAdapter({
          getLeaderboardInfo: async (board) => ({
            board,
            enabled: true,
            provider: "yandex",
            submissionState: "enabled"
          }),
          submitLeaderboardScore: async (payload) => {
            submissions.push(payload);
            return { submitted: true };
          }
        })
      ),
      { platformSubmitDelayMs: 0 }
    );

    await service.submit({
      id: "run-1",
      playerName: "Nova",
      score: 1200,
      mode: "daily",
      level: 6,
      lines: 18,
      moves: 25,
      durationMs: 42000,
      seed: "daily-seed",
      createdAt: 5,
      dateKey: "20260406"
    });

    expect(submissions.map((entry) => entry.board)).toEqual(["overall", "daily"]);
    expect(JSON.parse(submissions[0]?.extraData ?? "{}")).toMatchObject({
      playerName: "Nova",
      level: 6,
      dateKey: "20260406"
    });
  });
});
