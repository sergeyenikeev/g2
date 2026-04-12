export type StoreOfferId =
  | "no_ads"
  | "starter_pack"
  | "theme_bundle"
  | "token_pack_small"
  | "token_pack_medium";

export interface PurchaseProfile {
  ownedProductIds: string[];
  grantedOfferIds: StoreOfferId[];
  processedPurchaseTokens: string[];
}

export interface StoreOfferDefinition {
  id: StoreOfferId;
  defaultProductId: string;
  kind: "permanent" | "consumable";
  titleKey: string;
  descriptionKey: string;
  tokenGrant: number;
  unlockThemes: string[];
  disablesAds: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sanitizeStringArray = (value: unknown): string[] => {
  const source = Array.isArray(value) ? value : [];
  const cleaned = source.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  return Array.from(new Set(cleaned.map((entry) => entry.trim())));
};

const sanitizeOfferIds = (value: unknown): StoreOfferId[] => {
  const validIds = new Set<StoreOfferId>(STORE_OFFERS.map((offer) => offer.id));
  return sanitizeStringArray(value).filter((entry): entry is StoreOfferId =>
    validIds.has(entry as StoreOfferId)
  );
};

export const STORE_OFFERS: StoreOfferDefinition[] = [
  {
    id: "no_ads",
    defaultProductId: "no_ads",
    kind: "permanent",
    titleKey: "store.offer.no_ads.title",
    descriptionKey: "store.offer.no_ads.description",
    tokenGrant: 0,
    unlockThemes: [],
    disablesAds: true
  },
  {
    id: "starter_pack",
    defaultProductId: "starter_pack",
    kind: "permanent",
    titleKey: "store.offer.starter_pack.title",
    descriptionKey: "store.offer.starter_pack.description",
    tokenGrant: 120,
    unlockThemes: ["sunset"],
    disablesAds: true
  },
  {
    id: "theme_bundle",
    defaultProductId: "theme_bundle",
    kind: "permanent",
    titleKey: "store.offer.theme_bundle.title",
    descriptionKey: "store.offer.theme_bundle.description",
    tokenGrant: 0,
    unlockThemes: ["ember", "aqua", "forest", "aurora"],
    disablesAds: false
  },
  {
    id: "token_pack_small",
    defaultProductId: "token_pack_small",
    kind: "consumable",
    titleKey: "store.offer.token_pack_small.title",
    descriptionKey: "store.offer.token_pack_small.description",
    tokenGrant: 25,
    unlockThemes: [],
    disablesAds: false
  },
  {
    id: "token_pack_medium",
    defaultProductId: "token_pack_medium",
    kind: "consumable",
    titleKey: "store.offer.token_pack_medium.title",
    descriptionKey: "store.offer.token_pack_medium.description",
    tokenGrant: 80,
    unlockThemes: [],
    disablesAds: false
  }
];

export const createDefaultPurchaseProfile = (): PurchaseProfile => ({
  ownedProductIds: [],
  grantedOfferIds: [],
  processedPurchaseTokens: []
});

export const normalizeStoredPurchaseProfile = (value: unknown): PurchaseProfile => {
  const raw = isRecord(value) ? value : {};
  return {
    ownedProductIds: sanitizeStringArray(raw.ownedProductIds),
    grantedOfferIds: sanitizeOfferIds(raw.grantedOfferIds),
    processedPurchaseTokens: sanitizeStringArray(raw.processedPurchaseTokens)
  };
};

export const getStoreOffer = (offerId: StoreOfferId): StoreOfferDefinition | undefined =>
  STORE_OFFERS.find((offer) => offer.id === offerId);

export const findStoreOfferByProductId = (
  productId: string,
  productIds: Record<StoreOfferId, string>
): StoreOfferDefinition | undefined =>
  STORE_OFFERS.find((offer) => productIds[offer.id] === productId);

export const hasOfferProductOwnership = (
  profile: PurchaseProfile,
  offerId: StoreOfferId,
  productIds: Record<StoreOfferId, string>
): boolean => profile.ownedProductIds.includes(productIds[offerId]);

export const purchaseProfileDisablesAds = (
  profile: PurchaseProfile,
  productIds: Record<StoreOfferId, string>
): boolean =>
  STORE_OFFERS.some((offer) => offer.disablesAds && hasOfferProductOwnership(profile, offer.id, productIds));
