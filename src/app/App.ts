import { createDailySeed, dailyBestKey, formatDateKey } from "../core/daily";
import { canPlace } from "../core/board";
import { tokensFromScore } from "../core/game";
import { createSeededRng } from "../core/rng";
import { ActivePiece, GameMode, Point } from "../core/types";
import { AudioManager } from "./AudioManager";
import { DebugOverlay } from "./DebugOverlay";
import { GameSession } from "./GameSession";
import { Renderer } from "./Renderer";
import { ScreenManager } from "./ScreenManager";
import { ThemeManager, THEMES } from "./ThemeManager";
import { Toast } from "./Toast";
import { logger } from "../utils/logger";
import type { PlatformBridge, RewardedKind } from "../platform/bridge";
import { StorageService } from "../services/storage";
import { applyTranslations, getDefaultLanguage, Language, normalizeLanguage, t } from "./i18n";

interface SettingsState {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  tapToPlace: boolean;
  themeId: string;
  language: Language;
}

interface ProgressState {
  bestScore: number;
  tokens: number;
  themesUnlocked: string[];
  runsCount: number;
  settings: SettingsState;
}

type ScreenId =
  | "loading"
  | "menu"
  | "game"
  | "pause"
  | "results"
  | "themes"
  | "settings";

const MENU_REWARD_TOKENS = 2;

export class App {
  private screens!: ScreenManager;
  private renderer!: Renderer;
  private themeManager = new ThemeManager();
  private toast!: Toast;
  private debugOverlay!: DebugOverlay;
  private audio = new AudioManager();
  private platform: PlatformBridge;
  private storage!: StorageService;
  private session: GameSession | null = null;
  private progress: ProgressState = this.defaultProgress();
  private activeScreen: ScreenId = "loading";
  private returnScreen: ScreenId = "menu";
  private runTokens = 0;
  private runNewBest = false;
  private runFirstDaily = false;
  private runStartBestScore = 0;
  private runStartDailyBest: number | null = null;
  private runDailyKey: string | null = null;
  private runFinalized = false;
  private pendingBestScore = 0;
  private pendingDailyBest: number | null = null;
  private runHappytimeUsed = false;
  private dragging:
    | {
        pieceId: string;
        offsetX: number;
        offsetY: number;
      }
    | null = null;
  private dragCandidate:
    | {
        pieceId: string;
        start: Point;
        offsetX: number;
        offsetY: number;
        pointerId: number;
      }
    | null = null;
  private activePointerId: number | null = null;
  private selectedPieceId: string | null = null;
  private fpsSample = { last: 0, frames: 0, fps: 0 };

  private elements = {
    canvas: document.getElementById("game-canvas") as HTMLCanvasElement,
    canvasWrap: document.querySelector(".canvas-wrap") as HTMLElement | null,
    hud: document.querySelector("#screen-game .hud") as HTMLElement | null,
    menuBest: document.getElementById("menu-best") as HTMLElement,
    menuTokens: document.getElementById("menu-tokens") as HTMLElement,
    menuReward: document.getElementById("btn-menu-reward") as HTMLButtonElement,
    hudScore: document.getElementById("hud-score") as HTMLElement,
    hudCombo: document.getElementById("hud-combo") as HTMLElement,
    hudTokens: document.getElementById("hud-tokens") as HTMLElement,
    resultsScore: document.getElementById("results-score") as HTMLElement,
    resultsBest: document.getElementById("results-best") as HTMLElement,
    resultsTokens: document.getElementById("results-tokens") as HTMLElement,
    resultsHint: document.getElementById("results-hint") as HTMLElement,
    adblockBanner: document.getElementById("adblock-banner") as HTMLElement,
    themesGrid: document.getElementById("themes-grid") as HTMLElement,
    settingMusic: document.getElementById("setting-music") as HTMLInputElement,
    settingSfx: document.getElementById("setting-sfx") as HTMLInputElement,
    settingTap: document.getElementById("setting-tap") as HTMLInputElement,
    settingLanguage: document.getElementById("setting-language") as HTMLSelectElement,
    settingLanguageRow: document
      .getElementById("setting-language")
      ?.closest(".toggle") as HTMLElement | null,
    toast: document.getElementById("toast") as HTMLElement,
    debug: document.getElementById("debug-overlay") as HTMLElement
  };

  constructor(platform: PlatformBridge) {
    this.platform = platform;
  }

