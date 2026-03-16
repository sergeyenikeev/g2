import type { PlatformId } from "../platform/bridge";
import { getDefaultLanguage, Language, normalizeLanguage } from "./i18n";
import { THEMES } from "./ThemeManager";

export interface SettingsState {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  tapToPlace: boolean;
  themeId: string;
  language: Language;
}

export interface ProgressState {
  bestScore: number;
  tokens: number;
  themesUnlocked: string[];
  runsCount: number;
  settings: SettingsState;
}

export interface StoredProgressSnapshot {
  bestScore: unknown;
  tokens: unknown;
  themesUnlocked: unknown;
  runsCount: unknown;
  settings: unknown;
}

interface ProgressDefaultsOptions {
  platformId: PlatformId;
  platformLanguage?: string | null;
  hostname?: string;
  isTouch?: boolean;
}

const DEFAULT_THEME_ID = THEMES[0]?.id ?? "lume";
const VALID_THEME_IDS = new Set(THEMES.map((theme) => theme.id));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const coerceNonNegativeInt = (value: unknown, fallback: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return Math.floor(value);
};

const normalizeThemesUnlocked = (value: unknown): string[] => {
  const unlocked = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && VALID_THEME_IDS.has(item))
    : [];
  return Array.from(new Set([DEFAULT_THEME_ID, ...unlocked]));
};

const normalizeThemeId = (value: unknown, themesUnlocked: string[]): string => {
  if (
    typeof value === "string" &&
    VALID_THEME_IDS.has(value) &&
    themesUnlocked.includes(value)
  ) {
    return value;
  }
  return themesUnlocked.includes(DEFAULT_THEME_ID) ? DEFAULT_THEME_ID : themesUnlocked[0] ?? DEFAULT_THEME_ID;
};

const resolveLanguage = (
  storedLanguageValue: unknown,
  options: ProgressDefaultsOptions,
  fallback: Language
): Language => {
  const platformLanguage = normalizeLanguage(options.platformLanguage ?? null);
  const storedLanguage =
    typeof storedLanguageValue === "string" ? normalizeLanguage(storedLanguageValue) : null;

  if (options.platformId === "yandex") {
    return platformLanguage ?? fallback;
  }

  return storedLanguage ?? platformLanguage ?? fallback;
};

export const detectTouchSupport = (): boolean => {
  const win = typeof window !== "undefined" ? window : undefined;
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  return Boolean((win && "ontouchstart" in win) || (nav?.maxTouchPoints ?? 0) > 0);
};

export const createDefaultProgress = (options: ProgressDefaultsOptions): ProgressState => ({
  bestScore: 0,
  tokens: 0,
  themesUnlocked: [DEFAULT_THEME_ID],
  runsCount: 0,
  settings: {
    musicEnabled: true,
    sfxEnabled: true,
    tapToPlace: options.isTouch ?? false,
    themeId: DEFAULT_THEME_ID,
    language:
      normalizeLanguage(options.platformLanguage ?? null) ??
      getDefaultLanguage(options.platformId, options.hostname)
  }
});

export const normalizeStoredProgress = (
  snapshot: StoredProgressSnapshot,
  options: ProgressDefaultsOptions
): ProgressState => {
  const defaults = createDefaultProgress(options);
  const themesUnlocked = normalizeThemesUnlocked(snapshot.themesUnlocked);
  const rawSettings = isRecord(snapshot.settings) ? snapshot.settings : {};
  const legacyAudio = typeof rawSettings.audio === "boolean" ? rawSettings.audio : undefined;

  return {
    bestScore: coerceNonNegativeInt(snapshot.bestScore, defaults.bestScore),
    tokens: coerceNonNegativeInt(snapshot.tokens, defaults.tokens),
    themesUnlocked,
    runsCount: coerceNonNegativeInt(snapshot.runsCount, defaults.runsCount),
    settings: {
      musicEnabled:
        typeof rawSettings.musicEnabled === "boolean"
          ? rawSettings.musicEnabled
          : legacyAudio ?? defaults.settings.musicEnabled,
      sfxEnabled:
        typeof rawSettings.sfxEnabled === "boolean"
          ? rawSettings.sfxEnabled
          : legacyAudio ?? defaults.settings.sfxEnabled,
      tapToPlace:
        typeof rawSettings.tapToPlace === "boolean"
          ? rawSettings.tapToPlace
          : defaults.settings.tapToPlace,
      themeId: normalizeThemeId(rawSettings.themeId, themesUnlocked),
      language: resolveLanguage(rawSettings.language, options, defaults.settings.language)
    }
  };
};
