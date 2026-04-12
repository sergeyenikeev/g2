import { describe, expect, it } from "vitest";
import { selectResultsOffer, type ResultsOfferContext } from "../src/core/resultsOffers";
import { parseRemoteConfig, buildDefaultRemoteFlags } from "../src/core/remoteConfig";
import { DEFAULT_MONETIZATION_CONFIG } from "../src/core/monetization";

const defaultStoreExperiment = parseRemoteConfig(
  buildDefaultRemoteFlags(DEFAULT_MONETIZATION_CONFIG),
  DEFAULT_MONETIZATION_CONFIG
).store;

const createContext = (
  overrides: Partial<ResultsOfferContext> = {}
): ResultsOfferContext => ({
  platformId: "yandex",
  mode: "play",
  storeLoading: false,
  storeSupported: true,
  enabledOfferIds: ["no_ads", "starter_pack", "theme_bundle", "token_pack_small", "token_pack_medium"],
  availableOfferIds: ["no_ads", "starter_pack", "theme_bundle"],
  ownedOfferIds: [],
  hasAdsDisabled: false,
  runsCount: 2,
  themesUnlockedCount: 1,
  runNewBest: true,
  runFirstDaily: false,
  runDailyImproved: false,
  runLeaderboardRank: null,
  runDailyLeaderboardRank: null,
  score: 900,
  storeExperiment: defaultStoreExperiment,
  ...overrides
});

describe("results offer selection", () => {
  it("prefers starter pack for early milestone runs", () => {
    expect(selectResultsOffer(createContext())).toEqual({
      offerId: "starter_pack",
      reason: "best"
    });
  });

  it("switches to no ads after the starter window ends", () => {
    expect(
      selectResultsOffer(
        createContext({
          runsCount: defaultStoreExperiment.starterPackResultsMaxRuns + 1
        })
      )
    ).toEqual({
      offerId: "no_ads",
      reason: "focus"
    });
  });

  it("surfaces the theme bundle for engaged collectors", () => {
    expect(
      selectResultsOffer(
        createContext({
          runsCount: 6,
          themesUnlockedCount: 3,
          ownedOfferIds: ["no_ads"],
          hasAdsDisabled: true
        })
      )
    ).toEqual({
      offerId: "theme_bundle",
      reason: "collection"
    });
  });

  it("returns null when there is no milestone moment", () => {
    expect(
      selectResultsOffer(
        createContext({
          runNewBest: false,
          runFirstDaily: false,
          runDailyImproved: false,
          runLeaderboardRank: null,
          runDailyLeaderboardRank: null
        })
      )
    ).toBeNull();
  });
});