  async init(): Promise<void> {
    this.toast = new Toast(this.elements.toast);
    this.debugOverlay = new DebugOverlay(this.elements.debug);
    this.screens = new ScreenManager({
      loading: document.getElementById("screen-loading") as HTMLElement,
      menu: document.getElementById("screen-menu") as HTMLElement,
      game: document.getElementById("screen-game") as HTMLElement,
      pause: document.getElementById("screen-pause") as HTMLElement,
      results: document.getElementById("screen-results") as HTMLElement,
      themes: document.getElementById("screen-themes") as HTMLElement,
      settings: document.getElementById("screen-settings") as HTMLElement
    });

    this.platform.loadingStart();
    await this.platform.init();

    this.storage = new StorageService({
      getItem: (key) => this.platform.storageGet(key),
      setItem: (key, value) => this.platform.storageSet(key, value),
      removeItem: async (key) => {
        if (this.platform.storageRemove) {
          await this.platform.storageRemove(key);
        }
      }
    });
    await this.loadProgress();
    this.applyLanguage();
    this.configureLanguageSetting();

    const theme = this.themeManager.setTheme(this.progress.settings.themeId);
    this.renderer = new Renderer(this.elements.canvas, theme, {
      board: this.session?.state.board ?? Array.from({ length: 10 }, () => Array(10).fill(0)),
      pieces: this.session?.pieces ?? [null, null, null]
    });

    this.attachEvents();
    this.applySettings();
    await this.checkAdblock();

    this.showScreen("menu");
    this.platform.loadingStop();

    this.resize();
    requestAnimationFrame((t) => this.loop(t));
  }

  private attachEvents(): void {
    window.addEventListener("resize", () => this.resize());

    const play = document.getElementById("btn-play");
    const daily = document.getElementById("btn-daily");
    const menuReward = document.getElementById("btn-menu-reward");
    const themes = document.getElementById("btn-themes");
    const settings = document.getElementById("btn-settings");
    const pause = document.getElementById("btn-pause");
    const resume = document.getElementById("btn-resume");
    const restart = document.getElementById("btn-restart");
    const pauseMenu = document.getElementById("btn-pause-menu");
    const pauseSettings = document.getElementById("btn-pause-settings");
    const resultsMenu = document.getElementById("btn-results-menu");
    const playAgain = document.getElementById("btn-play-again");
    const continueBtn = document.getElementById("btn-continue");
    const doubleBtn = document.getElementById("btn-double");
    const themesBack = document.getElementById("btn-themes-back");
    const settingsClose = document.getElementById("btn-settings-close");

    play?.addEventListener("click", () => this.handleButton(() => void this.startRun("play")));
    daily?.addEventListener("click", () => this.handleButton(() => void this.startRun("daily")));
    menuReward?.addEventListener("click", () => this.handleButton(() => void this.tryMenuRewarded()));
    themes?.addEventListener("click", () => this.handleButton(() => this.openThemes()));
    settings?.addEventListener("click", () => this.handleButton(() => this.openSettings("menu")));
    pause?.addEventListener("click", () => this.handleButton(() => this.pauseGame()));
    resume?.addEventListener("click", () => this.handleButton(() => this.resumeGame()));
    restart?.addEventListener("click", () => this.handleButton(() => this.restartRun()));
    pauseMenu?.addEventListener("click", () => this.handleButton(() => this.returnToMenu()));
    pauseSettings?.addEventListener("click", () => this.handleButton(() => this.openSettings("pause")));
    resultsMenu?.addEventListener("click", () => this.handleButton(() => this.returnToMenu()));
    playAgain?.addEventListener("click", () => this.handleButton(() => void this.playAgain()));
    continueBtn?.addEventListener("click", () => this.handleButton(() => this.tryContinue()));
    doubleBtn?.addEventListener("click", () => this.handleButton(() => this.tryDoubleTokens()));
    themesBack?.addEventListener("click", () => this.handleButton(() => this.showScreen("menu")));
    settingsClose?.addEventListener("click", () => this.handleButton(() => this.closeSettings()));

    this.elements.settingMusic.addEventListener("change", () => {
      this.progress.settings.musicEnabled = this.elements.settingMusic.checked;
      this.applySettings();
    });

    this.elements.settingSfx.addEventListener("change", () => {
      this.progress.settings.sfxEnabled = this.elements.settingSfx.checked;
      this.applySettings();
    });

    this.elements.settingTap.addEventListener("change", () => {
      this.progress.settings.tapToPlace = this.elements.settingTap.checked;
      this.saveProgress();
    });

    document.addEventListener("visibilitychange", () => this.handleVisibilityChange());
    window.addEventListener("blur", () => this.handleVisibilityChange(true));
    window.addEventListener("focus", () => this.handleVisibilityChange(false));
    window.addEventListener("pagehide", () => this.handleVisibilityChange(true));
    window.addEventListener("pageshow", () => this.handleVisibilityChange(false));
    document.addEventListener("contextmenu", (event) => this.preventContextMenu(event));
    document.addEventListener("selectstart", (event) => this.preventSelection(event));

    if (this.platform.id !== "yandex") {
      this.elements.settingLanguage.addEventListener("change", () => {
        const selected = normalizeLanguage(this.elements.settingLanguage.value);
        this.progress.settings.language = selected ?? getDefaultLanguage(this.platform.id);
        this.applyLanguage();
        this.saveProgress();
      });
    }

    const pointerOptions = { passive: false };
    this.elements.canvas.addEventListener("pointerdown", (event) => this.onPointerDown(event), pointerOptions);
    this.elements.canvas.addEventListener("pointermove", (event) => this.onPointerMove(event), pointerOptions);
    this.elements.canvas.addEventListener("pointerup", (event) => this.onPointerUp(event), pointerOptions);
    this.elements.canvas.addEventListener("pointerleave", (event) => this.onPointerUp(event), pointerOptions);
  }

