import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { t } from "../src/app/i18n";

type YandexMetadata = {
  supported_platforms: string[];
  orientation: string;
  language_control_via_sdk: boolean;
  languages: string[];
  cloud_saves: boolean;
  delayed_publication: boolean;
  categories: string[];
  recommended_tags: string[];
  keywords: string[];
  short_description_ru: string;
  short_description_en: string;
  description_ru: string;
  description_en: string;
  seo_description_ru: string;
  seo_description_en: string;
  about_ru: string;
  about_en: string;
  how_to_play_ru: string;
  how_to_play_en: string;
  developer_comment: string;
  age_rating: string;
};

type PromoMetadata = {
  title: string;
  yandex: YandexMetadata;
  tags: string[];
};

const currentDir = dirname(fileURLToPath(import.meta.url));
const metadata = JSON.parse(
  readFileSync(resolve(currentDir, "../promo/metadata.json"), "utf-8").replace(/^\uFEFF/, "")
) as PromoMetadata;

describe("yandex submission metadata", () => {
  it("contains the expected moderation-facing fields", () => {
    expect(metadata.yandex.supported_platforms).toEqual(["desktop", "mobile"]);
    expect(metadata.yandex.orientation).toBe("any");
    expect(metadata.yandex.language_control_via_sdk).toBe(true);
    expect(metadata.yandex.languages).toEqual(["ru", "en"]);
    expect(metadata.yandex.cloud_saves).toBe(true);
    expect(metadata.yandex.age_rating).toBe("6+");
    expect(metadata.yandex.categories).toEqual(["Головоломки", "Казуальные"]);
    expect(metadata.yandex.keywords).toEqual(metadata.tags);
    expect(metadata.yandex.recommended_tags.length).toBeGreaterThanOrEqual(10);
  });

  it("fits the known Yandex text limits", () => {
    expect(metadata.title.length).toBeLessThanOrEqual(50);
    expect(metadata.yandex.seo_description_ru.length).toBeLessThanOrEqual(160);
    expect(metadata.yandex.seo_description_en.length).toBeLessThanOrEqual(160);
    expect(metadata.yandex.about_ru.length).toBeLessThanOrEqual(1000);
    expect(metadata.yandex.about_en.length).toBeLessThanOrEqual(1000);
    expect(metadata.yandex.how_to_play_ru.length).toBeLessThanOrEqual(1000);
    expect(metadata.yandex.how_to_play_en.length).toBeLessThanOrEqual(1000);
    expect(metadata.yandex.developer_comment.length).toBeLessThanOrEqual(2048);
  });

  it("keeps Russian moderation copy localized and explicit about rewards", () => {
    expect(metadata.yandex.description_ru).not.toMatch(/\bdaily\b/i);
    expect(metadata.yandex.about_ru).not.toMatch(/\bdaily\b/i);
    expect(metadata.yandex.how_to_play_ru).not.toMatch(
      /Tap to place|Continue|Double Tokens|rewarded/i
    );
    expect(metadata.yandex.how_to_play_ru).toContain("3 новыми фигурами");
    expect(metadata.yandex.how_to_play_ru).toContain("удвоить токены");
    expect(metadata.yandex.how_to_play_ru).toContain("+2 токена");
  });
});

describe("yandex in-game reward copy", () => {
  it("keeps reward buttons obvious in Russian", () => {
    expect(t("ru", "menu.rewarded")).toContain("+2");
    expect(t("ru", "results.continue")).toContain("3");
    expect(t("ru", "results.double").toLowerCase()).toContain("токен");
    expect(t("ru", "hint.continue_reward")).toContain("3");
    expect(t("ru", "hint.double_reward").toLowerCase()).toContain("в 2 раза");
  });
});
