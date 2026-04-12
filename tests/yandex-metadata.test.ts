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
const indexHtml = readFileSync(resolve(currentDir, "../index.html"), "utf-8").replace(/^\uFEFF/, "");
const stylesCss = readFileSync(resolve(currentDir, "../src/styles.css"), "utf-8").replace(/^\uFEFF/, "");
const audioManagerTs = readFileSync(resolve(currentDir, "../src/app/AudioManager.ts"), "utf-8").replace(
  /^\uFEFF/,
  ""
);

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
      /Tap to place|Continue|Double Tokens|rewarded|Watch ad/i
    );
    expect(metadata.yandex.how_to_play_ru).toContain("3 новыми фигурами");
    expect(metadata.yandex.how_to_play_ru).toContain("удвоить токены");
    expect(metadata.yandex.how_to_play_ru).toContain("+3 токена");
    expect(metadata.yandex.how_to_play_ru.toLowerCase()).toContain("реклам");
  });
});

describe("yandex sdk loader", () => {
  it("loads the sdk from the documented archive path", () => {
    expect(indexHtml).toContain('script.src = "/sdk.js"');
    expect(indexHtml).not.toContain("https://yandex.ru/games/sdk/v2");
  });

  it("localizes the initial shell before the main app finishes booting", () => {
    expect(indexHtml).toContain('"loading.status": "Загрузка..."');
    expect(indexHtml).toContain('data-i18n-aria-label="game.board_aria"');
  });
});

describe("yandex layout and media compliance", () => {
  it("prevents browser scrolling and swipe refresh in the game shell", () => {
    expect(stylesCss).toContain("overflow: hidden;");
    expect(stylesCss).toContain("overscroll-behavior: none;");
    expect(stylesCss).toContain("height: 100dvh;");
  });

  it("keeps editable controls selectable while the shell blocks long-tap browser ui", () => {
    expect(stylesCss).toContain("#app input,");
    expect(stylesCss).toContain("-webkit-user-select: text;");
  });

  it("avoids HTML audio elements that can trigger the browser media player", () => {
    expect(audioManagerTs).not.toContain("new Audio(");
    expect(audioManagerTs).not.toContain("HTMLAudioElement");
  });
});

describe("yandex in-game reward copy", () => {
  it("keeps reward buttons obvious in Russian", () => {
    expect(t("ru", "menu.rewarded", { count: 3 })).toContain("+3");
    expect(t("ru", "menu.rewarded", { count: 3 }).toLowerCase()).toContain("реклам");
    expect(t("ru", "results.continue")).toContain("3");
    expect(t("ru", "results.continue").toLowerCase()).toContain("реклам");
    expect(t("ru", "results.double").toLowerCase()).toContain("реклам");
    expect(t("ru", "hint.continue_reward").toLowerCase()).toContain("реклам");
    expect(t("ru", "hint.double_reward").toLowerCase()).toContain("реклам");
  });

  it("explains why Yandex authorization is needed", () => {
    expect(t("ru", "results.auth").toLowerCase()).toContain("яндекс");
    expect(t("ru", "leaderboard.auth").toLowerCase()).toContain("яндекс");
    expect(t("ru", "settings.account.sign_in").toLowerCase()).toContain("синхрон");
    expect(t("ru", "settings.account.guest_hint").toLowerCase()).toContain("сохран");
  });

  it("removes leftover technical english from russian ui copy", () => {
    expect(t("ru", "leaderboard.hint").toLowerCase()).not.toContain("storage");
    expect(t("ru", "store.hint.ready").toLowerCase()).not.toContain("rewarded");
    expect(t("ru", "store.offer.no_ads.title").toLowerCase()).not.toContain("no ads");
    expect(t("ru", "leaderboard.daily").toLowerCase()).not.toContain("daily");
    expect(t("ru", "game.board_aria").toLowerCase()).toContain("пол");
  });
});