  private handleButton(action: () => void): void {
    this.audio.unlock();
    this.audio.playButton();
    action();
  }

  private async loadProgress(): Promise<void> {
    const defaults = this.defaultProgress();
    const bestScore = await this.storage.get("bestScore", defaults.bestScore);
    const tokens = await this.storage.get("tokens", defaults.tokens);
    const themesUnlocked = await this.storage.get("themesUnlocked", defaults.themesUnlocked);
    const runsCount = await this.storage.get("runsCount", defaults.runsCount);
    const settings = await this.storage.get("settings", defaults.settings);
    const normalizedSettings = { ...defaults.settings, ...settings } as SettingsState & {
      audio?: boolean;
      language?: string;
    };
    if (typeof normalizedSettings.audio === "boolean") {
      normalizedSettings.musicEnabled = normalizedSettings.audio;
      normalizedSettings.sfxEnabled = normalizedSettings.audio;
    }
    const storedLanguage = normalizeLanguage(
      typeof normalizedSettings.language === "string" ? normalizedSettings.language : null
    );
    const platformLanguage = normalizeLanguage(await this.platform.getLanguage());
    if (this.platform.id === "yandex") {
      normalizedSettings.language = platformLanguage ?? getDefaultLanguage(this.platform.id);
    } else {
      normalizedSettings.language =
        storedLanguage ?? platformLanguage ?? getDefaultLanguage(this.platform.id);
    }

    this.progress = {
      bestScore,
      tokens,
      themesUnlocked: Array.from(new Set([...themesUnlocked, "lume"])),
      runsCount,
      settings: normalizedSettings
    };

    this.elements.settingMusic.checked = this.progress.settings.musicEnabled;
    this.elements.settingSfx.checked = this.progress.settings.sfxEnabled;
    this.elements.settingTap.checked = this.progress.settings.tapToPlace;
    this.elements.settingLanguage.value = this.progress.settings.language;
    this.updateMenuStats();
  }

  private async saveProgress(): Promise<void> {
    await this.storage.set("bestScore", this.progress.bestScore);
    await this.storage.set("tokens", this.progress.tokens);
    await this.storage.set("themesUnlocked", this.progress.themesUnlocked);
    await this.storage.set("runsCount", this.progress.runsCount);
    await this.storage.set("settings", this.progress.settings);
  }

  private applySettings(): void {
    this.audio.setSfxEnabled(this.progress.settings.sfxEnabled);
    this.audio.setMusicEnabled(this.progress.settings.musicEnabled);
    if (this.activeScreen === "game" && this.progress.settings.musicEnabled) {
      this.audio.startMusic();
    } else {
      this.audio.stopMusic();
    }
    this.themeManager.setTheme(this.progress.settings.themeId);
    if (this.renderer) {
      this.renderer.setTheme(this.themeManager.getTheme());
    }
    this.saveProgress();
  }

  private configureLanguageSetting(): void {
    if (this.platform.id !== "yandex") {
      return;
    }
    this.elements.settingLanguage.disabled = true;
    if (this.elements.settingLanguageRow) {
      this.elements.settingLanguageRow.style.display = "none";
    }
  }

  private handleVisibilityChange(forceHidden?: boolean): void {
    const hidden = forceHidden ?? document.hidden;
    if (hidden) {
      void this.audio.suspend();
      this.audio.setMuted(true);
      this.audio.stopMusic();
      if (this.activeScreen === "game") {
        this.platform.gameplayStop();
      }
      return;
    }
    void this.audio.resume();
    this.audio.setMuted(false);
    if (this.activeScreen === "game") {
      if (this.progress.settings.musicEnabled) {
        this.audio.startMusic();
      }
      this.platform.gameplayStart();
    }
  }

