import type { StoreOfferId } from "./purchases";
import type { StoreExperimentConfig } from "./remoteConfig";

export type ResultsOfferReason = "starter" | "best" | "daily" | "focus" | "collection";

export interface ResultsOfferContext {
  platformId: string;
  mode: "play" | "daily" | "tutorial";
  storeLoading: boolean;
  storeSupported: boolean;
  enabledOfferIds: StoreOfferId[];
  availableOfferIds: StoreOfferId[];
  ownedOfferIds: StoreOfferId[];
  hasAdsDisabled: boolean;
  runsCount: number;
  themesUnlockedCount: number;
  runNewBest: boolean;
  runFirstDaily: boolean;
  runDailyImproved: boolean;
  runLeaderboardRank: number | null;
  runDailyLeaderboardRank: number | null;
  score: number;
  storeExperiment: StoreExperimentConfig;
}

export interface ResultsOfferSelection {
  offerId: StoreOfferId;
  reason: ResultsOfferReason;
}

const hasMilestoneMoment = (context: ResultsOfferContext): boolean =>
  context.runNewBest ||
  context.runFirstDaily ||
  context.runDailyImproved ||
  context.runLeaderboardRank !== null ||
  context.runDailyLeaderboardRank !== null;

const isOfferEligible = (context: ResultsOfferContext, offerId: StoreOfferId): boolean =>
  context.enabledOfferIds.includes(offerId) &&
  context.availableOfferIds.includes(offerId) &&
  !context.ownedOfferIds.includes(offerId);

export const selectResultsOffer = (
  context: ResultsOfferContext
): ResultsOfferSelection | null => {
  if (
    context.mode === "tutorial" ||
    context.platformId !== "yandex" ||
    !context.storeExperiment.storeEnabled ||
    context.storeLoading ||
    !context.storeSupported ||
    !hasMilestoneMoment(context)
  ) {
    return null;
  }

  const starterPackEligible =
    context.storeExperiment.starterPackResultsEnabled &&
    !context.hasAdsDisabled &&
    isOfferEligible(context, "starter_pack") &&
    context.score >= context.storeExperiment.starterPackResultsMinScore &&
    context.runsCount <= context.storeExperiment.starterPackResultsMaxRuns;

  if (starterPackEligible) {
    return {
      offerId: "starter_pack",
      reason:
        context.runFirstDaily || context.runDailyImproved
          ? "daily"
          : context.runNewBest
            ? "best"
            : "starter"
    };
  }

  const themeBundleEligible =
    isOfferEligible(context, "theme_bundle") &&
    context.themesUnlockedCount >= 3 &&
    (context.hasAdsDisabled || context.runsCount >= 4);

  if (themeBundleEligible) {
    return {
      offerId: "theme_bundle",
      reason: "collection"
    };
  }

  const noAdsEligible =
    isOfferEligible(context, "no_ads") &&
    !context.hasAdsDisabled &&
    context.runsCount >= 4 &&
    context.score >= context.storeExperiment.starterPackResultsMinScore;

  if (noAdsEligible) {
    return {
      offerId: "no_ads",
      reason: "focus"
    };
  }

  return null;
};
