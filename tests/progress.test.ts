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
    expect(progress.themesUnlocked).toEqual(["lume"]);
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
});
