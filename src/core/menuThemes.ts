export interface MenuThemesCtaContext {
  tutorialCompleted: boolean;
  nextThemeMissingTokens: number | null;
  rewardEligible: boolean;
  rewardTokens: number;
}

export interface MenuThemesCtaState {
  highlight: boolean;
  reason: "none" | "ready" | "reward";
}

export const resolveMenuThemesCta = (
  context: MenuThemesCtaContext
): MenuThemesCtaState => {
  if (!context.tutorialCompleted || context.nextThemeMissingTokens === null) {
    return {
      highlight: false,
      reason: "none"
    };
  }

  if (context.nextThemeMissingTokens <= 0) {
    return {
      highlight: true,
      reason: "ready"
    };
  }

  if (context.rewardEligible && context.nextThemeMissingTokens <= context.rewardTokens) {
    return {
      highlight: true,
      reason: "reward"
    };
  }

  return {
    highlight: false,
    reason: "none"
  };
};