  private preventContextMenu(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest("#app")) {
      event.preventDefault();
    }
  }

  private preventSelection(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest("#app")) {
      event.preventDefault();
    }
  }

  private applyLanguage(): void {
    const lang = this.progress.settings.language;
    applyTranslations(lang);
    document.documentElement.lang = lang;
    document.title = t(lang, "title.full");
    this.elements.settingLanguage.value = lang;
    this.renderThemes();
    this.updateResultsHints();
  }

  private async checkAdblock(): Promise<void> {
    try {
      const adblock = await this.platform.hasAdblock();
      this.elements.adblockBanner.hidden = !adblock;
    } catch {
      this.elements.adblockBanner.hidden = true;
    }
  }

  private async startRun(mode: GameMode): Promise<void> {
    const now = Date.now();
    const date = new Date();
    const seed = mode === "daily" ? createDailySeed(date) : `run_${now}`;
    const rng = createSeededRng(seed);
    this.session = new GameSession(mode, seed, rng, now);
    this.runTokens = 0;
    this.runNewBest = false;
    this.runFirstDaily = false;
    this.runHappytimeUsed = false;
    this.runFinalized = false;
    this.pendingBestScore = this.progress.bestScore;
    this.pendingDailyBest = null;
    this.runStartBestScore = this.progress.bestScore;
    this.runDailyKey = mode === "daily" ? dailyBestKey(date) : null;
    this.runStartDailyBest = this.runDailyKey
      ? await this.storage.getOptional<number>(this.runDailyKey)
      : null;
    this.runFirstDaily = mode === "daily" && this.runStartDailyBest === null;
    this.selectedPieceId = null;
    this.dragging = null;
    this.dragCandidate = null;
    this.activePointerId = null;

    logger.info("startSession", { mode, date: formatDateKey(date) });
    logger.info("startRun", { mode, seed });
    this.progress.runsCount += 1;
    await this.saveProgress();

    this.updateHud();
    this.renderer.setState({
      board: this.session.state.board,
      pieces: this.session.pieces,
      ghost: undefined,
      dragging: undefined,
      selectedPieceId: null
    });
    this.showScreen("game");
    this.audio.startMusic();
    this.platform.gameplayStart();
  }

  private pauseGame(): void {
    if (this.activeScreen !== "game") {
      return;
    }
    this.showScreen("pause");
    this.audio.stopMusic();
    this.platform.gameplayStop();
  }

  private resumeGame(): void {
    if (this.activeScreen !== "pause") {
      return;
    }
    this.showScreen("game");
    this.audio.startMusic();
    this.platform.gameplayStart();
  }

  private restartRun(): void {
    if (!this.session) {
      return;
    }
    void this.startRun(this.session.state.mode);
  }

  private async playAgain(): Promise<void> {
    if (this.activeScreen === "results") {
      await this.finalizeRun();
    }
    const mode = this.session?.state.mode ?? "play";
    await this.startRun(mode);
  }

  private returnToMenu(): void {
    if (this.activeScreen === "results") {
      void this.finalizeRun();
    }
    this.audio.stopMusic();
    this.platform.gameplayStop();
    this.showScreen("menu");
  }

  private openThemes(): void {
    this.renderThemes();
    this.showScreen("themes");
  }

  private openSettings(returnTo: ScreenId): void {
    this.returnScreen = returnTo;
    this.showScreen("settings");
  }

  private closeSettings(): void {
    this.showScreen(this.returnScreen);
  }

  private showScreen(id: ScreenId): void {
    this.activeScreen = id;
    this.screens.show(id);
    if (id === "menu") {
      this.updateMenuRewardState();
    }
  }

  private updateMenuStats(): void {
    this.elements.menuBest.textContent = `${this.progress.bestScore}`;
    this.elements.menuTokens.textContent = `${this.progress.tokens}`;
  }

  private updateHud(): void {
    if (!this.session) {
      return;
    }
    this.elements.hudScore.textContent = `${this.session.state.score}`;
    this.elements.hudCombo.textContent = `x${this.session.state.combo.toFixed(2)}`;
    this.elements.hudTokens.textContent = `${this.progress.tokens}`;
  }

  private updateResults(): void {
    this.elements.resultsScore.textContent = `${this.session?.state.score ?? 0}`;
    const bestDisplay = Math.max(this.progress.bestScore, this.pendingBestScore);
    this.elements.resultsBest.textContent = `${bestDisplay}`;
    this.elements.resultsTokens.textContent = `${this.runTokens}`;
  }

  private isRewardedAvailable(): boolean {
    return this.platform.id !== "generic";
  }

  private getMenuRewardEligibility(): { ok: boolean; reason?: string } {
    if (!this.isRewardedAvailable()) {
      return { ok: false, reason: "ads_unavailable" };
    }
    return this.platform.canShowRewardedNow("rewarded");
  }

  private updateMenuRewardState(): void {
    if (!this.elements.menuReward) {
      return;
    }
    if (!this.isRewardedAvailable()) {
      this.elements.menuReward.hidden = true;
      this.elements.menuReward.disabled = true;
      return;
    }
    const eligibility = this.getMenuRewardEligibility();
    this.elements.menuReward.hidden = false;
    this.elements.menuReward.disabled = !eligibility.ok;
  }

  private getContinueEligibility(): { ok: boolean; reason?: string } {
    if (!this.session) {
      return { ok: false, reason: "no_session" };
    }
    if (this.runFinalized) {
      return { ok: false, reason: "run_finalized" };
    }
    if (!this.isRewardedAvailable()) {
      return { ok: false, reason: "ads_unavailable" };
    }
    if (this.session.continueUsed) {
      return { ok: false, reason: "already_used" };
    }
    if (this.session.state.score < 800) {
      return { ok: false, reason: "score_low" };
    }
    const cooldown = this.platform.canShowRewardedNow("continue");
    if (!cooldown.ok) {
      return cooldown;
    }
    return { ok: true };
  }

  private getDoubleEligibility(): { ok: boolean; reason?: string } {
    if (!this.session) {
      return { ok: false, reason: "no_session" };
    }
    if (this.runFinalized) {
      return { ok: false, reason: "run_finalized" };
    }
    if (!this.isRewardedAvailable()) {
      return { ok: false, reason: "ads_unavailable" };
    }
    if (this.session.doubleTokensUsed) {
      return { ok: false, reason: "already_used" };
    }
    if (this.runTokens < 2) {
      return { ok: false, reason: "tokens_low" };
    }
    const cooldown = this.platform.canShowRewardedNow("double_tokens");
    if (!cooldown.ok) {
      return cooldown;
    }
    return { ok: true };
  }

  private async endRun(): Promise<void> {
    if (!this.session) {
      return;
    }
    const now = Date.now();
    const mode = this.session.state.mode;
    const score = this.session.state.score;
    const duration = now - this.session.state.startedAt;

    const baseTokens = tokensFromScore(score);
    this.runNewBest = score > this.runStartBestScore;
    this.pendingBestScore = this.runNewBest ? score : this.runStartBestScore;

    if (mode === "daily") {
      const dailyBest = this.runStartDailyBest;
      this.pendingDailyBest =
        dailyBest === null || score > dailyBest ? score : (dailyBest as number);
    } else {
      this.pendingDailyBest = null;
    }

    const bonus = (this.runNewBest ? 2 : 0) + (this.runFirstDaily ? 3 : 0);
    this.runTokens = baseTokens + bonus;
    this.updateResults();

    logger.info("endRun", {
      score,
      lines: this.session.state.linesCleared,
      duration
    });

    this.platform.gameplayStop();
    this.audio.stopMusic();
    this.audio.playFail();
    this.requestMidgameAd();

    if (this.runNewBest) {
      this.triggerHappytime();
    }

    this.showScreen("results");
    this.updateResultsHints();
  }

  private async finalizeRun(): Promise<void> {
    if (this.runFinalized) {
      return;
    }
    if (this.runNewBest) {
      this.progress.bestScore = Math.max(this.progress.bestScore, this.pendingBestScore);
    }
    if (this.runDailyKey && this.pendingDailyBest !== null) {
      await this.storage.set(this.runDailyKey, this.pendingDailyBest);
    }
    this.progress.tokens += this.runTokens;
    await this.saveProgress();
    this.updateMenuStats();
    this.runFinalized = true;
  }

  private updateResultsHints(): void {
    if (!this.session) {
      return;
    }
    const lang = this.progress.settings.language;
    const doubleEligibility = this.getDoubleEligibility();
    const adsUnavailable = doubleEligibility.reason === "ads_unavailable";
    const continueBtn = document.getElementById("btn-continue") as HTMLButtonElement | null;
    const doubleBtn = document.getElementById("btn-double") as HTMLButtonElement | null;

    if (continueBtn) {
      continueBtn.hidden = true;
      continueBtn.disabled = true;
    }
    if (doubleBtn) {
      doubleBtn.hidden = adsUnavailable;
      doubleBtn.disabled = !doubleEligibility.ok;
    }

    const hints: string[] = [];
    if (adsUnavailable) {
      this.elements.resultsHint.textContent = "";
      return;
    }
    if (doubleEligibility.reason === "tokens_low") {
      hints.push(t(lang, "hint.double_need_tokens", { count: 2 }));
    }
    const cooldownHint = this.getCooldownHint(doubleEligibility, lang);
    if (cooldownHint) {
      hints.push(cooldownHint);
    }
    this.elements.resultsHint.textContent = hints.join(" - ");
  }

  private getCooldownHint(
    doubleEligibility: { ok: boolean; reason?: string },
    lang: Language
  ): string | null {
    if (doubleEligibility.reason === "rewarded_cooldown") {
      return t(lang, "hint.rewarded_cooldown");
    }
    return null;
  }

  private async tryMenuRewarded(): Promise<void> {
    const eligibility = this.getMenuRewardEligibility();
    const lang = this.progress.settings.language;
    if (!eligibility.ok) {
      if (eligibility.reason === "rewarded_cooldown") {
        this.toast.show(t(lang, "toast.rewarded_cooldown"));
      } else {
        this.toast.show(t(lang, "toast.ad_unavailable"));
      }
      return;
    }
    await this.requestRewarded("rewarded", () => {
      this.progress.tokens += MENU_REWARD_TOKENS;
      void this.saveProgress();
      this.updateMenuStats();
      this.toast.show(t(lang, "toast.rewarded_tokens", { count: MENU_REWARD_TOKENS }));
    });
    this.updateMenuRewardState();
  }

  private async tryContinue(): Promise<void> {
    if (!this.session) {
      return;
    }
    const eligibility = this.getContinueEligibility();
    if (!eligibility.ok) {
      logger.warn("rewarded_denied", { reason: eligibility.reason ?? "continue_unavailable" });
      const lang = this.progress.settings.language;
      if (eligibility.reason === "ads_unavailable") {
        this.toast.show(t(lang, "toast.ad_unavailable"));
      } else {
        this.toast.show(t(lang, "toast.continue_unavailable"));
      }
      return;
    }

    await this.requestRewarded("continue", () => {
      this.session?.setContinuePieces();
      this.platform.markContinueUsed();
      this.saveProgress();
      this.updateHud();
      this.renderer.setState({
        board: this.session?.state.board ?? Array.from({ length: 10 }, () => Array(10).fill(0)),
        pieces: this.session?.pieces ?? [null, null, null],
        ghost: undefined,
        dragging: undefined,
        selectedPieceId: null
      });
      this.showScreen("game");
      this.audio.startMusic();
      this.platform.gameplayStart();
    });
  }

  private async tryDoubleTokens(): Promise<void> {
    if (!this.session) {
      return;
    }
    const eligibility = this.getDoubleEligibility();
    if (!eligibility.ok) {
      logger.warn("rewarded_denied", { reason: eligibility.reason ?? "double_unavailable" });
      const lang = this.progress.settings.language;
      if (eligibility.reason === "ads_unavailable") {
        this.toast.show(t(lang, "toast.ad_unavailable"));
      } else {
        this.toast.show(t(lang, "toast.double_unavailable"));
      }
      return;
    }

    await this.requestRewarded("double_tokens", () => {
      this.session!.doubleTokensUsed = true;
      this.runTokens *= 2;
      void this.finalizeRun();
      this.updateResults();
      this.updateResultsHints();
    });
  }

  private requestMidgameAd(): void {
    void this.platform.showAd("midgame", {
      pause: () => {},
      resume: () => {},
      grantReward: () => {}
    });
  }

  private async requestRewarded(kind: RewardedKind, onSuccess: () => void): Promise<void> {
    const wasGameplay = this.activeScreen === "game";
    let paused = false;
    const pause = () => {
      if (paused) {
        return;
      }
      paused = true;
      this.audio.setMuted(true);
      if (wasGameplay) {
        this.platform.gameplayStop();
      }
    };
    const resume = () => {
      if (!paused) {
        return;
      }
      paused = false;
      this.audio.setMuted(false);
      if (wasGameplay) {
        this.platform.gameplayStart();
      }
    };

    const result = await this.platform.showAd("rewarded", {
      rewardKind: kind,
      pause,
      resume,
      grantReward: onSuccess
    });

    if (!result.shown) {
      resume();
      if (result.reason === "rewarded_cooldown") {
        this.toast.show(t(this.progress.settings.language, "toast.rewarded_cooldown"));
      } else if (result.reason === "continue_cooldown") {
        this.toast.show(t(this.progress.settings.language, "toast.continue_cooldown"));
      } else {
        this.toast.show(t(this.progress.settings.language, "toast.ad_unavailable"));
      }
    }
  }

  private onPointerDown(event: PointerEvent): void {
    if (!this.session || this.activeScreen !== "game") {
      return;
    }
    this.audio.unlock();
    if (this.activePointerId !== null && event.pointerId !== this.activePointerId) {
      return;
    }
    if (event.pointerType !== "mouse") {
      event.preventDefault();
    }
    if (this.elements.canvas.setPointerCapture) {
      this.elements.canvas.setPointerCapture(event.pointerId);
    }
    const point = this.getCanvasPoint(event);
    const pieceId = this.renderer.hitTestPiece(point);
    const isTapMode = this.progress.settings.tapToPlace && event.pointerType !== "mouse";

    if (isTapMode) {
      if (pieceId) {
        const rect = this.renderer.getPieceRect(pieceId);
        if (!rect) {
          return;
        }
        this.activePointerId = event.pointerId;
        this.selectedPieceId = pieceId;
        this.dragCandidate = {
          pieceId,
          start: point,
          offsetX: point.x - rect.x,
          offsetY: point.y - rect.y,
          pointerId: event.pointerId
        };
        this.renderer.setState({ selectedPieceId: pieceId, ghost: undefined });
      } else if (this.selectedPieceId) {
        const cell = this.renderer.getBoardCell(point);
        if (cell) {
          this.tryPlaceSelected(cell);
        }
      }
      return;
    }

    if (pieceId) {
      const rect = this.renderer.getPieceRect(pieceId);
      if (!rect) {
        return;
      }
      this.activePointerId = event.pointerId;
      this.dragging = {
        pieceId,
        offsetX: point.x - rect.x,
        offsetY: point.y - rect.y
      };
      this.dragCandidate = null;
      this.renderer.setState({
        dragging: { pieceId, x: rect.x, y: rect.y },
        selectedPieceId: null,
        ghost: undefined
      });
    }
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.session || this.activeScreen !== "game") {
      return;
    }
    if (this.activePointerId !== null && event.pointerId !== this.activePointerId) {
      return;
    }
    if (event.pointerType !== "mouse") {
      event.preventDefault();
    }
    const point = this.getCanvasPoint(event);
    if (this.dragCandidate) {
      const dx = point.x - this.dragCandidate.start.x;
      const dy = point.y - this.dragCandidate.start.y;
      if (Math.hypot(dx, dy) < 8) {
        return;
      }
      const piece = this.session.pieces.find(
        (slot) => slot?.instanceId === this.dragCandidate?.pieceId
      );
      if (!piece) {
        this.dragCandidate = null;
        this.activePointerId = null;
        return;
      }
      this.dragging = {
        pieceId: piece.instanceId,
        offsetX: this.dragCandidate.offsetX,
        offsetY: this.dragCandidate.offsetY
      };
      this.dragCandidate = null;
      this.selectedPieceId = null;
      const dragX = point.x - this.dragging.offsetX;
      const dragY = point.y - this.dragging.offsetY;
      const ghost = this.getGhostPlacement(piece, { x: dragX, y: dragY });
      this.renderer.setState({
        dragging: { pieceId: piece.instanceId, x: dragX, y: dragY },
        selectedPieceId: null,
        ghost
      });
      return;
    }
    if (!this.dragging) {
      return;
    }
    const piece = this.session.pieces.find((slot) => slot?.instanceId === this.dragging?.pieceId);
    if (!piece) {
      return;
    }

    const dragX = point.x - this.dragging.offsetX;
    const dragY = point.y - this.dragging.offsetY;
    const ghost = this.getGhostPlacement(piece, { x: dragX, y: dragY });

    this.renderer.setState({
      dragging: { pieceId: piece.instanceId, x: dragX, y: dragY },
      ghost
    });
  }

  private onPointerUp(event: PointerEvent): void {
    if (!this.session || this.activeScreen !== "game") {
      return;
    }
    if (this.activePointerId !== null && event.pointerId !== this.activePointerId) {
      return;
    }
    if (event.pointerType !== "mouse") {
      event.preventDefault();
    }
    if (this.elements.canvas.releasePointerCapture) {
      this.elements.canvas.releasePointerCapture(event.pointerId);
    }

    if (this.dragging) {
      const point = this.getCanvasPoint(event);
      const piece = this.session.pieces.find((slot) => slot?.instanceId === this.dragging?.pieceId);
      if (piece) {
        const dragX = point.x - this.dragging.offsetX;
        const dragY = point.y - this.dragging.offsetY;
        const ghost = this.getGhostPlacement(piece, { x: dragX, y: dragY });

        if (ghost && ghost.valid) {
          this.commitPlacement(piece.instanceId, ghost.origin);
        }
      }
    }

    this.dragging = null;
    this.dragCandidate = null;
    this.activePointerId = null;
    this.renderer.setState({ dragging: undefined, ghost: undefined });
  }

  private tryPlaceSelected(cell: Point): void {
    if (!this.session || !this.selectedPieceId) {
      return;
    }
    const piece = this.session.pieces.find((slot) => slot?.instanceId === this.selectedPieceId);
    if (!piece) {
      return;
    }
    const ghost = this.getGhostPlacement(piece, { x: cell.x, y: cell.y }, true);
    if (!ghost || !ghost.valid) {
      this.audio.playFail();
      this.toast.show(t(this.progress.settings.language, "toast.cant_place"));
      return;
    }
    this.commitPlacement(piece.instanceId, ghost.origin);
    this.selectedPieceId = null;
    this.renderer.setState({ selectedPieceId: null, ghost: undefined });
  }

  private commitPlacement(pieceId: string, origin: Point): void {
    if (!this.session) {
      return;
    }
    const result = this.session.placePiece(pieceId, origin);
    if (!result) {
      this.audio.playFail();
      return;
    }
    this.audio.playPlace();
    if (result.linesCleared > 0) {
      this.audio.playClear(result.linesCleared);
      if (result.linesCleared >= 2) {
        this.audio.playCombo();
      }
    }
    this.renderer.setState({
      board: result.state.board,
      pieces: this.session.pieces,
      flashLines: {
        rows: result.rows,
        cols: result.cols,
        until: performance.now() + 240
      }
    });
    this.updateHud();

    if (result.linesCleared >= 3 && result.state.combo >= 2.5) {
      this.triggerHappytime();
    }

    if (!this.session.canPlaceAny()) {
      void this.endRun();
    }
  }

  private getGhostPlacement(
    piece: ActivePiece,
    position: Point,
    absolute = false
  ): { piece: ActivePiece["def"]; origin: Point; valid: boolean } | undefined {
    const layout = this.renderer.getLayout();
    const cellSize = layout.cellSize;
    const origin = absolute
      ? position
      : {
          x: Math.round((position.x - layout.boardRect.x) / cellSize),
          y: Math.round((position.y - layout.boardRect.y) / cellSize)
        };
    if (!this.session) {
      return undefined;
    }
    const valid = canPlace(this.session.state.board, piece.def, origin);
    return { piece: piece.def, origin, valid };
  }

  private triggerHappytime(): void {
    if (this.runHappytimeUsed) {
      return;
    }
    this.runHappytimeUsed = true;
    this.platform.happytime?.();
  }

  private resize(): void {
    this.ensureGameplayCoverage();
    if (this.renderer) {
      this.renderer.resize();
    }
  }

  private ensureGameplayCoverage(): void {
    const canvas = this.elements.canvas;
    const wrap = this.elements.canvasWrap;
    if (!canvas || !wrap) {
      return;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    if (viewportWidth <= 0 || viewportHeight <= 0) {
      return;
    }

    const hudHeight = this.elements.hud?.getBoundingClientRect().height ?? 0;
    const style = window.getComputedStyle(wrap);
    const horizontalPadding =
      parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const verticalPadding =
      parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);

    const availableWidth = Math.max(viewportWidth - horizontalPadding, 0);
    const availableHeight = Math.max(viewportHeight - hudHeight - verticalPadding, 0);
    if (availableWidth <= 0 || availableHeight <= 0) {
      return;
    }

    const requiredArea = viewportWidth * viewportHeight * 0.7;
    const targetSide = Math.sqrt(requiredArea);
    const baseSide = Math.min(availableWidth, availableHeight);
    const side = Math.min(targetSide, baseSide);
    if (side <= 0) {
      return;
    }

    canvas.style.width = `${Math.round(side)}px`;
    canvas.style.height = `${Math.round(side)}px`;
  }

  private loop(time: number): void {
    if (this.renderer) {
      this.renderer.render(time);
    }
    this.updateDebug(time);
    requestAnimationFrame((t) => this.loop(t));
  }

  private updateDebug(time: number): void {
    if (!import.meta.env.DEV || !this.session) {
      this.debugOverlay.setVisible(false);
      return;
    }
    this.fpsSample.frames += 1;
    const elapsed = time - this.fpsSample.last;
    if (elapsed > 500) {
      this.fpsSample.fps = (this.fpsSample.frames / elapsed) * 1000;
      this.fpsSample.frames = 0;
      this.fpsSample.last = time;
    }
    this.debugOverlay.setVisible(true);
    const cooldowns = this.platform.getCooldownStatus();
    const now = Date.now();
    const rewardedCooldownMs = Math.max(0, cooldowns.rewardedAvailableAt - now);
    const continueCooldownMs = Math.max(0, cooldowns.continueAvailableAt - now);
    this.debugOverlay.update({
      fps: this.fpsSample.fps,
      seed: this.session.state.seed,
      combo: this.session.state.combo,
      nextPieces: this.session.pieces,
      platform: this.platform.id,
      mode: this.session.state.mode,
      rewardedCooldownMs,
      continueCooldownMs
    });
  }

  private getCanvasPoint(event: PointerEvent): Point {
    const rect = this.elements.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  private renderThemes(): void {
    const lang = this.progress.settings.language;
    this.elements.themesGrid.innerHTML = "";
    for (const theme of THEMES) {
      const card = document.createElement("div");
      card.className = "theme-card";

      const preview = document.createElement("div");
      preview.className = "theme-preview";
      preview.style.background = `linear-gradient(135deg, ${theme.palette.block}, ${theme.palette.accentAlt})`;

      const title = document.createElement("strong");
      title.textContent = t(lang, `theme.name.${theme.id}`);

      const cost = document.createElement("span");
      cost.textContent = t(lang, "theme.price", { price: theme.price });

      const action = document.createElement("button");
      action.className = "btn";

      const unlocked = this.progress.themesUnlocked.includes(theme.id);
      if (unlocked) {
        action.textContent =
          theme.id === this.progress.settings.themeId
            ? t(lang, "theme.action.selected")
            : t(lang, "theme.action.select");
        action.disabled = theme.id === this.progress.settings.themeId;
        action.addEventListener("click", () => {
          this.audio.unlock();
          this.audio.playButton();
          this.progress.settings.themeId = theme.id;
          this.applySettings();
          this.renderThemes();
        });
      } else if (this.progress.tokens >= theme.price) {
        action.textContent = t(lang, "theme.action.buy", { price: theme.price });
        action.addEventListener("click", () => {
          this.audio.unlock();
          this.audio.playButton();
          this.progress.tokens -= theme.price;
          this.progress.themesUnlocked.push(theme.id);
          this.progress.settings.themeId = theme.id;
          logger.info("purchaseTheme", { themeId: theme.id });
          this.applySettings();
          this.updateMenuStats();
          this.renderThemes();
        });
      } else {
        action.textContent = t(lang, "theme.action.need", { price: theme.price });
        action.disabled = true;
      }

      card.appendChild(preview);
      card.appendChild(title);
      card.appendChild(cost);
      card.appendChild(action);
      this.elements.themesGrid.appendChild(card);
    }
  }

  private defaultProgress(): ProgressState {
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    return {
      bestScore: 0,
      tokens: 0,
      themesUnlocked: ["lume"],
      runsCount: 0,
      settings: {
        sfxEnabled: true,
        musicEnabled: true,
        tapToPlace: isTouch,
        themeId: "lume",
        language: "en"
      }
    };
  }
}
