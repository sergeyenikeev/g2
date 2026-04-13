import { describe, expect, it } from "vitest";
import {
  getThemeSpotlightPrice,
  getThemeSpotlightSavings,
  getWeeklyThemeSpotlightId
} from "../src/core/themeSpotlight";

const THEMES = [
  { id: "lume", price: 20, unlockType: "free" as const },
  { id: "copper", price: 12, unlockType: "tokens" as const },
  { id: "frost", price: 18, unlockType: "tokens" as const },
  { id: "ember", price: 35 },
  { id: "sunset", price: 0, unlockType: "offer" as const }
];

describe("theme spotlight", () => {
  it("rotates only across token themes", () => {
    expect(["copper", "frost", "ember"]).toContain(getWeeklyThemeSpotlightId(THEMES, "20260406"));
    expect(["copper", "frost", "ember"]).toContain(getWeeklyThemeSpotlightId(THEMES, "20260413"));
  });

  it("discounts only the spotlight token theme", () => {
    expect(getThemeSpotlightPrice(THEMES[1], "copper")).toBe(10);
    expect(getThemeSpotlightPrice(THEMES[2], "copper")).toBe(18);
    expect(getThemeSpotlightPrice(THEMES[0], "copper")).toBe(20);
  });

  it("treats positive-priced non-offer themes as spotlight-eligible by default", () => {
    expect(getWeeklyThemeSpotlightId([THEMES[0], THEMES[3], THEMES[4]], "20260406")).toBe("ember");
    expect(getThemeSpotlightPrice(THEMES[3], "ember")).toBe(28);
  });

  it("reports spotlight savings", () => {
    expect(getThemeSpotlightSavings(THEMES[1], "copper")).toBe(2);
    expect(getThemeSpotlightSavings(THEMES[2], "copper")).toBe(0);
  });
});
