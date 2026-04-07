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
        settings: {}
      },
      { platformId: "generic", isTouch: false }
    );

    expect(progress.loginReward).toEqual({
      cycleDay: 5,
      lastClaimDate: null
    });
  });
});
