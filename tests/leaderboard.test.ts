import { describe, expect, it } from "vitest";
import {
  createEmptyLeaderboard,
  normalizeStoredLeaderboard,
  recordLeaderboardEntry
} from "../src/app/leaderboard";

describe("leaderboard normalization", () => {
  it("drops corrupted entries and keeps sorted top records", () => {
    const leaderboard = normalizeStoredLeaderboard(
      {
        allTime: [
          {
            id: "good-play",
            playerName: "Nova",
            score: 1500,
            mode: "play",
            level: 6,
            lines: 18,
            moves: 22,
            durationMs: 90000,
            seed: "seed-a",
            createdAt: 1,
            dateKey: "20260406"
          },
          {
            id: "broken",
            score: "oops",
            mode: "play"
          },
          {
            id: "good-daily",
            playerName: "Nova",
            score: 2100,
            mode: "daily",
            level: 7,
            lines: 23,
            moves: 28,
            durationMs: 100000,
            seed: "seed-b",
            createdAt: 2,
            dateKey: "20260406"
          }
        ],
        daily: [
          {
            id: "good-daily",
            playerName: "Nova",
            score: 2100,
            mode: "daily",
            level: 7,
            lines: 23,
            moves: 28,
            durationMs: 100000,
            seed: "seed-b",
            createdAt: 2,
            dateKey: "20260406"
          },
          {
            id: "bad-mode",
            score: 500,
            mode: "tutorial"
          }
        ]
      },
      "20260406"
    );

    expect(leaderboard.allTime.map((entry) => entry.id)).toEqual(["good-daily", "good-play"]);
    expect(leaderboard.daily.map((entry) => entry.id)).toEqual(["good-daily"]);
  });
});

describe("leaderboard recording", () => {
  it("returns ranks for new high scores and updates both boards", () => {
    const result = recordLeaderboardEntry(createEmptyLeaderboard(), {
      id: "daily-top",
      playerName: "Nova",
      score: 3200,
      mode: "daily",
      level: 9,
      lines: 31,
      moves: 35,
      durationMs: 120000,
      seed: "seed",
      createdAt: 100,
      dateKey: "20260406"
    });

    expect(result.overallRank).toBe(1);
    expect(result.dailyRank).toBe(1);
    expect(result.state.allTime).toHaveLength(1);
    expect(result.state.daily).toHaveLength(1);
  });

  it("keeps only top ten overall entries and can reject low ranks", () => {
    let state = createEmptyLeaderboard();

    for (let index = 0; index < 10; index += 1) {
      state = recordLeaderboardEntry(state, {
        id: `entry-${index}`,
        playerName: `Runner ${index}`,
        score: 5000 - index * 100,
        mode: "play",
        level: 10 - index,
        lines: 40 - index,
        moves: 50 - index,
        durationMs: 100000 + index,
        seed: `seed-${index}`,
        createdAt: index,
        dateKey: "20260406"
      }).state;
    }

    const result = recordLeaderboardEntry(state, {
      id: "too-low",
      playerName: "Late",
      score: 100,
      mode: "play",
      level: 1,
      lines: 2,
      moves: 3,
      durationMs: 50000,
      seed: "seed-low",
      createdAt: 999,
      dateKey: "20260406"
    });

    expect(result.overallRank).toBeNull();
    expect(result.state.allTime).toHaveLength(10);
    expect(result.state.allTime.some((entry) => entry.id === "too-low")).toBe(false);
  });
});
