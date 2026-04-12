import { describe, expect, it } from "vitest";
import {
  createDefaultPurchaseProfile,
  findStoreOfferByProductId,
  normalizeStoredPurchaseProfile,
  purchaseProfileDisablesAds
} from "../src/core/purchases";
import { resolveYandexPurchaseProductIds } from "../src/platform/env";

describe("purchase profile", () => {
  it("normalizes stored values and removes duplicates", () => {
    expect(
      normalizeStoredPurchaseProfile({
        ownedProductIds: ["no_ads", "no_ads", 1],
        grantedOfferIds: ["starter_pack", "starter_pack", "bad"],
        processedPurchaseTokens: ["pt_1", "pt_1", null]
      })
    ).toEqual({
      ownedProductIds: ["no_ads"],
      grantedOfferIds: ["starter_pack"],
      processedPurchaseTokens: ["pt_1"]
    });
  });

  it("detects ad disabling ownership", () => {
    const productIds = resolveYandexPurchaseProductIds();
    const profile = createDefaultPurchaseProfile();
    profile.ownedProductIds.push(productIds.no_ads);

    expect(purchaseProfileDisablesAds(profile, productIds)).toBe(true);
  });

  it("finds offers by configured product ids", () => {
    const productIds = resolveYandexPurchaseProductIds();

    expect(findStoreOfferByProductId(productIds.theme_bundle, productIds)?.id).toBe("theme_bundle");
  });
});
