export interface SpotlightThemeLike {
  id: string;
  price: number;
  unlockType?: "free" | "tokens" | "offer";
}

export const THEME_SPOTLIGHT_DISCOUNT_PERCENT = 20;

const getWeekHash = (weekKey: string): number =>
  weekKey.split("").reduce((sum, char) => sum + Number.parseInt(char, 10), 0);

export const getWeeklyThemeSpotlightId = (
  themes: SpotlightThemeLike[],
  weekKey: string
): string | null => {
  const spotlightThemes = themes.filter((theme) => {
    if (theme.unlockType === "free" || theme.unlockType === "offer") {
      return false;
    }
    return theme.unlockType === "tokens" || theme.price > 0;
  });
  if (spotlightThemes.length === 0) {
    return null;
  }

  const index = getWeekHash(weekKey) % spotlightThemes.length;
  return spotlightThemes[index]?.id ?? spotlightThemes[0]?.id ?? null;
};

export const getThemeSpotlightPrice = (
  theme: SpotlightThemeLike,
  spotlightThemeId: string | null
): number => {
  if (
    theme.id !== spotlightThemeId ||
    theme.unlockType === "free" ||
    theme.unlockType === "offer" ||
    theme.price <= 0
  ) {
    return theme.price;
  }

  const discounted = Math.round(theme.price * (100 - THEME_SPOTLIGHT_DISCOUNT_PERCENT) / 100);
  return Math.max(1, Math.min(theme.price, discounted));
};

export const getThemeSpotlightSavings = (
  theme: SpotlightThemeLike,
  spotlightThemeId: string | null
): number => Math.max(0, theme.price - getThemeSpotlightPrice(theme, spotlightThemeId));
