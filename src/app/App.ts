import { createDailySeed, dailyBestKey, formatDateKey } from "../core/daily";
import { applyPlacement, canPlace, getValidOrigins, placementOccupiesCell } from "../core/board";
import { claimLoginReward, getLoginRewardStatus } from "../core/loginRewards";
import { tokensFromScore } from "../core/game";
import { createSeededRng } from "../core/rng";
import { ActivePiece, GameMode, Point } from "../core/types";
import { AudioManager } from "./AudioManager";
import { DebugOverlay } from "./DebugOverlay";
import { GameSession } from "./GameSession";
import { getNextPlacementOrigin, type NavigationDirection } from "./keyboardPlacement";
import { Renderer, type RendererState } from "./Renderer";
import { ScreenManager } from "./ScreenManager";
import { ThemeManager, THEMES } from "./ThemeManager";
import { Toast } from "./Toast";
import { getTutorialStep, getTutorialStepsCount, isTutorialTargetMove, TutorialStep } from "./tutorial";
import { logger } from "../utils/logger";
import type { PlatformBridge, PlatformPlayerProfile, RewardedKind } from "../platform/bridge";
import { LeaderboardService, type LeaderboardMeta } from "./LeaderboardService";
import { StorageService } from "../services/storage";
import { applyTranslations, getDefaultLanguage, Language, normalizeLanguage, t } from "./i18n";
import {
  createEmptyLeaderboard,
  LeaderboardEntry,
  LeaderboardState,
  recordLeaderboardEntry
} from "./leaderboard";
import {
  createDefaultProgress,
  detectTouchSupport,
  normalizeStoredProgress,
  ProgressState
} from "./progress";

type ScreenId =
  | "loading"
  | "menu"
  | "game"
  | "pause"
  | "results"
  | "leaderboard"
  | "themes"
  | "settings";

const MENU_REWARD_TOKENS = 2;
const CONTINUE_MIN_SCORE = 800;
const UI_REFRESH_INTERVAL_MS = 500;

export class App {
  private screens!: ScreenManager;
  private renderer!: Renderer;
  private themeManager = new ThemeManager();
  private toast!: Toast;
  private debugOverlay!: DebugOverlay;
  private audio = new AudioManager();
  private platform: PlatformBridge;
  private storage!: StorageService;
  private leaderboardService!: LeaderboardService;
  private session: GameSession | null = null;
  private progress: ProgressState = createDefaultProgress({
    platformId: "generic",
    isTouch: detectTouchSupport()
  });
  private leaderboard: LeaderboardState = createEmptyLeaderboard();
  private leaderboardMeta: LeaderboardMeta = {
    overall: {
      source: "local",
      scope: "device",
      provider: null,
      submissionState: "unavailable"
    },
    daily: {
      source: "local",
      scope: "device",
      provider: null,
      submissionState: "unavailable"
    }
  };
  private platformPlayer: PlatformPlayerProfile = {
    supported: false,
    provider: null,
    authorized: false,
    displayName: null,
    avatarUrl: null,
    playerId: null
  };
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
  private runDurationMs = 0;
  private runBonusTokens = 0;
  private runDailyImproved = false;
  private runLeaderboardRank: number | null = null;
  private runDailyLeaderboardRank: number | null = null;
  private pendingLeaderboardEntry: LeaderboardEntry | null = null;
  private lastRecordedLeaderboardEntryId: string | null = null;
  private currentDailyKey = dailyBestKey(new Date());
  private currentDailyBest: number | null = null;
  private tutorialStepIndex = -1;
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
  private selectedInputMode: "tap" | "keyboard" | null = null;
  private selectedPlacementPreview:
    | {
        pieceId: string;
        origin: Point;
        placementsCount: number;
      }
    | null = null;
  private fpsSample = { last: 0, frames: 0, fps: 0 };
  private lastUiRefreshAt = 0;

