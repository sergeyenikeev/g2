import type { PlatformId } from "../platform/bridge";

export type Language = "en" | "ru";

type Dictionary = Record<string, string>;

const DICTS: Record<Language, Dictionary> = {
  en: {
    "title.short": "LumeLines: Daily Blocks",
    "title.full": "LumeLines: Daily Blocks",
    tagline: "Place. Clear. Glow - every day.",
    "loading.status": "Loading...",
    "menu.play": "Play",
    "menu.tutorial": "Tutorial",
    "menu.tutorial_replay": "Replay Tutorial",
    "menu.tutorial_done": "Tutorial already completed",
    "menu.daily": "Daily Challenge",
    "menu.daily_status.empty": "Today's daily is still untouched.",
    "menu.daily_status.best": "Today's daily best: {score}",
    "menu.rewarded": "Watch Ad (Reward)",
    "menu.themes": "Themes",
    "menu.settings": "Settings",
    "menu.best": "Best",
    "menu.tokens": "Tokens",
    "menu.adblock": "Adblock detected. You can still play normally.",
    "hud.score": "Score",
    "hud.combo": "Combo",
    "hud.options": "Options",
    "hud.tokens": "Tokens",
    "hud.pause": "Pause",
    "game.tap_hint.one": "Only one slot fits this piece. Tap the highlight to place it.",
    "game.tap_hint.many": "{count} slots fit. Tap the highlight to place, or drag to choose another.",
    "game.keyboard_hint.one": "Only one slot fits. Press Enter to place it.",
    "game.keyboard_hint.many": "{count} slots fit. Use the arrow keys to move, then press Enter to place.",
    "game.pressure.critical": "Only {count} placements remain. This board is getting tight.",
    "game.pressure.single_piece": "Only one piece fits right now. Make this move count.",
    "pause.title": "Paused",
    "pause.resume": "Resume",
    "pause.restart": "Restart",
    "pause.settings": "Settings",
    "pause.menu": "Main Menu",
    "results.title": "Run Complete",
    "results.title.tutorial": "Tutorial Complete",
    "results.score": "Score",
    "results.best": "Best",
    "results.tokens": "Tokens",
    "results.lines": "Lines",
    "results.moves": "Moves",
    "results.duration": "Time",
    "results.peak_combo": "Peak Combo",
    "results.best_clear": "Best Clear",
    "results.continue": "Continue (Rewarded)",
    "results.double": "Double Tokens (Rewarded)",
    "results.play_again": "Play Again",
    "results.menu": "Main Menu",
    "results.tutorial_hint": "Tutorial complete. Start Play or Daily for normal progression.",
    "results.summary.new_best": "New best",
    "results.summary.daily_first": "First daily clear today",
    "results.summary.daily_best": "New daily best",
    "results.summary.daily_current": "Today's best {score}",
    "results.summary.token_bonus": "Bonus tokens +{count}",
    "results.summary.double_applied": "Reward doubled",
    "themes.title": "Themes",
    "themes.back": "Back",
    "settings.title": "Settings",
    "settings.music": "Music",
    "settings.sfx": "SFX",
    "settings.tap": "Tap to place",
    "settings.language": "Language",
    "settings.close": "Close",
    "language.en": "English",
    "language.ru": "Russian",
    "theme.name.lume": "Lume Classic",
    "theme.name.ember": "Ember Ash",
    "theme.name.aqua": "Aqua Drift",
    "theme.name.forest": "Forest Pulse",
    "theme.price": "{price} Tokens",
    "theme.action.selected": "Selected",
    "theme.action.select": "Select",
    "theme.action.buy": "Buy ({price})",
    "theme.action.need": "Need {price}",
    "hint.continue_unavailable": "Continue unavailable",
    "hint.continue_need_score": "Need {score} score to continue",
    "hint.continue_no_space": "No rescue pieces fit this board.",
    "hint.double_need_tokens": "Need at least {count} tokens to double",
    "hint.continue_cooldown": "Continue cooldown",
    "hint.rewarded_cooldown": "Rewarded cooldown",
    "hint.rewarded_ready_in": "Reward available in {time}",
    "hint.continue_ready_in": "Continue available in {time}",
    "hint.reward_already_used": "This reward is already used in this run",
    "hint.ads_unavailable": "Ads are not available on this platform.",
    "tutorial.progress": "Lesson {step}/{total}: {message}",
    "tutorial.step1": "Drag the 3-block line into the highlighted gap to clear a row.",
    "tutorial.step2": "Place the square into the guide to finish a column.",
    "tutorial.step3": "Use the L-shape in the highlighted slot for a bigger clear.",
    "toast.continue_unavailable": "Continue unavailable",
    "toast.double_unavailable": "Double tokens unavailable",
    "toast.rewarded_cooldown": "Rewarded cooldown",
    "toast.continue_cooldown": "Continue cooldown",
    "toast.continue_need_score": "Need {score} score to continue",
    "toast.continue_no_space": "Continue is unavailable because no rescue pieces fit.",
    "toast.reward_already_used": "This reward is already used",
    "toast.ad_unavailable": "Ad unavailable",
    "toast.rewarded_tokens": "Reward: +{count} tokens",
    "toast.cant_place": "Can't place there",
    "toast.piece_no_room": "No space for this piece right now.",
    "toast.tutorial_follow_hint": "Follow the highlighted placement to continue the tutorial.",
    "toast.tutorial_step_complete": "Nice. Next lesson is ready."
  },
  ru: {
    "title.short": "LumeLines: Daily Blocks",
    "title.full": "LumeLines: Daily Blocks",
    tagline: "Ставь. Очищай. Светись - каждый день.",
    "loading.status": "Загрузка...",
    "menu.play": "Играть",
    "menu.tutorial": "Обучение",
    "menu.tutorial_replay": "Повторить обучение",
    "menu.tutorial_done": "Обучение уже пройдено",
    "menu.daily": "Ежедневное испытание",
    "menu.daily_status.empty": "Сегодняшний daily еще не пройден.",
    "menu.daily_status.best": "Лучший результат daily сегодня: {score}",
    "menu.rewarded": "Реклама за награду",
    "menu.themes": "Темы",
    "menu.settings": "Настройки",
    "menu.best": "Рекорд",
    "menu.tokens": "Токены",
    "menu.adblock": "Обнаружен Adblock. Играть можно без рекламы.",
    "hud.score": "Счет",
    "hud.combo": "Комбо",
    "hud.options": "Варианты",
    "hud.tokens": "Токены",
    "hud.pause": "Пауза",
    "game.tap_hint.one": "Для этой фигуры подходит только один слот. Нажми по подсветке, чтобы поставить ее.",
    "game.tap_hint.many": "Подходит {count} слотов. Нажми по подсветке для быстрой постановки или перетащи фигуру в другое место.",
    "game.keyboard_hint.one": "Подходит только один слот. Нажми Enter, чтобы поставить фигуру.",
    "game.keyboard_hint.many": "Подходит {count} слотов. Перемещай постановку стрелками и нажми Enter для подтверждения.",
    "game.pressure.critical": "Осталось только {count} постановок. Поле почти закрыто.",
    "game.pressure.single_piece": "Сейчас помещается только одна фигура. Ход очень важный.",
    "pause.title": "Пауза",
    "pause.resume": "Продолжить",
    "pause.restart": "Начать заново",
    "pause.settings": "Настройки",
    "pause.menu": "Главное меню",
    "results.title": "Раунд завершен",
    "results.title.tutorial": "Обучение пройдено",
    "results.score": "Счет",
    "results.best": "Рекорд",
    "results.tokens": "Токены",
    "results.lines": "Линии",
    "results.moves": "Ходы",
    "results.duration": "Время",
    "results.peak_combo": "Пик комбо",
    "results.best_clear": "Лучший клир",
    "results.continue": "Продолжить (реклама)",
    "results.double": "Удвоить токены (реклама)",
    "results.play_again": "Сыграть еще",
    "results.menu": "Главное меню",
    "results.tutorial_hint": "Обучение завершено. Для обычного прогресса запусти обычный или daily-режим.",
    "results.summary.new_best": "Новый рекорд",
    "results.summary.daily_first": "Первое daily-прохождение сегодня",
    "results.summary.daily_best": "Новый рекорд дня",
    "results.summary.daily_current": "Лучший результат дня: {score}",
    "results.summary.token_bonus": "Бонусные токены +{count}",
    "results.summary.double_applied": "Награда удвоена",
    "themes.title": "Темы",
    "themes.back": "Назад",
    "settings.title": "Настройки",
    "settings.music": "Музыка",
    "settings.sfx": "Звуки",
    "settings.tap": "Размещать касанием",
    "settings.language": "Язык",
    "settings.close": "Закрыть",
    "language.en": "English",
    "language.ru": "Русский",
    "theme.name.lume": "Lume Классик",
    "theme.name.ember": "Пепельный жар",
    "theme.name.aqua": "Водный дрейф",
    "theme.name.forest": "Пульс леса",
    "theme.price": "{price} токенов",
    "theme.action.selected": "Выбрано",
    "theme.action.select": "Выбрать",
    "theme.action.buy": "Купить ({price})",
    "theme.action.need": "Нужно {price}",
    "hint.continue_unavailable": "Продолжение недоступно",
    "hint.continue_need_score": "Нужно {score} очков для продолжения",
    "hint.continue_no_space": "Ни одна спасательная фигура не помещается на это поле.",
    "hint.double_need_tokens": "Нужно минимум {count} токенов для удвоения",
    "hint.continue_cooldown": "Кулдаун продолжения",
    "hint.rewarded_cooldown": "Кулдаун наградной рекламы",
    "hint.rewarded_ready_in": "Награда будет доступна через {time}",
    "hint.continue_ready_in": "Продолжение будет доступно через {time}",
    "hint.reward_already_used": "Эта награда уже использована в текущем раунде",
    "hint.ads_unavailable": "Реклама недоступна на этой платформе.",
    "tutorial.progress": "Шаг {step}/{total}: {message}",
    "tutorial.step1": "Перетащи линию из 3 блоков в подсвеченный разрыв, чтобы закрыть ряд.",
    "tutorial.step2": "Поставь квадрат в подсказанную позицию, чтобы закрыть колонку.",
    "tutorial.step3": "Используй Г-образную фигуру в подсвеченном слоте для большого очищения.",
    "toast.continue_unavailable": "Продолжение недоступно",
    "toast.double_unavailable": "Удвоение токенов недоступно",
    "toast.rewarded_cooldown": "Кулдаун наградной рекламы",
    "toast.continue_cooldown": "Кулдаун продолжения",
    "toast.continue_need_score": "Нужно {score} очков для продолжения",
    "toast.continue_no_space": "Продолжение недоступно: спасательные фигуры не помещаются.",
    "toast.reward_already_used": "Эта награда уже использована",
    "toast.ad_unavailable": "Реклама недоступна",
    "toast.rewarded_tokens": "Награда: +{count} токенов",
    "toast.cant_place": "Нельзя поставить сюда",
    "toast.piece_no_room": "Для этой фигуры сейчас нет места.",
    "toast.tutorial_follow_hint": "Следуй подсвеченной постановке, чтобы продолжить обучение.",
    "toast.tutorial_step_complete": "Отлично. Следующий шаг уже готов."
  }
};

