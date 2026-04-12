import { describe, expect, it } from "vitest";
import {
  createDailySeed,
  dailyBestKey,
  formatDateKey,
  getMsUntilNextDailyReset
} from "../src/core/daily";


describe("daily seed", () => {
  it("formats date key as YYYYMMDD", () => {
    const date = new Date("2025-12-31T00:00:00Z");
    expect(formatDateKey(date)).toBe("20251231");
  });

  it("includes salt in daily seed", () => {
    const date = new Date("2025-12-31T00:00:00Z");
    expect(createDailySeed(date)).toContain("20251231");
  });

  it("creates daily best key", () => {
    const date = new Date("2025-12-31T00:00:00Z");
    expect(dailyBestKey(date)).toBe("dailyBest_20251231");
  });

  it("computes time until the next local reset", () => {
    const date = new Date(2026, 3, 12, 23, 30, 0, 0);

    expect(getMsUntilNextDailyReset(date)).toBe(30 * 60 * 1000);
  });

  it("computes time until the next UTC reset", () => {
    const date = new Date(Date.UTC(2026, 3, 12, 23, 30, 0, 0));

    expect(getMsUntilNextDailyReset(date, { useUtc: true })).toBe(30 * 60 * 1000);
  });
});
