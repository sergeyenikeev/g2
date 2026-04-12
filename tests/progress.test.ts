import { describe, expect, it } from "vitest";
import { createDefaultProgress, normalizeStoredProgress } from "../src/app/progress";

describe("progress normalization", () => {
  it("creates touch-friendly defaults when requested", () => {
    const progress = createDefaultProgress({
      platformId: "generic",
      isTouch: true
    });

    expect(progress.settings.tapToPlace).toBe(true);
    expect(progress.settings.themeId).toBe("lume");
    expect(progress.settings.playerName).toBe("");
    expect(progress.settings.usePlatformPlayerName).toBe(false);
    expect(progress.themesUnlocked).toEqual(["lume"]);
    expect(progress.tutorialCompleted).toBe(false);
    expect(progress.loginReward).toEqual({
      cycleDay: 0,
      lastClaimDate: null
    });
    expect(progress.dailyStreak).toEqual({
      current: 0,
      best: 0,
      lastCompletedDate: null
    });
    expect(progress.weeklyLoop).toEqual({
      weekKey: null,
      completedDateKeys: [],
      claimedMilestoneDays: []
    });
    expect(progress.journey).toEqual({
      claimedMilestoneIds: []
    });
    expect(progress.dailyMissions).toEqual({
      dateKey: null,
      claimedMissionIds: [],
      stats: {
        completedRuns: 0,
        totalLinesCleared: 0,
        completedDaily: false
      }
    });
  });

  it("sanitizes corrupted numeric values", () => {
    const progress = normalizeStoredProgress(
      {
        bestScore: -10,
        tokens: Number.NaN,
        themesUnlocked: ["lume"],
        runsCount: "oops",
        settings: {}
      },
      { platformId: "generic", isTouch: false }
    );

    expect(progress.bestScore).toBe(0);
    expect(progress.tokens).toBe(0);
    expect(progress.runsCount).toBe(0);
    expect(progress.tutorialCompleted).toBe(false);
    expect(progress.loginReward).toEqual({
      cycleDay: 0,
      lastClaimDate: null
    });
    expect(progress.dailyStreak).toEqual({
      current: 0,
      best: 0,
      lastCompletedDate: null
    });
    expect(progress.weeklyLoop).toEqual({
      weekKey: null,
      completedDateKeys: [],
      claimedMilestoneDays: []
    });
    expect(progress.journey).toEqual({
      claimedMilestoneIds: []
    });
    expect(progress.dailyMissions).toEqual({
      dateKey: null,
      claimedMissionIds: [],
      stats: {
        completedRuns: 0,
        totalLinesCleared: 0,
        completedDaily: false
      }
    });
  });

  it("drops invalid themes and falls back to an unlocked theme", () => {
    const progress = normalizeStoredProgress(
      {
        bestScore: 50,
        tokens: 12,
        themesUnlocked: ["forest", "ghost", "forest"],
        runsCount: 4,
        settings: {
          themeId: "ghost"
        }
      },
      { platformId: "generic", isTouch: false }
    );

    expect(progress.themesUnlocked).toEqual(["lume", "forest"]);
    expect(progress.settings.themeId).toBe("lume");
  });

  it("migrates legacy audio flag into music and sfx settings", () => {
    const progress = normalizeStoredProgress(
      {
        bestScore: 10,
        tokens: 1,
        themesUnlocked: ["lume"],
        runsCount: 2,
        settings: {
          audio: false
        }
      },
      { platformId: "generic", isTouch: true }
    );

    expect(progress.settings.musicEnabled).toBe(false);
    expect(progress.settings.sfxEnabled).toBe(false);
    expect(progress.settings.tapToPlace).toBe(true);
  });

  it("sanitizes stored player names", () => {
    const progress = normalizeStoredProgress(
      {
        bestScore: 0,
        tokens: 0,
        themesUnlocked: ["lume"],
        runsCount: 0,
        settings: {
          playerName: "   Nova    Runner Beyond Limit   "
        }
      },
      { platformId: "generic", isTouch: false }
    );

    expect(progress.settings.playerName).toBe("Nova Runner Beyond");
  });

  it("uses platform language for yandex even when storage contains another value", () => {
    const progress = normalizeStoredProgress(
      {
        bestScore: 10,
        tokens: 1,
        themesUnlocked: ["lume"],
        runsCount: 2,
        settings: {
          language: "en"
        }
      },
      {
        platformId: "yandex",
        platformLanguage: "ru",
        isTouch: false
      }
    );

    expect(progress.settings.language).toBe("ru");
  });

  it("keeps explicit preference for platform player name", () => {
    const progress = normalizeStoredProgress(
      {
        bestScore: 0,
        tokens: 0,
        themesUnlocked: ["lume"],
        runsCount: 0,
        settings: {
          usePlatformPlayerName: true
        }
      },
      { platformId: "yandex", isTouch: false }
    );

    expect(progress.settings.usePlatformPlayerName).toBe(true);
  });

  it("keeps tutorial completion only when stored as a valid boolean", () => {
    const completed = normalizeStoredProgress(
      {
        bestScore: 0,
        tokens: 0,
        themesUnlocked: ["lume"],
        runsCount: 0,
        tutorialCompleted: true,
        settings: {}
      },
      { platformId: "generic", isTouch: false }
    );
    const corrupted = normalizeStoredProgress(
      {
        bestScore: 0,
        tokens: 0,
        themesUnlocked: ["lume"],
        runsCount: 0,
        tutorialCompleted: "yes",
        settings: {}
      },
      { platformId: "generic", isTouch: false }
    );

    expect(completed.tutorialCompleted).toBe(true);
    expect(corrupted.tutorialCompleted).toBe(false);
  });

  it("sanitizes malformed login reward state", () => {
    const progress = normalizeStoredProgress(
      {
        bestScore: 0,
        tokens: 0,
        themesUnlocked: ["lume"],
        runsCount: 0,
        loginReward: {
          cycleDay: 99,
          lastClaimDate: "today"
        },
        dailyStreak: {
          current: 2,
          best: 1,
          lastCompletedDate: "20260411"
        },
        weeklyLoop: {
          weekKey: "20260406",
          completedDateKeys: ["20260408", "oops"],
          claimedMilestoneDays: [3, 99]
        },
        journey: {
          claimedMilestoneIds: ["first_run", "ghost_goal"]
        },
        dailyMissions: {
          dateKey: "20260411",
          claimedMissionIds: ["finish_run", "ghost_mission"],
          stats: {
            completedRuns: 2,
            totalLinesCleared: 8,
            completedDaily: false
          }
        },
        settings: {}
      },
      { platformId: "generic", isTouch: false }
    );

    expect(progress.loginReward).toEqual({
      cycleDay: 5,
      lastClaimDate: null
    });
    expect(progress.dailyStreak).toEqual({
      current: 2,
      best: 2,
      lastCompletedDate: "20260411"
    });
    expect(progress.weeklyLoop).toEqual({
      weekKey: null,
      completedDateKeys: [],
      claimedMilestoneDays: []
    });
    expect(progress.journey).toEqual({
      claimedMilestoneIds: ["first_run"]
    });
    expect(progress.dailyMissions).toEqual({
      dateKey: null,
      claimedMissionIds: [],
      stats: {
        completedRuns: 0,
        totalLinesCleared: 0,
        completedDaily: false
      }
    });
  });

  it("keeps daily mission state only for the active date key", () => {
    const progress = normalizeStoredProgress(
      {
        bestScore: 0,
        tokens: 0,
        themesUnlocked: ["lume"],
        runsCount: 0,
        dailyMissions: {
          dateKey: "20260412",
          claimedMissionIds: ["finish_run"],
          stats: {
            completedRuns: 1,
            totalLinesCleared: 5,
            completedDaily: false
          }
        },
        settings: {}
      },
      { platformId: "generic", isTouch: false, currentDateKey: "20260412" }
    );

    expect(progress.weeklyLoop).toEqual({
      weekKey: "20260406",
      completedDateKeys: [],
      claimedMilestoneDays: []
    });
    expect(progress.dailyMissions).toEqual({
      dateKey: "20260412",
      claimedMissionIds: ["finish_run"],
      stats: {
        completedRuns: 1,
        totalLinesCleared: 5,
        completedDaily: false
      }
    });
  });
});