export const normalizeLanguage = (value: string | null | undefined): Language | null => {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("ru")) {
    return "ru";
  }
  if (normalized.startsWith("en")) {
    return "en";
  }
  return null;
};

export const detectUserLanguage = (nav?: Navigator): Language => {
  const resolved = nav ?? (typeof navigator !== "undefined" ? navigator : undefined);
  const list = resolved?.languages?.length ? resolved.languages : resolved?.language ? [resolved.language] : [];
  for (const entry of list) {
    const normalized = normalizeLanguage(entry);
    if (normalized) {
      return normalized;
    }
  }
  return "en";
};

export const isRuPlatform = (platformId: PlatformId, hostname?: string): boolean => {
  if (platformId === "yandex" || platformId === "vkplay") {
    return true;
  }
  const hostSource = hostname ?? (typeof location !== "undefined" ? location.hostname : "");
  const host = hostSource.toLowerCase();
  if (
    host.includes("mail.ru") ||
    host.includes("my.games") ||
    host.includes("vk.com") ||
    host.includes("vkplay.ru")
  ) {
    return true;
  }
  return false;
};

export const getDefaultLanguage = (
  platformId: PlatformId,
  hostname?: string,
  nav?: Navigator
): Language => {
  if (isRuPlatform(platformId, hostname)) {
    return "ru";
  }
  return detectUserLanguage(nav) === "ru" ? "ru" : "en";
};

export const t = (
  lang: Language,
  key: string,
  params?: Record<string, string | number>
): string => {
  const dict = DICTS[lang] ?? DICTS.en;
  let value = dict[key] ?? DICTS.en[key] ?? key;
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      const token = `{${paramKey}}`;
      value = value.split(token).join(String(paramValue));
    }
  }
  return value;
};

export const applyTranslations = (lang: Language, root: ParentNode = document): void => {
  const dict = DICTS[lang] ?? DICTS.en;
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (!key) {
      return;
    }
    const fallback = DICTS.en[key] ?? element.textContent ?? "";
    element.textContent = dict[key] ?? fallback;
  });
};