  private elements = {
    canvas: document.getElementById("game-canvas") as HTMLCanvasElement,
    canvasWrap: document.querySelector(".canvas-wrap") as HTMLElement | null,
    hud: document.querySelector("#screen-game .hud") as HTMLElement | null,
    menuPlay: document.getElementById("btn-play") as HTMLButtonElement,
    menuBest: document.getElementById("menu-best") as HTMLElement,
    menuTokens: document.getElementById("menu-tokens") as HTMLElement,
    menuTutorial: document.getElementById("btn-tutorial") as HTMLButtonElement,
    menuLeaderboard: document.getElementById("btn-leaderboard") as HTMLButtonElement,
    resultsTitle: document.querySelector("#screen-results .title") as HTMLElement,
    menuReward: document.getElementById("btn-menu-reward") as HTMLButtonElement,
    menuRewardHint: document.getElementById("menu-reward-hint") as HTMLElement,
    menuDailyStatus: document.getElementById("menu-daily-status") as HTMLElement,
    menuLoginRewardStatus: document.getElementById("menu-login-reward-status") as HTMLElement,
    hudScore: document.getElementById("hud-score") as HTMLElement,
    hudCombo: document.getElementById("hud-combo") as HTMLElement,
    hudLevel: document.getElementById("hud-level") as HTMLElement,
    hudLevelGoal: document.getElementById("hud-level-goal") as HTMLElement,
    hudOptions: document.getElementById("hud-options") as HTMLElement,
    hudOptionsPill: document.getElementById("hud-options-pill") as HTMLElement | null,
    hudTokens: document.getElementById("hud-tokens") as HTMLElement,
    gameHintWrap: document.getElementById("game-hint-wrap") as HTMLElement | null,
    gameHint: document.getElementById("game-tutorial-hint") as HTMLElement,
    resultsScore: document.getElementById("results-score") as HTMLElement,
    resultsBest: document.getElementById("results-best") as HTMLElement,
    resultsTokens: document.getElementById("results-tokens") as HTMLElement,
    resultsLines: document.getElementById("results-lines") as HTMLElement,
    resultsMoves: document.getElementById("results-moves") as HTMLElement,
    resultsLevel: document.getElementById("results-level") as HTMLElement,
    resultsDuration: document.getElementById("results-duration") as HTMLElement,
    resultsPeakCombo: document.getElementById("results-peak-combo") as HTMLElement,
    resultsBestClear: document.getElementById("results-best-clear") as HTMLElement,
    resultsSummary: document.getElementById("results-summary") as HTMLElement,
    resultsHint: document.getElementById("results-hint") as HTMLElement,
    leaderboardAllTime: document.getElementById("leaderboard-all-time") as HTMLElement,
    leaderboardDaily: document.getElementById("leaderboard-daily") as HTMLElement,
    leaderboardHint: document.getElementById("leaderboard-hint") as HTMLElement,
    leaderboardSourceBadge: document.getElementById("leaderboard-source-badge") as HTMLElement,
    leaderboardClear: document.getElementById("btn-leaderboard-clear") as HTMLButtonElement,
    adblockBanner: document.getElementById("adblock-banner") as HTMLElement,
    themesGrid: document.getElementById("themes-grid") as HTMLElement,
    settingMusic: document.getElementById("setting-music") as HTMLInputElement,
    settingSfx: document.getElementById("setting-sfx") as HTMLInputElement,
    settingTap: document.getElementById("setting-tap") as HTMLInputElement,
    settingPlayerName: document.getElementById("setting-player-name") as HTMLInputElement,
    settingUsePlatformName: document.getElementById("setting-use-platform-name") as HTMLInputElement | null,
    settingsAccount: document.getElementById("settings-account") as HTMLElement | null,
    settingsAccountStatus: document.getElementById("settings-account-status") as HTMLElement | null,
    settingsAccountHint: document.getElementById("settings-account-hint") as HTMLElement | null,
    settingsAccountAuth: document.getElementById("btn-settings-account-auth") as HTMLButtonElement | null,
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
      leaderboard: document.getElementById("screen-leaderboard") as HTMLElement,
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
    this.leaderboardService = new LeaderboardService(this.storage, this.platform);
    await this.loadProgress();
    await this.refreshPlatformPlayer({ syncName: true });
    this.applyLanguage();
    this.configureLanguageSetting();

    const theme = this.themeManager.setTheme(this.progress.settings.themeId);
    this.renderer = new Renderer(this.elements.canvas, theme, {
      board: this.session?.state.board ?? Array.from({ length: 10 }, () => Array(10).fill(0)),
      pieces: this.session?.pieces ?? [null, null, null],
      ...this.getRendererPieceMeta()
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
    const tutorial = document.getElementById("btn-tutorial");
    const daily = document.getElementById("btn-daily");
    const leaderboard = document.getElementById("btn-leaderboard");
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
    const leaderboardClear = document.getElementById("btn-leaderboard-clear");
    const leaderboardBack = document.getElementById("btn-leaderboard-back");
    const themesBack = document.getElementById("btn-themes-back");
    const settingsClose = document.getElementById("btn-settings-close");

    play?.addEventListener("click", () => this.handleButton(() => void this.startRun("play")));
    tutorial?.addEventListener("click", () => this.handleButton(() => void this.startRun("tutorial")));
    daily?.addEventListener("click", () => this.handleButton(() => void this.startRun("daily")));
    leaderboard?.addEventListener("click", () => this.handleButton(() => void this.openLeaderboard()));
    menuReward?.addEventListener("click", () => this.handleButton(() => void this.tryMenuRewarded()));
    themes?.addEventListener("click", () => this.handleButton(() => this.openThemes()));
    settings?.addEventListener("click", () => this.handleButton(() => void this.openSettings("menu")));
    pause?.addEventListener("click", () => this.handleButton(() => this.pauseGame()));
    resume?.addEventListener("click", () => this.handleButton(() => this.resumeGame()));
    restart?.addEventListener("click", () => this.handleButton(() => this.restartRun()));
    pauseMenu?.addEventListener("click", () => this.handleButton(() => this.returnToMenu()));
    pauseSettings?.addEventListener("click", () => this.handleButton(() => void this.openSettings("pause")));
    resultsMenu?.addEventListener("click", () => this.handleButton(() => this.returnToMenu()));
    playAgain?.addEventListener("click", () => this.handleButton(() => void this.playAgain()));
    continueBtn?.addEventListener("click", () => this.handleButton(() => this.tryContinue()));
    doubleBtn?.addEventListener("click", () => this.handleButton(() => this.tryDoubleTokens()));
    leaderboardClear?.addEventListener("click", () => this.handleButton(() => void this.clearLeaderboard()));
    leaderboardBack?.addEventListener("click", () => this.handleButton(() => this.showScreen("menu")));
    themesBack?.addEventListener("click", () => this.handleButton(() => this.showScreen("menu")));
    settingsClose?.addEventListener("click", () => this.handleButton(() => this.closeSettings()));
    this.elements.settingsAccountAuth?.addEventListener("click", () =>
      this.handleButton(() => void this.requestOptionalPlatformAuth())
    );

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

    this.elements.settingPlayerName.addEventListener("input", () => {
      this.progress.settings.playerName = this.sanitizePlayerName(this.elements.settingPlayerName.value, {
        trimStart: true
      });
      if (this.elements.settingPlayerName.value !== this.progress.settings.playerName) {
        this.elements.settingPlayerName.value = this.progress.settings.playerName;
      }
      this.saveProgress();
    });
    this.elements.settingUsePlatformName?.addEventListener("change", () => {
      this.progress.settings.usePlatformPlayerName = Boolean(this.elements.settingUsePlatformName?.checked);
      this.updatePlayerNameField();
      this.renderPlatformAccount();
      void this.saveProgress();
    });

    document.addEventListener("visibilitychange", () => this.handleVisibilityChange());
    document.addEventListener("keydown", (event) => this.onKeyDown(event));
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
    this.elements.canvas.addEventListener(
      "pointercancel",
      (event) => this.onPointerCancel(event),
      pointerOptions
    );
  }

  private handleButton(action: () => void): void {
    this.audio.unlock();
    this.audio.playButton();
    action();
  }

  private async loadProgress(): Promise<void> {
    const todayDailyKey = dailyBestKey(new Date());
    const dateKey = formatDateKey(new Date());
    const [
      bestScore,
      tokens,
      themesUnlocked,
      runsCount,
      tutorialCompleted,
      loginReward,
      settings,
      platformLanguage
    ] =
      await Promise.all([
        this.storage.getOptional<unknown>("bestScore"),
        this.storage.getOptional<unknown>("tokens"),
        this.storage.getOptional<unknown>("themesUnlocked"),
        this.storage.getOptional<unknown>("runsCount"),
        this.storage.getOptional<unknown>("tutorialCompleted"),
        this.storage.getOptional<unknown>("loginReward"),
        this.storage.getOptional<unknown>("settings"),
        this.platform.getLanguage()
      ]);
    this.currentDailyKey = todayDailyKey;
    this.currentDailyBest = await this.storage.getOptional<number>(todayDailyKey);
    const leaderboardLoad = await this.leaderboardService.load(dateKey);
    this.leaderboard = leaderboardLoad.state;
    this.leaderboardMeta = leaderboardLoad.meta;

    this.progress = normalizeStoredProgress(
      {
        bestScore,
        tokens,
        themesUnlocked,
        runsCount,
        tutorialCompleted,
        loginReward,
        settings
      },
      {
        platformId: this.platform.id,
        platformLanguage,
        isTouch: detectTouchSupport()
      }
    );

    this.elements.settingMusic.checked = this.progress.settings.musicEnabled;
    this.elements.settingSfx.checked = this.progress.settings.sfxEnabled;
    this.elements.settingTap.checked = this.progress.settings.tapToPlace;
    if (this.elements.settingUsePlatformName) {
      this.elements.settingUsePlatformName.checked = this.progress.settings.usePlatformPlayerName;
    }
    this.updatePlayerNameField();
    this.elements.settingLanguage.value = this.progress.settings.language;
    this.updateMenuStats();
  }

  private async saveLeaderboard(): Promise<void> {
    await this.leaderboardService.save(this.leaderboard);
  }

  private async saveProgress(): Promise<void> {
    await this.storage.set("bestScore", this.progress.bestScore);
    await this.storage.set("tokens", this.progress.tokens);
    await this.storage.set("themesUnlocked", this.progress.themesUnlocked);
    await this.storage.set("runsCount", this.progress.runsCount);
    await this.storage.set("tutorialCompleted", this.progress.tutorialCompleted);
    await this.storage.set("loginReward", this.progress.loginReward);
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

  private async refreshPlatformPlayer(options?: { syncName?: boolean }): Promise<void> {
    this.platformPlayer = await this.platform.getPlayerProfile();
    if (options?.syncName) {
      this.updatePlayerNameField();
    }
    this.renderPlatformAccount();
  }

  private renderPlatformAccount(): void {
    const card = this.elements.settingsAccount;
    const status = this.elements.settingsAccountStatus;
    const hint = this.elements.settingsAccountHint;
    const button = this.elements.settingsAccountAuth;
    const usePlatformName = this.elements.settingUsePlatformName;
    if (!card || !status || !hint || !button || !usePlatformName) {
      return;
    }
    const lang = this.progress.settings.language;
    const visible = this.platform.id === "yandex" && this.platformPlayer.supported;
    card.hidden = !visible;
    if (!visible) {
      return;
    }
    if (this.platformPlayer.authorized) {
      status.textContent = t(lang, "settings.account.connected", {
        name:
          this.platformPlayer.displayName ??
          t(lang, "settings.account.connected_fallback")
      });
      hint.textContent = t(lang, "settings.account.connected_hint");
      usePlatformName.checked = this.progress.settings.usePlatformPlayerName;
      usePlatformName.disabled = !this.hasPlatformDisplayName();
      button.hidden = true;
      return;
    }
    status.textContent = t(lang, "settings.account.guest");
    hint.textContent = t(lang, "settings.account.guest_hint");
    usePlatformName.checked = this.progress.settings.usePlatformPlayerName;
    usePlatformName.disabled = false;
    button.hidden = false;
    button.textContent = t(lang, "settings.account.sign_in");
  }

  private async requestOptionalPlatformAuth(): Promise<void> {
    const previousAuthorized = this.platformPlayer.authorized;
    await this.platform.requestPlayerAuth();
    await this.refreshPlatformPlayer({ syncName: true });
    await this.refreshLeaderboard();
    this.updateResults();
    this.updateResultsHints();
    const lang = this.progress.settings.language;
    if (this.platformPlayer.authorized && !previousAuthorized) {
      this.toast.show(t(lang, "toast.account_connected"));
      return;
    }
    if (!this.platformPlayer.authorized) {
      this.toast.show(t(lang, "toast.account_optional"));
    }
  }

  private handleVisibilityChange(forceHidden?: boolean): void {
    const hidden = forceHidden ?? document.hidden;
    if (hidden) {
      if (this.activeScreen === "game") {
        const keepSelection =
          this.selectedPieceId !== null &&
          this.dragging === null &&
          (this.progress.settings.tapToPlace || this.selectedInputMode === "keyboard");
        this.resetPointerInteraction({ clearSelection: !keepSelection });
      }
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
    } else if (this.activeScreen === "menu") {
      void this.syncMenuDailyState();
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

  private onKeyDown(event: KeyboardEvent): void {
    if (event.defaultPrevented || this.isEditableTarget(event.target)) {
      return;
    }

    if (this.activeScreen === "pause" && event.key === "Escape") {
      event.preventDefault();
      this.handleButton(() => this.resumeGame());
      return;
    }

    if (this.activeScreen !== "game" || !this.session) {
      return;
    }

    this.audio.unlock();

    if (event.key === "Escape") {
      event.preventDefault();
      if (this.selectedPieceId) {
        this.clearSelection();
      } else {
        this.handleButton(() => this.pauseGame());
      }
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      this.cycleKeyboardPiece(event.shiftKey ? -1 : 1);
      return;
    }

    const slotIndex = this.getKeyboardSlotIndex(event);
    if (slotIndex !== null) {
      event.preventDefault();
      this.selectPieceFromSlot(slotIndex);
      return;
    }

    const direction = this.getKeyboardDirection(event.key);
    if (direction) {
      event.preventDefault();
      this.moveSelectedPlacement(direction);
      return;
    }

    if (event.key === "Enter" || event.key === " " || event.code === "Space") {
      event.preventDefault();
      this.placeSelectedPieceFromKeyboard();
    }
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element) {
      return false;
    }
    const tagName = element.tagName;
    return (
      element.isContentEditable ||
      tagName === "BUTTON" ||
      tagName === "A" ||
      tagName === "INPUT" ||
      tagName === "TEXTAREA" ||
      tagName === "SELECT"
    );
  }

  private applyLanguage(): void {
    const lang = this.progress.settings.language;
    applyTranslations(lang);
    document.documentElement.lang = lang;
    document.title = t(lang, "title.full");
    this.elements.settingLanguage.value = lang;
    this.elements.settingPlayerName.placeholder = t(lang, "settings.player_name_placeholder");
    this.updatePlayerNameField();
    this.renderPlatformAccount();
    this.renderLeaderboard();
    this.renderThemes();
    this.updateTutorialCta();
    this.updateMenuDailyStatus();
    this.updateMenuLoginRewardStatus();
    this.updateMenuRewardState();
    this.updateGameHint();
    this.updateResults();
    this.updateResultsTitle();
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

  private isTutorialRun(): boolean {
    return this.session?.state.mode === "tutorial";
  }

  private getCurrentTutorialStep(): TutorialStep | null {
    if (!this.isTutorialRun() || this.tutorialStepIndex < 0) {
      return null;
    }
    return getTutorialStep(this.tutorialStepIndex);
  }

  private getTutorialGuideGhost():
    | {
        piece: TutorialStep["target"]["piece"];
        origin: Point;
      }
    | undefined {
    const step = this.getCurrentTutorialStep();
    if (!step) {
      return undefined;
    }
    return {
      piece: step.target.piece,
      origin: step.target.origin
    };
  }

  private loadTutorialStep(index: number): void {
    if (!this.session) {
      return;
    }
    const step = getTutorialStep(index);
    if (!step) {
      return;
    }
    this.tutorialStepIndex = index;
    this.session.setBoardAndPieces(step.board, step.pieces);
    this.selectedPieceId = null;
    this.selectedPlacementPreview = null;
    this.selectedInputMode = null;
    this.dragging = null;
    this.dragCandidate = null;
    this.activePointerId = null;
    this.renderer.setState({
      board: this.session.state.board,
      pieces: this.session.pieces,
      ...this.getRendererPieceMeta(),
      ghost: undefined,
      guideGhost: this.getTutorialGuideGhost(),
      dragging: undefined,
      selectedPieceId: null
    });
    this.updateHud();
    this.updateGameHint();
  }

  private updateGameHint(): void {
    const lang = this.progress.settings.language;
    const step = this.getCurrentTutorialStep();
    if (this.activeScreen !== "game") {
      this.setGameHint(null);
      return;
    }
    if (step) {
      this.setGameHint(
        t(lang, "tutorial.progress", {
          step: step.index + 1,
          total: step.total,
          message: t(lang, step.messageKey)
        })
      );
      return;
    }
    const preview = this.selectedPlacementPreview;
    if (preview && this.selectedPieceId === preview.pieceId) {
      this.setGameHint(
        t(
          lang,
          this.selectedInputMode === "keyboard"
            ? preview.placementsCount === 1
              ? "game.keyboard_hint.one"
              : "game.keyboard_hint.many"
            : preview.placementsCount === 1
              ? "game.tap_hint.one"
              : "game.tap_hint.many",
          preview.placementsCount === 1 ? undefined : { count: preview.placementsCount }
        )
      );
      return;
    }
    if (this.session && this.session.state.mode !== "tutorial") {
      const stats = this.session.getPlacementStats();
      if (stats.totalPlacements > 0 && stats.totalPlacements <= 4) {
        this.setGameHint(
          t(lang, "game.pressure.critical", {
            count: stats.totalPlacements
          })
        );
        return;
      }
      if (stats.placeablePieces === 1) {
        this.setGameHint(t(lang, "game.pressure.single_piece"));
        return;
      }
      this.setGameHint(
        t(lang, "game.level_progress", {
          level: this.session.state.level,
          progress: this.session.state.levelProgress,
          goal: this.session.state.levelGoal
        })
      );
      return;
    }
    this.setGameHint(null);
  }

  private setGameHint(message: string | null): void {
    const nextText = message ?? "";
    const shouldShow = nextText.length > 0;
    if (this.elements.gameHint.hidden !== !shouldShow) {
      this.elements.gameHint.hidden = !shouldShow;
    }
    if (this.elements.gameHint.textContent !== nextText) {
      this.elements.gameHint.textContent = nextText;
    }
  }

  private updateResultsTitle(): void {
    const lang = this.progress.settings.language;
    const key = this.isTutorialRun() ? "results.title.tutorial" : "results.title";
    this.elements.resultsTitle.textContent = t(lang, key);
  }

  private async startRun(mode: GameMode): Promise<void> {
    const now = Date.now();
    const date = new Date();
    const seed =
      mode === "daily" ? createDailySeed(date) : mode === "tutorial" ? "tutorial_v1" : `run_${now}`;
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
    this.runDurationMs = 0;
    this.runBonusTokens = 0;
    this.runDailyImproved = false;
    this.runLeaderboardRank = null;
    this.runDailyLeaderboardRank = null;
    this.pendingLeaderboardEntry = null;
    this.runDailyKey = mode === "daily" ? dailyBestKey(date) : null;
    this.runStartDailyBest = this.runDailyKey
      ? await this.storage.getOptional<number>(this.runDailyKey)
      : null;
    this.runFirstDaily = mode === "daily" && this.runStartDailyBest === null;
    this.tutorialStepIndex = mode === "tutorial" ? 0 : -1;
    this.selectedPieceId = null;
    this.selectedPlacementPreview = null;
    this.selectedInputMode = null;
    this.dragging = null;
    this.dragCandidate = null;
    this.activePointerId = null;

    logger.info("startSession", { mode, date: formatDateKey(date) });
    logger.info("startRun", { mode, seed });
    this.platform.track("startSession", { mode, date: formatDateKey(date) });
    this.platform.track("startRun", { mode, seed });
    if (mode !== "tutorial") {
      this.progress.runsCount += 1;
      await this.saveProgress();
    }

    if (mode === "tutorial") {
      this.loadTutorialStep(this.tutorialStepIndex);
    }

    this.updateHud();
    this.renderer.setState({
      board: this.session.state.board,
      pieces: this.session.pieces,
      ...this.getRendererPieceMeta(),
      ghost: undefined,
      guideGhost: this.getTutorialGuideGhost(),
      dragging: undefined,
      selectedPieceId: null
    });
    this.updateGameHint();
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

  private async openLeaderboard(): Promise<void> {
    this.showScreen("leaderboard");
    await this.refreshLeaderboard();
  }

  private async openSettings(returnTo: ScreenId): Promise<void> {
    this.returnScreen = returnTo;
    this.showScreen("settings");
    await this.refreshPlatformPlayer();
  }

  private closeSettings(): void {
    this.showScreen(this.returnScreen);
  }

  private showScreen(id: ScreenId): void {
    this.activeScreen = id;
    this.screens.show(id);
    if (id === "menu") {
      void this.syncMenuDailyState();
      this.updateMenuRewardState();
      this.updateTutorialCta();
    } else if (id === "leaderboard") {
      this.renderLeaderboard();
    } else if (id === "game") {
      this.elements.canvas.focus();
    }
    this.updateGameHint();
    this.updateResultsTitle();
  }

  private updateMenuStats(): void {
    this.elements.menuBest.textContent = `${this.progress.bestScore}`;
    this.elements.menuTokens.textContent = `${this.progress.tokens}`;
    this.updateTutorialCta();
    this.updateMenuDailyStatus();
    this.updateMenuLoginRewardStatus();
  }

  private renderLeaderboard(): void {
    this.renderLeaderboardMeta();
    this.renderLeaderboardList(this.elements.leaderboardAllTime, this.leaderboard.allTime, "overall");
    this.renderLeaderboardList(this.elements.leaderboardDaily, this.leaderboard.daily, "daily");
  }

  private async refreshLeaderboard(): Promise<void> {
    const leaderboardLoad = await this.leaderboardService.load(formatDateKey(new Date()));
    this.leaderboard = leaderboardLoad.state;
    this.leaderboardMeta = leaderboardLoad.meta;
    this.renderLeaderboard();
  }

  private renderLeaderboardMeta(): void {
    const lang = this.progress.settings.language;
    const overallMeta = this.leaderboardMeta.overall;
    const dailyMeta = this.leaderboardMeta.daily;
    const allLocal = overallMeta.source === "local" && dailyMeta.source === "local";
    const allPlatform = overallMeta.source === "platform" && dailyMeta.source === "platform";
    const hasLocalBoard = overallMeta.source === "local" || dailyMeta.source === "local";
    const needsPlatformAuth =
      overallMeta.submissionState === "auth_required" || dailyMeta.submissionState === "auth_required";
    const sourceKey = allPlatform
      ? this.getPlatformLeaderboardSourceKey(overallMeta.provider ?? dailyMeta.provider)
      : allLocal
        ? overallMeta.scope === "account" || dailyMeta.scope === "account"
          ? "leaderboard.source.account"
          : "leaderboard.source.device"
        : "leaderboard.source.mixed";
    const hintKey = allPlatform
      ? needsPlatformAuth
        ? "leaderboard.hint.platform_auth"
        : "leaderboard.hint.platform"
      : allLocal
        ? overallMeta.scope === "account" || dailyMeta.scope === "account"
          ? "leaderboard.hint.account"
          : "leaderboard.hint.device"
        : needsPlatformAuth
          ? "leaderboard.hint.mixed_auth"
          : "leaderboard.hint.mixed";
    this.elements.leaderboardSourceBadge.textContent = t(lang, sourceKey);
    this.elements.leaderboardHint.textContent = t(lang, hintKey);
    this.elements.leaderboardClear.hidden = !hasLocalBoard;
    if (hasLocalBoard) {
      this.elements.leaderboardClear.textContent = t(
        lang,
        allLocal ? "leaderboard.clear" : "leaderboard.clear_local"
      );
    }
  }

  private getPlatformLeaderboardSourceKey(provider: LeaderboardMeta["overall"]["provider"]): string {
    if (provider === "yandex") {
      return "leaderboard.source.platform.yandex";
    }
    return "leaderboard.source.platform";
  }

  private renderLeaderboardList(
    container: HTMLElement,
    entries: LeaderboardEntry[],
    board: "overall" | "daily"
  ): void {
    if (!container) {
      return;
    }
    const lang = this.progress.settings.language;
    container.innerHTML = "";

    if (entries.length === 0) {
      const empty = document.createElement("p");
      empty.className = "leaderboard-empty";
      empty.textContent = t(
        lang,
        board === "overall" ? "leaderboard.empty.overall" : "leaderboard.empty.daily"
      );
      container.appendChild(empty);
      return;
    }

    const list = document.createElement("ol");
    list.className = "leaderboard-list";

    entries.forEach((entry, index) => {
      const item = document.createElement("li");
      item.className = "leaderboard-item";
      item.classList.toggle("leaderboard-item--latest", entry.id === this.lastRecordedLeaderboardEntryId);

      const rank = document.createElement("span");
      rank.className = "leaderboard-rank";
      rank.textContent = `#${index + 1}`;

      const body = document.createElement("div");
      body.className = "leaderboard-body";

      const head = document.createElement("div");
      head.className = "leaderboard-head";

      const identity = document.createElement("div");
      identity.className = "leaderboard-identity";

      const score = document.createElement("strong");
      score.className = "leaderboard-score";
      score.textContent = `${entry.score}`;

      const player = document.createElement("span");
      player.className = "leaderboard-player";
      player.textContent = this.getDisplayPlayerName(entry.playerName);

      identity.appendChild(score);
      identity.appendChild(player);

      const mode = document.createElement("span");
      mode.className = `leaderboard-tag leaderboard-tag--${entry.mode}`;
      mode.textContent = t(lang, `leaderboard.mode.${entry.mode}`);

      head.appendChild(identity);
      head.appendChild(mode);

      const meta = document.createElement("span");
      meta.className = "leaderboard-meta";
      meta.textContent = t(lang, "leaderboard.entry_meta", {
        level: entry.level,
        lines: entry.lines,
        date: this.formatLeaderboardDate(entry.dateKey)
      });

      body.appendChild(head);
      body.appendChild(meta);
      item.appendChild(rank);
      item.appendChild(body);
      list.appendChild(item);
    });

    container.appendChild(list);
  }

  private getDisplayPlayerName(playerName: string): string {
    return playerName.trim().length > 0
      ? playerName
      : t(this.progress.settings.language, "leaderboard.player_fallback");
  }

  private formatLeaderboardDate(dateKey: string): string {
    if (dateKey.length !== 8) {
      return dateKey;
    }
    return `${dateKey.slice(0, 4)}-${dateKey.slice(4, 6)}-${dateKey.slice(6, 8)}`;
  }

  private async clearLeaderboard(): Promise<void> {
    const lang = this.progress.settings.language;
    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm(t(lang, "leaderboard.clear_confirm"));
    if (!confirmed) {
      return;
    }
    const cleared = await this.leaderboardService.clear(formatDateKey(new Date()));
    this.leaderboard = cleared.state;
    this.leaderboardMeta = cleared.meta;
    this.lastRecordedLeaderboardEntryId = null;
    this.renderLeaderboard();
    this.toast.show(t(lang, "leaderboard.clear_done"));
  }

  private updateMenuDailyStatus(): void {
    const lang = this.progress.settings.language;
    this.elements.menuDailyStatus.textContent =
      this.currentDailyBest === null
        ? t(lang, "menu.daily_status.empty")
        : t(lang, "menu.daily_status.best", { score: this.currentDailyBest });
  }

  private updateMenuLoginRewardStatus(): void {
    const lang = this.progress.settings.language;
    const reward = getLoginRewardStatus(this.progress.loginReward, new Date());
    this.elements.menuLoginRewardStatus.textContent = reward.claimedToday
      ? t(lang, "menu.login_reward.claimed", {
          day: reward.day,
          count: reward.tokens,
          nextDay: reward.nextDay,
          nextCount: reward.nextTokens
        })
      : t(lang, "menu.login_reward.ready", {
          day: reward.day,
          count: reward.tokens
        });
  }

  private async refreshCurrentDailyBest(): Promise<void> {
    if (!this.storage) {
      return;
    }
    const todayKey = dailyBestKey(new Date());
    if (todayKey !== this.currentDailyKey) {
      this.currentDailyKey = todayKey;
      this.currentDailyBest = await this.storage.getOptional<number>(todayKey);
      this.updateMenuDailyStatus();
      return;
    }
    if (this.activeScreen === "menu") {
      this.updateMenuDailyStatus();
    }
  }

  private async syncMenuDailyState(): Promise<void> {
    await this.refreshCurrentDailyBest();
    await this.syncLoginReward();
  }

  private async syncLoginReward(): Promise<void> {
    if (!this.storage) {
      return;
    }

    const now = new Date();
    const reward = claimLoginReward(this.progress.loginReward, now);
    if (!reward.granted) {
      this.updateMenuLoginRewardStatus();
      return;
    }

    this.progress.loginReward = reward.state;
    this.progress.tokens += reward.tokens;
    await this.saveProgress();
    this.updateMenuStats();

    const lang = this.progress.settings.language;
    this.toast.show(t(lang, "toast.login_reward", { day: reward.day, count: reward.tokens }));
    logger.info("loginRewardClaimed", {
      day: reward.day,
      rewardTokens: reward.tokens,
      date: formatDateKey(now)
    });
    this.platform.track("loginRewardClaimed", {
      day: reward.day,
      rewardTokens: reward.tokens,
      date: formatDateKey(now)
    });
  }

  private updateTutorialCta(): void {
    const lang = this.progress.settings.language;
    const isCompleted = this.progress.tutorialCompleted;
    this.elements.menuTutorial.textContent = t(
      lang,
      isCompleted ? "menu.tutorial_replay" : "menu.tutorial"
    );
    this.elements.menuTutorial.classList.toggle("primary", !isCompleted);
    this.elements.menuPlay.classList.toggle("primary", isCompleted);
    this.elements.menuTutorial.title = isCompleted ? t(lang, "menu.tutorial_done") : "";
  }

  private updateHud(): void {
    if (!this.session) {
      return;
    }
    const stats = this.session.getPlacementStats();
    this.elements.hudScore.textContent = `${this.session.state.score}`;
    this.elements.hudCombo.textContent = `x${this.session.state.combo.toFixed(2)}`;
    this.elements.hudLevel.textContent = `${this.session.state.level}`;
    this.elements.hudLevelGoal.textContent = `${this.session.state.levelProgress} / ${this.session.state.levelGoal}`;
    this.elements.hudOptions.textContent = `${stats.totalPlacements}`;
    this.elements.hudTokens.textContent = `${this.progress.tokens}`;
    this.elements.hudOptionsPill?.classList.toggle("pill--warning", stats.totalPlacements > 4 && stats.totalPlacements <= 12);
    this.elements.hudOptionsPill?.classList.toggle("pill--critical", stats.totalPlacements > 0 && stats.totalPlacements <= 4);
  }

  private updateResults(): void {
    this.elements.resultsScore.textContent = `${this.session?.state.score ?? 0}`;
    const bestDisplay = Math.max(this.progress.bestScore, this.pendingBestScore);
    this.elements.resultsBest.textContent = `${bestDisplay}`;
    this.elements.resultsTokens.textContent = `${this.runTokens}`;
    this.elements.resultsLines.textContent = `${this.session?.state.linesCleared ?? 0}`;
    this.elements.resultsMoves.textContent = `${this.session?.state.moves ?? 0}`;
    this.elements.resultsLevel.textContent = `${this.session?.state.level ?? 1}`;
    this.elements.resultsDuration.textContent =
      this.runDurationMs > 0 ? this.formatDuration(this.runDurationMs) : "0:00";
    this.elements.resultsPeakCombo.textContent = `x${(this.session?.state.peakCombo ?? 1).toFixed(2)}`;
    this.elements.resultsBestClear.textContent = `${this.session?.state.bestClear ?? 0}`;
    this.updateResultsSummary();
  }

  private updateResultsSummary(): void {
    if (!this.session || this.session.state.mode === "tutorial") {
      this.elements.resultsSummary.hidden = true;
      this.elements.resultsSummary.textContent = "";
      return;
    }
    const lang = this.progress.settings.language;
    const items: string[] = [];

    if (this.runNewBest) {
      items.push(t(lang, "results.summary.new_best"));
    }
    if (this.session.state.mode === "daily") {
      if (this.runDailyImproved) {
        items.push(
          t(
            lang,
            this.runStartDailyBest === null
              ? "results.summary.daily_first"
              : "results.summary.daily_best"
          )
        );
      } else if (this.pendingDailyBest !== null) {
        items.push(t(lang, "results.summary.daily_current", { score: this.pendingDailyBest }));
      }
    }
    items.push(t(lang, "results.summary.level", { level: this.session.state.level }));
    if (this.runLeaderboardRank !== null) {
      items.push(t(lang, "results.summary.leaderboard", { rank: this.runLeaderboardRank }));
    }
    if (this.runDailyLeaderboardRank !== null) {
      items.push(
        t(lang, "results.summary.daily_leaderboard", { rank: this.runDailyLeaderboardRank })
      );
    }
    if (this.runBonusTokens > 0) {
      items.push(t(lang, "results.summary.token_bonus", { count: this.runBonusTokens }));
    }
    if (this.session.doubleTokensUsed) {
      items.push(t(lang, "results.summary.double_applied"));
    }

    this.elements.resultsSummary.hidden = items.length === 0;
    this.elements.resultsSummary.textContent = items.join(" • ");
  }

  private buildPendingLeaderboardEntry(duration: number): LeaderboardEntry | null {
    if (!this.session || this.session.state.mode === "tutorial") {
      return null;
    }

    const createdAt = Date.now();
    const dateKey = formatDateKey(new Date(createdAt));
    return {
      id: `${this.session.state.mode}_${createdAt}_${this.session.state.seed}`,
      playerName: this.getEffectivePlayerName(),
      score: this.session.state.score,
      mode: this.session.state.mode,
      level: this.session.state.level,
      lines: this.session.state.linesCleared,
      moves: this.session.state.moves,
      durationMs: duration,
      seed: this.session.state.seed,
      createdAt,
      dateKey
    };
  }

  private isRewardedAvailable(): boolean {
    return this.platform.id !== "generic";
  }

  private sanitizePlayerName(
    value: string,
    options?: {
      trimStart?: boolean;
    }
  ): string {
    const normalized = value.replace(/\s+/g, " ");
    const trimmed = options?.trimStart ? normalized.trimStart() : normalized.trim();
    return trimmed.slice(0, 18);
  }

  private hasPlatformDisplayName(): boolean {
    return this.sanitizePlayerName(this.platformPlayer.displayName ?? "").length > 0;
  }

  private shouldUsePlatformPlayerName(): boolean {
    return this.progress.settings.usePlatformPlayerName && this.hasPlatformDisplayName();
  }

  private getEffectivePlayerName(): string {
    if (this.shouldUsePlatformPlayerName()) {
      return this.sanitizePlayerName(this.platformPlayer.displayName ?? "");
    }
    return this.progress.settings.playerName;
  }

  private updatePlayerNameField(): void {
    const usePlatformName = this.shouldUsePlatformPlayerName();
    this.elements.settingPlayerName.value = usePlatformName
      ? this.getEffectivePlayerName()
      : this.progress.settings.playerName;
    this.elements.settingPlayerName.disabled = usePlatformName;
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
      this.elements.menuReward.title = "";
      this.elements.menuRewardHint.hidden = true;
      this.elements.menuRewardHint.textContent = "";
      return;
    }
    const lang = this.progress.settings.language;
    const eligibility = this.getMenuRewardEligibility();
    this.elements.menuReward.hidden = false;
    this.elements.menuReward.disabled = !eligibility.ok;
    let hint = t(lang, "hint.menu_reward", { count: MENU_REWARD_TOKENS });
    if (eligibility.reason === "rewarded_cooldown") {
      const cooldowns = this.platform.getCooldownStatus();
      const remainingMs = Math.max(0, cooldowns.rewardedAvailableAt - Date.now());
      hint = t(lang, "hint.rewarded_ready_in", {
        time: this.formatDuration(remainingMs)
      });
    } else if (eligibility.reason === "ads_unavailable") {
      hint = t(lang, "hint.ads_unavailable");
    }
    this.elements.menuReward.title = hint;
    this.elements.menuRewardHint.textContent = hint;
    this.elements.menuRewardHint.hidden = hint.length === 0;
  }

  private getContinueEligibility(): { ok: boolean; reason?: string } {
    if (!this.session) {
      return { ok: false, reason: "no_session" };
    }
    if (this.session.state.mode === "tutorial") {
      return { ok: false, reason: "tutorial_mode" };
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
    if (this.session.state.score < CONTINUE_MIN_SCORE) {
      return { ok: false, reason: "score_low" };
    }
    if (!this.session.canOfferContinue()) {
      return { ok: false, reason: "no_space" };
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
    if (this.session.state.mode === "tutorial") {
      return { ok: false, reason: "tutorial_mode" };
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

    if (mode === "tutorial") {
      this.runDurationMs = duration;
      this.runBonusTokens = 0;
      this.runDailyImproved = false;
      this.runLeaderboardRank = null;
      this.runDailyLeaderboardRank = null;
      this.pendingLeaderboardEntry = null;
      this.progress.tutorialCompleted = true;
      this.runTokens = 0;
      this.runNewBest = false;
      this.pendingBestScore = this.progress.bestScore;
      this.pendingDailyBest = null;
      await this.saveProgress();
      this.updateMenuStats();
      this.updateResults();
      this.updateResultsTitle();
      this.platform.track("completeTutorial", {
        steps: getTutorialStepsCount(),
        duration
      });
      this.platform.gameplayStop();
      this.audio.stopMusic();
      this.audio.playCombo();
      this.showScreen("results");
      this.updateResultsHints();
      return;
    }

    const baseTokens = tokensFromScore(score);
    this.runDurationMs = duration;
    this.runNewBest = score > this.runStartBestScore;
    this.pendingBestScore = this.runNewBest ? score : this.runStartBestScore;

    if (mode === "daily") {
      const dailyBest = this.runStartDailyBest;
      this.runDailyImproved = dailyBest === null || score > dailyBest;
      this.pendingDailyBest =
        dailyBest === null || score > dailyBest ? score : (dailyBest as number);
    } else {
      this.runDailyImproved = false;
      this.pendingDailyBest = null;
    }

    const bonus = (this.runNewBest ? 2 : 0) + (this.runFirstDaily ? 3 : 0);
    this.runBonusTokens = bonus;
    this.runTokens = baseTokens + bonus;
    this.pendingLeaderboardEntry = this.buildPendingLeaderboardEntry(duration);
    if (this.pendingLeaderboardEntry) {
      const preview = recordLeaderboardEntry(this.leaderboard, this.pendingLeaderboardEntry);
      this.runLeaderboardRank = preview.overallRank;
      this.runDailyLeaderboardRank = preview.dailyRank;
    } else {
      this.runLeaderboardRank = null;
      this.runDailyLeaderboardRank = null;
    }
    this.updateResults();

    logger.info("endRun", {
      score,
      lines: this.session.state.linesCleared,
      duration
    });
    this.platform.track("endRun", {
      mode,
      seed: this.session.state.seed,
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
    // Lock early to prevent duplicate token grants on rapid repeated calls.
    this.runFinalized = true;
    if (this.session?.state.mode === "tutorial") {
      return;
    }
    if (this.runNewBest) {
      this.progress.bestScore = Math.max(this.progress.bestScore, this.pendingBestScore);
    }
    if (this.runDailyKey && this.pendingDailyBest !== null) {
      if (this.runDailyKey === this.currentDailyKey) {
        this.currentDailyBest = this.pendingDailyBest;
      }
    }
    if (this.pendingLeaderboardEntry) {
      const recorded = recordLeaderboardEntry(this.leaderboard, this.pendingLeaderboardEntry);
      this.leaderboard = recorded.state;
      this.lastRecordedLeaderboardEntryId =
        recorded.state.allTime.some((entry) => entry.id === this.pendingLeaderboardEntry?.id) ||
        recorded.state.daily.some((entry) => entry.id === this.pendingLeaderboardEntry?.id)
          ? this.pendingLeaderboardEntry.id
          : null;
    }
    this.progress.tokens += this.runTokens;
    if (this.runDailyKey && this.pendingDailyBest !== null) {
      await this.storage.set(this.runDailyKey, this.pendingDailyBest);
    }
    if (this.pendingLeaderboardEntry) {
      await this.saveLeaderboard();
      void this.leaderboardService.submit(this.pendingLeaderboardEntry);
    }
    await this.saveProgress();
    this.updateMenuStats();
  }

  private updateResultsHints(): void {
    if (!this.session) {
      return;
    }
    const continueBtn = document.getElementById("btn-continue") as HTMLButtonElement | null;
    const doubleBtn = document.getElementById("btn-double") as HTMLButtonElement | null;
    if (this.session.state.mode === "tutorial") {
      if (continueBtn) {
        continueBtn.hidden = true;
        continueBtn.disabled = true;
      }
      if (doubleBtn) {
        doubleBtn.hidden = true;
        doubleBtn.disabled = true;
      }
      this.elements.resultsHint.textContent = t(
        this.progress.settings.language,
        "results.tutorial_hint"
      );
      return;
    }
    const lang = this.progress.settings.language;
    const continueEligibility = this.getContinueEligibility();
    const doubleEligibility = this.getDoubleEligibility();
    const adsUnavailable =
      continueEligibility.reason === "ads_unavailable" &&
      doubleEligibility.reason === "ads_unavailable";

    if (continueBtn) {
      continueBtn.hidden = adsUnavailable;
      continueBtn.disabled = !continueEligibility.ok;
    }
    if (doubleBtn) {
      doubleBtn.hidden = adsUnavailable;
      doubleBtn.disabled = !doubleEligibility.ok;
    }

    const hints = new Set<string>();
    if (adsUnavailable) {
      this.elements.resultsHint.textContent = "";
      return;
    }
    if (!continueEligibility.ok) {
      if (continueEligibility.reason === "continue_cooldown") {
        const cooldowns = this.platform.getCooldownStatus();
        const remainingMs = Math.max(0, cooldowns.continueAvailableAt - Date.now());
        hints.add(
          t(lang, "hint.continue_ready_in", {
            time: this.formatDuration(remainingMs)
          })
        );
      } else if (continueEligibility.reason === "score_low") {
        hints.add(t(lang, "hint.continue_need_score", { score: CONTINUE_MIN_SCORE }));
      } else if (continueEligibility.reason === "no_space") {
        hints.add(t(lang, "hint.continue_no_space"));
      } else if (continueEligibility.reason === "already_used") {
        hints.add(t(lang, "hint.reward_already_used"));
      } else if (
        continueEligibility.reason !== "rewarded_cooldown" &&
        continueEligibility.reason !== "ads_unavailable"
      ) {
        hints.add(t(lang, "hint.continue_unavailable"));
      }
    } else {
      hints.add(t(lang, "hint.continue_reward"));
    }
    if (doubleEligibility.reason === "tokens_low") {
      hints.add(t(lang, "hint.double_need_tokens", { count: 2 }));
    } else if (doubleEligibility.reason === "already_used") {
      hints.add(t(lang, "hint.reward_already_used"));
    } else if (doubleEligibility.ok) {
      hints.add(t(lang, "hint.double_reward"));
    }
    const cooldownHint = this.getCooldownHint(continueEligibility, doubleEligibility, lang);
    if (cooldownHint) {
      hints.add(cooldownHint);
    }
    this.elements.resultsHint.textContent = Array.from(hints).join(" - ");
  }

  private getCooldownHint(
    continueEligibility: { ok: boolean; reason?: string },
    doubleEligibility: { ok: boolean; reason?: string },
    lang: Language
  ): string | null {
    const cooldowns = this.platform.getCooldownStatus();
    const remainingMs = Math.max(0, cooldowns.rewardedAvailableAt - Date.now());
    if (
      continueEligibility.reason === "rewarded_cooldown" ||
      doubleEligibility.reason === "rewarded_cooldown"
    ) {
      return t(lang, "hint.rewarded_ready_in", {
        time: this.formatDuration(remainingMs)
      });
    }
    return null;
  }

  private async tryMenuRewarded(): Promise<void> {
    const eligibility = this.getMenuRewardEligibility();
    const lang = this.progress.settings.language;
    if (!eligibility.ok) {
      this.platform.track("rewardedDenied", {
        kind: "rewarded",
        reason: eligibility.reason ?? "unavailable"
      });
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
    const lang = this.progress.settings.language;
    if (!eligibility.ok) {
      logger.warn("rewarded_denied", { reason: eligibility.reason ?? "continue_unavailable" });
      this.platform.track("rewardedDenied", {
        kind: "continue",
        reason: eligibility.reason ?? "continue_unavailable"
      });
      if (eligibility.reason === "ads_unavailable") {
        this.toast.show(t(lang, "toast.ad_unavailable"));
      } else if (eligibility.reason === "score_low") {
        this.toast.show(t(lang, "toast.continue_need_score", { score: CONTINUE_MIN_SCORE }));
      } else if (eligibility.reason === "no_space") {
        this.toast.show(t(lang, "toast.continue_no_space"));
      } else if (eligibility.reason === "already_used") {
        this.toast.show(t(lang, "toast.reward_already_used"));
      } else {
        this.toast.show(t(lang, "toast.continue_unavailable"));
      }
      return;
    }

    await this.requestRewarded("continue", () => {
      if (!this.session?.setContinuePieces()) {
        this.toast.show(t(lang, "toast.continue_no_space"));
        return;
      }
      this.platform.markContinueUsed();
      this.selectedPieceId = null;
      this.selectedPlacementPreview = null;
      this.selectedInputMode = null;
      this.runLeaderboardRank = null;
      this.runDailyLeaderboardRank = null;
      this.pendingLeaderboardEntry = null;
      this.saveProgress();
      this.updateHud();
      this.renderer.setState({
        board: this.session?.state.board ?? Array.from({ length: 10 }, () => Array(10).fill(0)),
        pieces: this.session?.pieces ?? [null, null, null],
        ...this.getRendererPieceMeta(),
        ghost: undefined,
        dragging: undefined,
        selectedPieceId: null
      });
      this.showScreen("game");
      this.audio.startMusic();
      this.platform.gameplayStart();
    });
    if (this.activeScreen === "results") {
      this.updateResultsHints();
    }
  }

  private async tryDoubleTokens(): Promise<void> {
    if (!this.session) {
      return;
    }
    const eligibility = this.getDoubleEligibility();
    if (!eligibility.ok) {
      logger.warn("rewarded_denied", { reason: eligibility.reason ?? "double_unavailable" });
      this.platform.track("rewardedDenied", {
        kind: "double_tokens",
        reason: eligibility.reason ?? "double_unavailable"
      });
      const lang = this.progress.settings.language;
      if (eligibility.reason === "ads_unavailable") {
        this.toast.show(t(lang, "toast.ad_unavailable"));
      } else if (eligibility.reason === "already_used") {
        this.toast.show(t(lang, "toast.reward_already_used"));
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
    if (this.activeScreen === "results") {
      this.updateResultsHints();
    }
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

  private getKeyboardSlotIndex(event: KeyboardEvent): number | null {
    if (event.key >= "1" && event.key <= "3") {
      return Number(event.key) - 1;
    }
    if (event.code === "Numpad1" || event.code === "Numpad2" || event.code === "Numpad3") {
      return Number(event.code.slice(-1)) - 1;
    }
    return null;
  }

  private getKeyboardDirection(key: string): NavigationDirection | null {
    if (key === "ArrowLeft") {
      return "left";
    }
    if (key === "ArrowRight") {
      return "right";
    }
    if (key === "ArrowUp") {
      return "up";
    }
    if (key === "ArrowDown") {
      return "down";
    }
    return null;
  }

  private clearSelection(): void {
    this.selectedPieceId = null;
    this.selectedPlacementPreview = null;
    this.selectedInputMode = null;
    this.renderer.setState({
      selectedPieceId: null,
      ghost: undefined
    });
    this.updateGameHint();
  }

  private selectPiece(
    pieceId: string,
    inputMode: "tap" | "keyboard",
    showBlockedToast: boolean
  ): boolean {
    const piece = this.session?.pieces.find((slot) => slot?.instanceId === pieceId) ?? null;
    if (!piece) {
      return false;
    }

    if (!this.isTutorialRun() && !this.isPiecePlaceable(piece)) {
      this.clearSelection();
      if (showBlockedToast) {
        this.toast.show(t(this.progress.settings.language, "toast.piece_no_room"));
      }
      return false;
    }

    const preview = this.isTutorialRun() ? null : this.getPlacementPreview(piece);
    if (!this.isTutorialRun() && !preview) {
      this.clearSelection();
      if (showBlockedToast) {
        this.toast.show(t(this.progress.settings.language, "toast.piece_no_room"));
      }
      return false;
    }

    this.selectedPieceId = pieceId;
    this.selectedPlacementPreview = preview;
    this.selectedInputMode = inputMode;
    this.renderer.setState({
      selectedPieceId: pieceId,
      ghost: preview
        ? {
            piece: piece.def,
            origin: preview.origin,
            valid: true
          }
        : undefined
    });
    this.updateGameHint();
    return true;
  }

  private selectPieceFromSlot(index: number): void {
    if (!this.session) {
      return;
    }
    const piece = this.session.pieces[index];
    if (!piece) {
      return;
    }
    this.audio.playButton();
    this.selectPiece(piece.instanceId, "keyboard", true);
  }

  private cycleKeyboardPiece(step: 1 | -1): void {
    if (!this.session) {
      return;
    }

    const candidates = this.session.pieces.filter((piece): piece is ActivePiece =>
      piece !== null && (this.isTutorialRun() || this.isPiecePlaceable(piece))
    );
    if (candidates.length === 0) {
      return;
    }

    const currentIndex = candidates.findIndex((piece) => piece.instanceId === this.selectedPieceId);
    const nextIndex =
      currentIndex === -1
        ? step === 1
          ? 0
          : candidates.length - 1
        : (currentIndex + step + candidates.length) % candidates.length;

    this.audio.playButton();
    this.selectPiece(candidates[nextIndex].instanceId, "keyboard", false);
  }

  private moveSelectedPlacement(direction: NavigationDirection): void {
    if (!this.session || this.isTutorialRun()) {
      return;
    }
    const piece = this.getSelectedPiece();
    const preview = this.selectedPlacementPreview;
    if (!piece || !preview) {
      return;
    }

    const origins = getValidOrigins(this.session.state.board, piece.def);
    if (origins.length === 0) {
      return;
    }

    const nextOrigin = getNextPlacementOrigin(origins, preview.origin, direction);
    if (nextOrigin.x === preview.origin.x && nextOrigin.y === preview.origin.y) {
      return;
    }

    this.selectedPlacementPreview = {
      pieceId: preview.pieceId,
      origin: nextOrigin,
      placementsCount: origins.length
    };
    this.renderer.setState({
      selectedPieceId: piece.instanceId,
      ghost: {
        piece: piece.def,
        origin: nextOrigin,
        valid: true
      }
    });
    this.updateGameHint();
  }

  private placeSelectedPieceFromKeyboard(): void {
    if (!this.session || !this.selectedPieceId) {
      return;
    }

    if (this.isTutorialRun()) {
      const step = this.getCurrentTutorialStep();
      const piece = this.getSelectedPiece();
      if (!step || !piece || piece.def.id !== step.target.pieceId) {
        return;
      }
      this.selectedPieceId = null;
      this.selectedPlacementPreview = null;
      this.selectedInputMode = null;
      this.commitPlacement(piece.instanceId, step.target.origin);
      this.renderer.setState({ selectedPieceId: null, ghost: undefined });
      this.updateGameHint();
      return;
    }

    const preview = this.selectedPlacementPreview;
    const piece = this.getSelectedPiece();
    if (!preview || !piece) {
      return;
    }

    this.selectedPieceId = null;
    this.selectedPlacementPreview = null;
    this.selectedInputMode = null;
    this.commitPlacement(piece.instanceId, preview.origin);
    this.renderer.setState({ selectedPieceId: null, ghost: undefined });
    this.updateGameHint();
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
    const piece = pieceId
      ? this.session.pieces.find((slot) => slot?.instanceId === pieceId) ?? null
      : null;

    if (piece && !this.isTutorialRun() && !this.isPiecePlaceable(piece)) {
      if (this.elements.canvas.releasePointerCapture) {
        this.elements.canvas.releasePointerCapture(event.pointerId);
      }
      this.clearSelection();
      this.dragCandidate = null;
      this.activePointerId = null;
      this.toast.show(t(this.progress.settings.language, "toast.piece_no_room"));
      return;
    }

    if (isTapMode) {
      if (pieceId) {
        const rect = this.renderer.getPieceRect(pieceId);
        if (!rect) {
          return;
        }
        if (!piece) {
          return;
        }
        if (!this.selectPiece(pieceId, "tap", true)) {
          this.dragCandidate = null;
          this.activePointerId = null;
          return;
        }
        this.activePointerId = event.pointerId;
        this.dragCandidate = {
          pieceId,
          start: point,
          offsetX: point.x - rect.x,
          offsetY: point.y - rect.y,
          pointerId: event.pointerId
        };
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
      if (!piece) {
        return;
      }
      this.activePointerId = event.pointerId;
      this.dragging = {
        pieceId,
        offsetX: point.x - rect.x,
        offsetY: point.y - rect.y
      };
      this.dragCandidate = null;
      this.selectedPieceId = null;
      this.selectedPlacementPreview = null;
      this.selectedInputMode = null;
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
        this.selectedPlacementPreview = null;
        this.selectedInputMode = null;
        this.updateGameHint();
        return;
      }
      this.dragging = {
        pieceId: piece.instanceId,
        offsetX: this.dragCandidate.offsetX,
        offsetY: this.dragCandidate.offsetY
      };
      this.dragCandidate = null;
      this.selectedPieceId = null;
      this.selectedPlacementPreview = null;
      this.selectedInputMode = null;
      const dragX = point.x - this.dragging.offsetX;
      const dragY = point.y - this.dragging.offsetY;
      const ghost = this.getGhostPlacement(piece, { x: dragX, y: dragY });
      this.renderer.setState({
        dragging: { pieceId: piece.instanceId, x: dragX, y: dragY },
        selectedPieceId: null,
        ghost
      });
      this.updateGameHint();
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

    this.resetPointerInteraction();
  }

  private onPointerCancel(event: PointerEvent): void {
    if (!this.session || this.activeScreen !== "game") {
      return;
    }
    if (this.activePointerId !== null && event.pointerId !== this.activePointerId) {
      return;
    }
    if (this.elements.canvas.hasPointerCapture?.(event.pointerId)) {
      this.elements.canvas.releasePointerCapture(event.pointerId);
    }
    const keepSelection =
      this.progress.settings.tapToPlace &&
      this.selectedPieceId !== null &&
      this.dragging === null &&
      this.dragCandidate !== null;
    this.resetPointerInteraction({ clearSelection: !keepSelection });
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
    const preview = this.selectedPlacementPreview;
    const previewMatchesSelection =
      preview !== null &&
      preview.pieceId === piece.instanceId &&
      placementOccupiesCell(piece.def, preview.origin, cell);
    if (!ghost || !ghost.valid) {
      if (previewMatchesSelection && preview) {
        this.selectedPieceId = null;
        this.selectedPlacementPreview = null;
        this.selectedInputMode = null;
        this.commitPlacement(piece.instanceId, preview.origin);
        this.renderer.setState({ selectedPieceId: null, ghost: undefined });
        this.updateGameHint();
        return;
      }
      this.audio.playFail();
      this.toast.show(t(this.progress.settings.language, "toast.cant_place"));
      return;
    }
    this.selectedPieceId = null;
    this.selectedPlacementPreview = null;
    this.selectedInputMode = null;
    this.commitPlacement(piece.instanceId, ghost.origin);
    this.renderer.setState({ selectedPieceId: null, ghost: undefined });
    this.updateGameHint();
  }

  private commitPlacement(pieceId: string, origin: Point): void {
    if (!this.session) {
      return;
    }
    const tutorialStep = this.getCurrentTutorialStep();
    const tutorialPiece = this.session.pieces.find((slot) => slot?.instanceId === pieceId);
    if (
      tutorialStep &&
      (!tutorialPiece || !isTutorialTargetMove(tutorialStep, tutorialPiece.def.id, origin))
    ) {
      this.audio.playFail();
      this.toast.show(t(this.progress.settings.language, "toast.tutorial_follow_hint"));
      return;
    }
    const result = this.session.placePiece(pieceId, origin);
    if (!result) {
      this.audio.playFail();
      return;
    }
    this.selectedPlacementPreview = null;
    this.selectedInputMode = null;
    this.audio.playPlace();
    if (result.linesCleared > 0) {
      this.audio.playClear(result.linesCleared);
      if (result.linesCleared >= 2) {
        this.audio.playCombo();
      }
    }
    if (result.levelUps.length > 0 && result.linesCleared < 2) {
      this.audio.playCombo();
    }

    const flashRows = Array.from(new Set([...result.rows, ...result.pulseRows]));
    const flashCols = Array.from(new Set([...result.cols, ...result.pulseCols]));
    this.renderer.setState({
      board: result.state.board,
      pieces: this.session.pieces,
      ...this.getRendererPieceMeta(),
      guideGhost: undefined,
      flashLines: {
        rows: flashRows,
        cols: flashCols,
        until: performance.now() + 240
      }
    });

    if (result.levelUps.length > 0) {
      const latestLevelUp = result.levelUps[result.levelUps.length - 1];
      const lang = this.progress.settings.language;
      this.toast.show(
        t(lang, latestLevelUp.clearedCells > 0 ? "toast.level_up" : "toast.level_up_soft", {
          level: latestLevelUp.level
        })
      );
      for (const levelUp of result.levelUps) {
        logger.info("levelUp", {
          mode: result.state.mode,
          level: levelUp.level,
          pulseClearedCells: levelUp.clearedCells,
          score: result.state.score
        });
        this.platform.track("levelUp", {
          mode: result.state.mode,
          level: levelUp.level,
          pulseClearedCells: levelUp.clearedCells,
          score: result.state.score
        });
      }
    }

    this.updateHud();
    this.updateGameHint();

    if (this.handleTutorialProgression()) {
      return;
    }

    if (result.linesCleared >= 3 && result.state.combo >= 2.5) {
      this.triggerHappytime();
    }

    if (!this.session.canPlaceAny()) {
      void this.endRun();
    }
  }

  private handleTutorialProgression(): boolean {
    if (!this.session || this.session.state.mode !== "tutorial") {
      return false;
    }
    const nextStepIndex = this.tutorialStepIndex + 1;
    if (nextStepIndex >= getTutorialStepsCount()) {
      this.tutorialStepIndex = -1;
      this.renderer.setState({ guideGhost: undefined });
      void this.endRun();
      return true;
    }
    this.loadTutorialStep(nextStepIndex);
    this.toast.show(t(this.progress.settings.language, "toast.tutorial_step_complete"));
    return true;
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

  private getPlacementPreview(
    piece: ActivePiece
  ): { pieceId: string; origin: Point; placementsCount: number } | null {
    if (!this.session) {
      return null;
    }
    const origins = getValidOrigins(this.session.state.board, piece.def);
    if (origins.length === 0) {
      return null;
    }

    const boardCenter = 4.5;
    let bestOrigin = origins[0];
    let bestClears = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const origin of origins) {
      const placement = applyPlacement(this.session.state.board, piece.def, origin);
      if (!placement) {
        continue;
      }
      const centerX = origin.x + (piece.def.bounds.w - 1) / 2;
      const centerY = origin.y + (piece.def.bounds.h - 1) / 2;
      const distance = Math.abs(centerX - boardCenter) + Math.abs(centerY - boardCenter);
      if (
        placement.clearedCount > bestClears ||
        (placement.clearedCount === bestClears && distance < bestDistance) ||
        (placement.clearedCount === bestClears &&
          distance === bestDistance &&
          (origin.y < bestOrigin.y || (origin.y === bestOrigin.y && origin.x < bestOrigin.x)))
      ) {
        bestOrigin = origin;
        bestClears = placement.clearedCount;
        bestDistance = distance;
      }
    }

    return {
      pieceId: piece.instanceId,
      origin: bestOrigin,
      placementsCount: origins.length
    };
  }

  private isPiecePlaceable(piece: ActivePiece): boolean {
    if (!this.session) {
      return false;
    }
    return getValidOrigins(this.session.state.board, piece.def).length > 0;
  }

  private getSelectedPiece(): ActivePiece | null {
    if (!this.session || !this.selectedPieceId) {
      return null;
    }
    return this.session.pieces.find((slot) => slot?.instanceId === this.selectedPieceId) ?? null;
  }

  private getBlockedPieceIds(): string[] {
    const placementCounts = this.getPiecePlacementCounts();
    return Object.entries(placementCounts).flatMap(([pieceId, placements]) =>
      placements === 0 ? [pieceId] : []
    );
  }

  private getPiecePlacementCounts(): Record<string, number> {
    if (!this.session || this.isTutorialRun()) {
      return {};
    }
    return this.session.getPiecePlacementCounts();
  }

  private getRendererPieceMeta(): Pick<RendererState, "blockedPieceIds" | "placementCounts"> {
    const placementCounts = this.getPiecePlacementCounts();
    return {
      blockedPieceIds: this.getBlockedPieceIds(),
      placementCounts
    };
  }

  private getSelectedGhost():
    | {
        piece: ActivePiece["def"];
        origin: Point;
        valid: boolean;
      }
    | undefined {
    if (!this.session || !this.selectedPieceId || !this.selectedPlacementPreview) {
      return undefined;
    }
    if (this.selectedPlacementPreview.pieceId !== this.selectedPieceId) {
      return undefined;
    }
    const piece = this.session.pieces.find((slot) => slot?.instanceId === this.selectedPieceId);
    if (!piece) {
      return undefined;
    }
    return {
      piece: piece.def,
      origin: this.selectedPlacementPreview.origin,
      valid: true
    };
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

    const wrapRect = wrap.getBoundingClientRect();
    if (wrapRect.width <= 0 || wrapRect.height <= 0) {
      return;
    }

    const style = window.getComputedStyle(wrap);
    const horizontalPadding =
      parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const verticalPadding =
      parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const targetWidth = Math.max(wrapRect.width - horizontalPadding, 0);
    const targetHeight = Math.max(wrapRect.height - verticalPadding, 0);
    if (targetWidth <= 0 || targetHeight <= 0) {
      return;
    }

    canvas.style.width = `${Math.round(targetWidth)}px`;
    canvas.style.height = `${Math.round(targetHeight)}px`;
  }

  private loop(time: number): void {
    if (this.renderer) {
      this.renderer.render(time);
    }
    this.refreshTimeSensitiveUi(time);
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

  private refreshTimeSensitiveUi(time: number): void {
    if (time - this.lastUiRefreshAt < UI_REFRESH_INTERVAL_MS) {
      return;
    }
    this.lastUiRefreshAt = time;
    if (this.activeScreen === "menu") {
      this.updateMenuRewardState();
    }
    if (this.activeScreen === "results") {
      this.updateResultsHints();
    }
  }

  private formatDuration(ms: number): string {
    const totalSeconds = Math.max(1, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  private resetPointerInteraction(options?: { clearSelection?: boolean }): void {
    this.dragging = null;
    this.dragCandidate = null;
    this.activePointerId = null;
    if (options?.clearSelection) {
      this.selectedPieceId = null;
      this.selectedPlacementPreview = null;
      this.selectedInputMode = null;
      this.renderer.setState({
        dragging: undefined,
        ghost: undefined,
        selectedPieceId: null
      });
      this.updateGameHint();
      return;
    }
    this.renderer.setState({
      dragging: undefined,
      ghost: this.getSelectedGhost(),
      selectedPieceId: this.selectedPieceId
    });
    this.updateGameHint();
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
          this.platform.track("purchaseTheme", {
            themeId: theme.id,
            price: theme.price
          });
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

}
