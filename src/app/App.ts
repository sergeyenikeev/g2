import { createDailySeed, dailyBestKey, formatDateKey } from "../core/daily";
import { applyPlacement, canPlace, getValidOrigins, placementOccupiesCell } from "../core/board";
import {
  createDailySeedFromDateKey,
  dailyBestKeyFromDateKey,
  formatUtcDateKey,
  getMsUntilNextDailyReset
} from "../core/daily";
import {
  applyCompletedRunToDailyMissions,
  getDailyMissionStatuses,
  normalizeDailyMissionProgress,
  type DailyMissionDefinition
} from "../core/dailyMissions";
import {
  applyDailyCompletionToStreak,
  getDailyStreakStatus,
  type DailyStreakResolution
} from "../core/dailyStreak";
import {
  applyDailyCompletionToWeeklyLoop,
  getWeeklyLoopStatus,
  type WeeklyLoopResolution
} from "../core/weeklyLoop";
import { claimLoginReward, getLoginRewardStatus, getLoginRewardTrack } from "../core/loginRewards";
import { resolveMenuThemesCta } from "../core/menuThemes";
import {
  resolveJourneyProgress,
  type JourneyContext,
  type JourneyMilestoneDefinition
} from "../core/journey";
import {
  createDefaultPurchaseProfile,
  findStoreOfferByProductId,
  getStoreOffer,
  hasOfferProductOwnership,
  normalizeStoredPurchaseProfile,
  purchaseProfileDisablesAds,
  STORE_OFFERS,
  type PurchaseProfile,
  type StoreOfferId
} from "../core/purchases";
import {
  buildDefaultRemoteFlags,
  parseRemoteConfig,
  type StoreExperimentConfig
} from "../core/remoteConfig";
import { resolveResultsNextStep, type ResultsNextStep } from "../core/resultsNextStep";
import { resolveResultsReplayMode } from "../core/resultsReplay";
import { selectResultsOffer, type ResultsOfferSelection } from "../core/resultsOffers";
import { resolveResultsReturnPrompt } from "../core/resultsReturn";
import { tokensFromScore } from "../core/game";
import { createSeededRng } from "../core/rng";
import { ActivePiece, GameMode, Point } from "../core/types";
import { AudioManager } from "./AudioManager";
import { DebugOverlay } from "./DebugOverlay";
import { GameSession } from "./GameSession";
import { getNextPlacementOrigin, type NavigationDirection } from "./keyboardPlacement";
import { Renderer, type RendererState } from "./Renderer";
import { ScreenManager } from "./ScreenManager";
import { ThemeManager, THEMES, type Theme } from "./ThemeManager";
import { Toast } from "./Toast";
import { getTutorialStep, getTutorialStepsCount, isTutorialTargetMove, TutorialStep } from "./tutorial";
import { logger } from "../utils/logger";
import type {
  PlatformBridge,
  PlatformClientFeature,
  PlatformPlayerProfile,
  PlatformPurchaseProduct,
  RewardedKind
} from "../platform/bridge";
import { resolveMonetizationConfig, resolveYandexPurchaseProductIds } from "../platform/env";
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

const UI_REFRESH_INTERVAL_MS = 500;
const TRUSTED_TIME_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const STICKY_BANNER_SCREENS: ScreenId[] = ["menu", "results", "leaderboard", "themes"];
const PURCHASE_PROFILE_STORAGE_KEY = "purchaseProfile";

type ReviewRequestSource = "results_new_best" | "results_daily" | "theme_purchase";
type StoreScreenState = {
  supported: boolean;
  loading: boolean;
  hintKey: string;
  hintParams?: Record<string, string | number>;
  products: Map<string, PlatformPurchaseProduct>;
};

export class App {
  private screens!: ScreenManager;
  private renderer!: Renderer;
  private themeManager = new ThemeManager();
  private toast!: Toast;
  private debugOverlay!: DebugOverlay;
  private audio = new AudioManager();
  private platform: PlatformBridge;
  private monetization = resolveMonetizationConfig();
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
  private purchaseProfile: PurchaseProfile = createDefaultPurchaseProfile();
  private purchaseProductIds = resolveYandexPurchaseProductIds();
  private storeExperiment: StoreExperimentConfig = parseRemoteConfig(
    buildDefaultRemoteFlags(this.monetization),
    this.monetization
  ).store;
  private store: StoreScreenState = {
    supported: false,
    loading: false,
    hintKey: "store.hint.loading",
    products: new Map()
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
  private runDailyStreakRewardTokens = 0;
  private runDailyStreakDay = 0;
  private runWeeklyLoopRewardTokens = 0;
  private runWeeklyLoopDays = 0;
  private runWeeklyLoopGoalDays = 0;
  private runDailyImproved = false;
  private runLeaderboardRank: number | null = null;
  private runDailyLeaderboardRank: number | null = null;
  private pendingLeaderboardEntry: LeaderboardEntry | null = null;
  private pendingLeaderboardSubmitted = false;
  private lastRecordedLeaderboardEntryId: string | null = null;
  private currentDailyKey = dailyBestKey(new Date());
  private currentDailyBest: number | null = null;
  private trustedTimeOffsetMs: number | null = null;
  private lastTrustedTimeSyncAt = 0;
  private requestedStickyBannerVisible = false;
  private bannerSyncQueue: Promise<void> = Promise.resolve();
  private reviewPromptRequested = false;
  private menuDailySyncInFlight = false;
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
  private menuRewardOfferTracked = false;
  private resultsOffersTracked = false;
  private resultsAuthPromptTracked = false;
  private resultsStorePromptTracked = false;
  private leaderboardAuthPromptTracked = false;
  private themesStoreTracked = false;
  private runJourneyPreview: JourneyMilestoneDefinition[] = [];
  private runDailyMissionPreview: DailyMissionDefinition[] = [];
  private unsubscribePlatformEvents: (() => void) | null = null;
  private activePauseSources = new Set<"visibility" | "sdk">();
  private pausedGameplayByExternalSignal = false;
  private accountSelectionDialogOpen = false;

  private elements = {
    canvas: document.getElementById("game-canvas") as HTMLCanvasElement,
    canvasWrap: document.querySelector(".canvas-wrap") as HTMLElement | null,
    hud: document.querySelector("#screen-game .hud") as HTMLElement | null,
    menuPlay: document.getElementById("btn-play") as HTMLButtonElement,
    menuDaily: document.getElementById("btn-daily") as HTMLButtonElement,
    menuThemes: document.getElementById("btn-themes") as HTMLButtonElement,
    menuBest: document.getElementById("menu-best") as HTMLElement,
    menuTokens: document.getElementById("menu-tokens") as HTMLElement,
    menuTutorial: document.getElementById("btn-tutorial") as HTMLButtonElement,
    menuLeaderboard: document.getElementById("btn-leaderboard") as HTMLButtonElement,
    resultsTitle: document.querySelector("#screen-results .title") as HTMLElement,
    menuReward: document.getElementById("btn-menu-reward") as HTMLButtonElement,
    menuRewardHint: document.getElementById("menu-reward-hint") as HTMLElement,
    menuDailyStatus: document.getElementById("menu-daily-status") as HTMLElement,
    menuDailyResetStatus: document.getElementById("menu-daily-reset-status") as HTMLElement | null,
    menuDailyStreakStatus: document.getElementById("menu-daily-streak-status") as HTMLElement | null,
    menuWeeklyLoopStatus: document.getElementById("menu-weekly-loop-status") as HTMLElement | null,
    menuLoginRewardStatus: document.getElementById("menu-login-reward-status") as HTMLElement,
    menuLoginTrack: document.getElementById("menu-login-track") as HTMLElement | null,
    menuDailyMissions: document.getElementById("menu-daily-missions") as HTMLElement | null,
    menuGoalsList: document.getElementById("menu-goals-list") as HTMLElement | null,
    menuGoalsMeta: document.getElementById("menu-goals-meta") as HTMLElement | null,
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
    resultsReturnNote: document.getElementById("results-return-note") as HTMLElement | null,
    resultsHint: document.getElementById("results-hint") as HTMLElement,
    resultsAuth: document.getElementById("btn-results-auth") as HTMLButtonElement | null,
    resultsStore: document.getElementById("btn-results-store") as HTMLButtonElement | null,
    leaderboardAllTime: document.getElementById("leaderboard-all-time") as HTMLElement,
    leaderboardDaily: document.getElementById("leaderboard-daily") as HTMLElement,
    leaderboardHint: document.getElementById("leaderboard-hint") as HTMLElement,
    leaderboardSourceBadge: document.getElementById("leaderboard-source-badge") as HTMLElement,
    leaderboardClear: document.getElementById("btn-leaderboard-clear") as HTMLButtonElement,
    leaderboardAuth: document.getElementById("btn-leaderboard-auth") as HTMLButtonElement | null,
    adblockBanner: document.getElementById("adblock-banner") as HTMLElement,
    themesGrid: document.getElementById("themes-grid") as HTMLElement,
    storeSection: document.getElementById("themes-store-section") as HTMLElement | null,
    storeGrid: document.getElementById("shop-grid") as HTMLElement | null,
    storeHint: document.getElementById("shop-hint") as HTMLElement | null,
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
    this.unsubscribePlatformEvents?.();
    this.unsubscribePlatformEvents = this.platform.subscribeToPlatformEvents({
      pause: () => this.handlePlatformPause(),
      resume: () => this.handlePlatformResume(),
      accountSelectionOpen: () => this.handleAccountSelectionOpen(),
      accountSelectionClose: () => void this.handleAccountSelectionClose()
    });
    await this.refreshTrustedTime(true);

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
    await this.loadPurchaseProfile();
    this.applyOwnedEntitlements();
    await this.syncJourneyProgress({ showToast: false });
    await this.refreshPlatformPlayer({ syncName: true });
    await this.applyRemoteFlags();
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
    void this.refreshStore();

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
    const resultsAuth = document.getElementById("btn-results-auth");
    const resultsStore = document.getElementById("btn-results-store");
    const leaderboardClear = document.getElementById("btn-leaderboard-clear");
    const leaderboardAuth = document.getElementById("btn-leaderboard-auth");
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
    pauseMenu?.addEventListener("click", () => this.handleButton(() => void this.returnToMenu()));
    pauseSettings?.addEventListener("click", () => this.handleButton(() => void this.openSettings("pause")));
    resultsMenu?.addEventListener("click", () => this.handleButton(() => void this.returnToMenu()));
    playAgain?.addEventListener("click", () => this.handleButton(() => void this.playAgain()));
    continueBtn?.addEventListener("click", () => this.handleButton(() => this.tryContinue()));
    doubleBtn?.addEventListener("click", () => this.handleButton(() => this.tryDoubleTokens()));
    resultsAuth?.addEventListener("click", () =>
      this.handleButton(() => void this.requestOptionalPlatformAuth("results"))
    );
    resultsStore?.addEventListener("click", () =>
      this.handleButton(() => void this.tryResultsStoreOffer())
    );
    leaderboardClear?.addEventListener("click", () => this.handleButton(() => void this.clearLeaderboard()));
    leaderboardAuth?.addEventListener("click", () =>
      this.handleButton(() => void this.requestOptionalPlatformAuth("leaderboard"))
    );
    leaderboardBack?.addEventListener("click", () => this.handleButton(() => this.showScreen("menu")));
    themesBack?.addEventListener("click", () => this.handleButton(() => this.showScreen("menu")));
    settingsClose?.addEventListener("click", () => this.handleButton(() => this.closeSettings()));
    this.elements.settingsAccountAuth?.addEventListener("click", () =>
      this.handleButton(() => void this.requestOptionalPlatformAuth("settings"))
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
    window.addEventListener("pagehide", () => {
      void this.platform.flushStorage();
      this.handleVisibilityChange(true);
    });
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
    const todayDailyKey = this.getCurrentDailyBestStorageKey();
    const dateKey = this.getCurrentCalendarDateKey();
    const [
      bestScore,
      tokens,
      themesUnlocked,
      runsCount,
      tutorialCompleted,
      loginReward,
      dailyStreak,
      weeklyLoop,
      journey,
      dailyMissions,
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
        this.storage.getOptional<unknown>("dailyStreak"),
        this.storage.getOptional<unknown>("weeklyLoop"),
        this.storage.getOptional<unknown>("journey"),
        this.storage.getOptional<unknown>("dailyMissions"),
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
        dailyStreak,
        weeklyLoop,
        journey,
        dailyMissions,
        settings
      },
      {
        platformId: this.platform.id,
        platformLanguage,
        isTouch: detectTouchSupport(),
        currentDateKey: dateKey
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
    await this.storage.set("dailyStreak", this.progress.dailyStreak);
    await this.storage.set("weeklyLoop", this.progress.weeklyLoop);
    await this.storage.set("journey", this.progress.journey);
    await this.storage.set("dailyMissions", this.progress.dailyMissions);
    await this.storage.set("settings", this.progress.settings);
  }

  private async loadPurchaseProfile(): Promise<void> {
    this.purchaseProfile = normalizeStoredPurchaseProfile(
      await this.storage.getOptional<unknown>(PURCHASE_PROFILE_STORAGE_KEY)
    );
  }

  private async savePurchaseProfile(): Promise<void> {
    await this.storage.set(PURCHASE_PROFILE_STORAGE_KEY, this.purchaseProfile);
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

  private async refreshTrustedTime(force = false): Promise<void> {
    const deviceNow = Date.now();
    if (!force && deviceNow - this.lastTrustedTimeSyncAt < TRUSTED_TIME_SYNC_INTERVAL_MS) {
      return;
    }
    this.lastTrustedTimeSyncAt = deviceNow;
    const serverTime = await this.platform.getServerTime();
    if (typeof serverTime !== "number" || !Number.isFinite(serverTime)) {
      return;
    }
    this.trustedTimeOffsetMs = serverTime - deviceNow;
  }

  private getTrustedNowMs(): number {
    return Date.now() + (this.trustedTimeOffsetMs ?? 0);
  }

  private getCurrentCalendarDateKey(): string {
    if (this.trustedTimeOffsetMs === null) {
      return formatDateKey(new Date());
    }
    return formatUtcDateKey(new Date(this.getTrustedNowMs()));
  }

  private getCurrentDailyBestStorageKey(): string {
    return dailyBestKeyFromDateKey(this.getCurrentCalendarDateKey());
  }

  private getMsUntilDailyReset(): number {
    return getMsUntilNextDailyReset(new Date(this.getTrustedNowMs()), {
      useUtc: this.trustedTimeOffsetMs !== null
    });
  }

  private formatResetCountdown(ms: number, lang: Language): string {
    const totalSeconds = Math.max(1, Math.ceil(ms / 1000));
    const totalMinutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return t(lang, "time.hours_minutes", { hours, minutes });
    }
    return t(lang, "time.minutes_seconds", { minutes: totalMinutes, seconds });
  }

  private shouldShowStickyBanner(): boolean {
    return (
      this.platform.id === "yandex" &&
      !this.hasAdsDisabled() &&
      STICKY_BANNER_SCREENS.includes(this.activeScreen)
    );
  }

  private syncStickyBanner(force = false): void {
    if (this.platform.id !== "yandex") {
      return;
    }
    const targetVisible = this.shouldShowStickyBanner();
    if (!force && targetVisible === this.requestedStickyBannerVisible) {
      return;
    }
    this.requestedStickyBannerVisible = targetVisible;
    this.bannerSyncQueue = this.bannerSyncQueue
      .catch(() => undefined)
      .then(async () => {
        await this.platform.setStickyBannerVisible(this.requestedStickyBannerVisible);
      });
  }

  private buildResultsReviewRequest():
    | {
        source: ReviewRequestSource;
        payload: Record<string, unknown>;
      }
    | null {
    if (this.activeScreen !== "results" || !this.session || this.session.state.mode === "tutorial") {
      return null;
    }
    if (this.runNewBest) {
      return {
        source: "results_new_best",
        payload: {
          mode: this.session.state.mode,
          score: this.session.state.score,
          level: this.session.state.level
        }
      };
    }
    if (this.runFirstDaily || this.runDailyImproved) {
      return {
        source: "results_daily",
        payload: {
          mode: this.session.state.mode,
          score: this.session.state.score,
          firstDaily: this.runFirstDaily,
          dailyImproved: this.runDailyImproved
        }
      };
    }
    return null;
  }

  private async maybeRequestReview(
    source: ReviewRequestSource,
    payload: Record<string, unknown>
  ): Promise<void> {
    if (this.reviewPromptRequested) {
      return;
    }
    const availability = await this.platform.canReview();
    this.platform.track("reviewPromptChecked", {
      source,
      ...payload,
      supported: availability.supported,
      available: availability.available,
      reason: availability.reason ?? (availability.available ? "available" : "unavailable")
    });
    if (!availability.supported || !availability.available) {
      return;
    }
    this.reviewPromptRequested = true;
    this.platform.track("reviewPromptShown", { source, ...payload });
    const result = await this.platform.requestReview();
    this.platform.track(result.completed ? "reviewPromptCompleted" : "reviewPromptDismissed", {
      source,
      ...payload,
      reason: result.reason ?? (result.completed ? "feedback_sent" : "dismissed")
    });
  }

  private getRunsBucket(): string {
    const runs = this.progress.runsCount;
    if (runs <= 0) {
      return "0";
    }
    if (runs <= 2) {
      return "1_2";
    }
    if (runs <= 5) {
      return "3_5";
    }
    if (runs <= 10) {
      return "6_10";
    }
    return "11_plus";
  }

  private getRemoteFlagClientFeatures(): PlatformClientFeature[] {
    return [
      {
        name: "authorized",
        value: this.platformPlayer.authorized ? "true" : "false"
      },
      {
        name: "runsBucket",
        value: this.getRunsBucket()
      },
      {
        name: "noAdsOwned",
        value: this.hasAdsDisabled() ? "true" : "false"
      }
    ];
  }

  private async applyRemoteFlags(): Promise<void> {
    const defaultFlags = buildDefaultRemoteFlags(this.monetization);
    const resolvedFlags = await this.platform.getFlags(defaultFlags, this.getRemoteFlagClientFeatures());
    const remoteConfig = parseRemoteConfig(resolvedFlags, this.monetization);
    this.monetization = remoteConfig.monetization;
    this.storeExperiment = remoteConfig.store;
    this.platform.updateMonetizationConfig(remoteConfig.monetization);
    this.platform.track("remoteFlagsLoaded", {
      runsBucket: this.getRunsBucket(),
      menuRewardTokens: this.monetization.menuRewardTokens,
      continueMinScore: this.monetization.continueMinScore,
      interstitialIntervalRuns: this.monetization.interstitialIntervalRuns,
      starterPackResultsEnabled: this.storeExperiment.starterPackResultsEnabled,
      starterPackResultsMinScore: this.storeExperiment.starterPackResultsMinScore,
      starterPackResultsMaxRuns: this.storeExperiment.starterPackResultsMaxRuns,
      enabledOffers: this.storeExperiment.enabledOfferIds.join(",")
    });
  }

  private getStoreOfferProductId(offerId: StoreOfferId): string {
    return this.purchaseProductIds[offerId];
  }

  private isStoreOfferEnabled(offerId: StoreOfferId): boolean {
    return this.storeExperiment.storeEnabled && this.storeExperiment.enabledOfferIds.includes(offerId);
  }

  private getAvailableStoreOfferIds(): StoreOfferId[] {
    return STORE_OFFERS.filter(
      (offer) =>
        this.isStoreOfferEnabled(offer.id) &&
        this.store.products.has(this.getStoreOfferProductId(offer.id))
    ).map((offer) => offer.id);
  }

  private getOwnedStoreOfferIds(): StoreOfferId[] {
    return STORE_OFFERS.filter((offer) => this.hasStoreOwnership(offer.id)).map((offer) => offer.id);
  }

  private hasStoreOwnership(offerId: StoreOfferId): boolean {
    return hasOfferProductOwnership(this.purchaseProfile, offerId, this.purchaseProductIds);
  }

  private hasAdsDisabled(): boolean {
    return purchaseProfileDisablesAds(this.purchaseProfile, this.purchaseProductIds);
  }

  private applyOwnedEntitlements(): void {
    let progressChanged = false;

    for (const offer of STORE_OFFERS) {
      if (!this.hasStoreOwnership(offer.id)) {
        continue;
      }
      for (const themeId of offer.unlockThemes) {
        if (!this.progress.themesUnlocked.includes(themeId)) {
          this.progress.themesUnlocked.push(themeId);
          progressChanged = true;
        }
      }
    }

    if (progressChanged) {
      void this.saveProgress();
    }
  }

  private renderStore(): void {
    const section = this.elements.storeSection;
    const grid = this.elements.storeGrid;
    const hint = this.elements.storeHint;
    if (!section || !grid || !hint) {
      return;
    }
    const lang = this.progress.settings.language;
    const products = this.store.products;
    const shouldShowSection =
      this.storeExperiment.storeEnabled &&
      (this.platform.id === "yandex" || this.store.supported || this.store.loading);
    section.hidden = !shouldShowSection;
    if (!shouldShowSection) {
      return;
    }

    if (this.activeScreen === "themes" && !this.store.loading && !this.themesStoreTracked) {
      this.platform.track("storeShown", {
        source: "themes",
        supported: this.store.supported,
        productCount: products.size,
        noAdsOwned: this.hasAdsDisabled()
      });
      this.themesStoreTracked = true;
    }

    hint.textContent = t(lang, this.store.hintKey, this.store.hintParams);
    grid.innerHTML = "";

    for (const offer of STORE_OFFERS.filter((entry) => this.isStoreOfferEnabled(entry.id))) {
      const product = products.get(this.getStoreOfferProductId(offer.id));
      const card = document.createElement("div");
      card.className = "shop-card";

      const title = document.createElement("strong");
      title.textContent = product?.title ?? t(lang, offer.titleKey);

      const description = document.createElement("p");
      description.className = "shop-card__description";
      description.textContent = product?.description ?? t(lang, offer.descriptionKey);

      const meta = document.createElement("span");
      meta.className = "shop-card__meta";
      meta.textContent =
        product?.priceText ??
        (offer.kind === "consumable"
          ? t(lang, "store.price.consumable")
          : t(lang, "store.price.permanent"));

      const action = document.createElement("button");
      action.className = "btn";
      const owned = this.hasStoreOwnership(offer.id);
      const unavailable = !this.store.supported || !product || this.store.loading;

      if (owned && offer.kind === "permanent") {
        action.textContent = t(lang, "store.action.owned");
        action.disabled = true;
      } else if (unavailable) {
        action.textContent = t(lang, "store.action.unavailable");
        action.disabled = true;
      } else {
        action.textContent = t(lang, "store.action.buy", {
          price: product.priceText ?? t(lang, "store.price.buy_now")
        });
        action.addEventListener("click", () => {
          this.audio.unlock();
          this.audio.playButton();
          void this.purchaseStoreOffer(offer.id, "themes");
        });
      }

      card.appendChild(title);
      card.appendChild(description);
      card.appendChild(meta);
      card.appendChild(action);
      grid.appendChild(card);
    }
  }

  private async refreshStore(): Promise<void> {
    this.store.loading = true;
    this.store.hintKey = "store.hint.loading";
    this.renderStore();

    const catalog = await this.platform.getPurchaseCatalog();
    this.store.supported = catalog.supported;
    this.store.products = new Map(catalog.products.map((product) => [product.id, product]));
    this.platform.track("storeCatalogLoaded", {
      source: this.activeScreen === "themes" ? "themes" : "background",
      supported: catalog.supported,
      productCount: catalog.products.length,
      reason: catalog.reason ?? "available"
    });

    const purchases = catalog.supported ? await this.platform.getPurchases() : [];
    await this.applyPlatformPurchases(purchases);

    this.store.loading = false;
    this.store.hintKey = this.hasAdsDisabled()
      ? "store.hint.no_ads_active"
      : !catalog.supported
        ? "store.hint.unavailable"
        : "store.hint.ready";
    this.renderStore();
  }

  private async applyPlatformPurchases(
    purchases: Array<{
      productId: string;
      purchaseToken?: string | null;
      developerPayload?: string | null;
    }>
  ): Promise<void> {
    if (purchases.length === 0) {
      this.applyOwnedEntitlements();
      return;
    }

    const ownedProductIds = new Set(this.purchaseProfile.ownedProductIds);
    const grantedOfferIds = new Set<StoreOfferId>(this.purchaseProfile.grantedOfferIds);
    const processedTokens = new Set(this.purchaseProfile.processedPurchaseTokens);
    const restoredOffers = new Set<StoreOfferId>();
    let restoredTokens = 0;
    let profileChanged = false;
    let progressChanged = false;
    const commitState = async (): Promise<void> => {
      if (!profileChanged && !progressChanged) {
        return;
      }
      this.purchaseProfile = {
        ownedProductIds: Array.from(ownedProductIds),
        grantedOfferIds: Array.from(grantedOfferIds),
        processedPurchaseTokens: Array.from(processedTokens)
      };
      if (profileChanged) {
        await this.savePurchaseProfile();
      }
      if (progressChanged) {
        await this.saveProgress();
      }
    };

    for (const purchase of purchases) {
      const offer = findStoreOfferByProductId(purchase.productId, this.purchaseProductIds);
      if (!offer) {
        continue;
      }

      if (offer.kind === "consumable") {
        if (!purchase.purchaseToken || processedTokens.has(purchase.purchaseToken)) {
          continue;
        }
        if (offer.tokenGrant > 0) {
          this.progress.tokens += offer.tokenGrant;
          restoredTokens += offer.tokenGrant;
          progressChanged = true;
        }
        processedTokens.add(purchase.purchaseToken);
        profileChanged = true;
        restoredOffers.add(offer.id);
        await commitState();
        await this.platform.consumePurchase(purchase.purchaseToken);
        continue;
      }

      if (!ownedProductIds.has(purchase.productId)) {
        ownedProductIds.add(purchase.productId);
        profileChanged = true;
      }
      if (!grantedOfferIds.has(offer.id)) {
        if (offer.tokenGrant > 0) {
          this.progress.tokens += offer.tokenGrant;
          restoredTokens += offer.tokenGrant;
          progressChanged = true;
        }
        grantedOfferIds.add(offer.id);
        profileChanged = true;
        restoredOffers.add(offer.id);
      }
      for (const themeId of offer.unlockThemes) {
        if (!this.progress.themesUnlocked.includes(themeId)) {
          this.progress.themesUnlocked.push(themeId);
          progressChanged = true;
        }
      }
      await commitState();
    }

    if (profileChanged || progressChanged) {
      this.updateMenuStats();
      this.renderThemes();
      this.platform.track("purchaseRestored", {
        offers: Array.from(restoredOffers),
        restoredTokens
      });
    } else {
      this.applyOwnedEntitlements();
    }
    this.syncStickyBanner(true);
  }

  private async purchaseStoreOffer(offerId: StoreOfferId, source: "themes" | "results"): Promise<void> {
    const offer = getStoreOffer(offerId);
    if (!offer || !this.isStoreOfferEnabled(offerId)) {
      return;
    }
    const productId = this.getStoreOfferProductId(offerId);
    this.platform.track("iapPurchaseClicked", {
      source,
      offerId,
      productId
    });
    const result = await this.platform.purchaseProduct(productId, `${offerId}:${Date.now()}`);
    if (!result.purchased || !result.purchase) {
      this.platform.track("iapPurchaseFailed", {
        source,
        offerId,
        productId,
        reason: result.reason ?? "purchase_failed"
      });
      this.toast.show(t(this.progress.settings.language, "toast.purchase_failed"));
      await this.refreshStore();
      return;
    }

    this.platform.track("iapPurchaseCompleted", {
      source,
      offerId,
      productId
    });
    await this.applyPlatformPurchases([result.purchase]);
    await this.refreshStore();
    this.toast.show(t(this.progress.settings.language, "toast.purchase_success"));
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

  private async requestOptionalPlatformAuth(
    source: "settings" | "leaderboard" | "results"
  ): Promise<void> {
    const previousAuthorized = this.platformPlayer.authorized;
    if (source === "results" && this.activeScreen === "results") {
      await this.finalizeRun();
    }
    this.platform.track("authPromptAccepted", { source });
    await this.platform.requestPlayerAuth();
    await this.refreshPlatformPlayer({ syncName: true });
    await this.refreshLeaderboard();
    await this.refreshStore();
    this.updateResults();
    this.updateResultsHints();
    const lang = this.progress.settings.language;
    if (this.platformPlayer.authorized && !previousAuthorized) {
      this.platform.track("authPromptSucceeded", { source });
      const submitted = await this.submitPendingLeaderboardEntryAfterAuth(source);
      this.toast.show(t(lang, submitted ? "toast.score_synced" : "toast.account_connected"));
      return;
    }
    if (!this.platformPlayer.authorized) {
      this.platform.track("authPromptDismissed", { source });
      this.toast.show(t(lang, "toast.account_optional"));
    }
  }

  private async submitPendingLeaderboardEntryAfterAuth(
    source: "settings" | "leaderboard" | "results"
  ): Promise<boolean> {
    if (!this.pendingLeaderboardEntry || this.pendingLeaderboardSubmitted) {
      return false;
    }
    const submitted = await this.leaderboardService.submit(this.pendingLeaderboardEntry);
    if (!submitted) {
      return false;
    }
    this.pendingLeaderboardSubmitted = true;
    await this.refreshLeaderboard();
    this.platform.track("leaderboardSubmittedAfterAuth", {
      source,
      mode: this.pendingLeaderboardEntry.mode,
      score: this.pendingLeaderboardEntry.score
    });
    return true;
  }

  private handleVisibilityChange(forceHidden?: boolean): void {
    this.setExternalPauseState("visibility", forceHidden ?? document.hidden);
  }

  private handlePlatformPause(): void {
    this.setExternalPauseState("sdk", true);
  }

  private handlePlatformResume(): void {
    this.setExternalPauseState("sdk", false);
  }

  private handleAccountSelectionOpen(): void {
    this.accountSelectionDialogOpen = true;
  }

  private async handleAccountSelectionClose(): Promise<void> {
    if (!this.accountSelectionDialogOpen) {
      return;
    }
    this.accountSelectionDialogOpen = false;
    await this.reloadPlatformBoundState({ returnToMenu: true });
  }

  private setExternalPauseState(source: "visibility" | "sdk", paused: boolean): void {
    if (paused) {
      if (this.activePauseSources.has(source)) {
        return;
      }
      const wasPaused = this.activePauseSources.size > 0;
      this.activePauseSources.add(source);
      if (wasPaused) {
        return;
      }
      this.requestedStickyBannerVisible = false;
      void this.platform.setStickyBannerVisible(false);
      if (this.activeScreen === "game") {
        const keepSelection =
          this.selectedPieceId !== null &&
          this.dragging === null &&
          (this.progress.settings.tapToPlace || this.selectedInputMode === "keyboard");
        this.resetPointerInteraction({ clearSelection: !keepSelection });
      }
      this.pausedGameplayByExternalSignal = this.activeScreen === "game";
      void this.audio.suspend();
      this.audio.setMuted(true);
      this.audio.stopMusic();
      if (this.pausedGameplayByExternalSignal) {
        this.platform.gameplayStop();
      }
      return;
    }

    if (!this.activePauseSources.delete(source) || this.activePauseSources.size > 0) {
      return;
    }

    const shouldResumeGameplay =
      this.pausedGameplayByExternalSignal &&
      this.activeScreen === "game" &&
      !document.hidden;
    this.pausedGameplayByExternalSignal = false;
    void this.audio.resume();
    this.audio.setMuted(false);
    if (shouldResumeGameplay) {
      if (this.progress.settings.musicEnabled) {
        this.audio.startMusic();
      }
      this.platform.gameplayStart();
    } else if (this.activeScreen === "menu") {
      void this.syncMenuDailyState();
    }
    this.syncStickyBanner(true);
  }

  private async reloadPlatformBoundState(options?: { returnToMenu?: boolean }): Promise<void> {
    await this.refreshTrustedTime(true);
    await this.loadProgress();
    await this.loadPurchaseProfile();
    this.applyOwnedEntitlements();
    await this.refreshPlatformPlayer({ syncName: true });
    await this.applyRemoteFlags();
    this.applyLanguage();
    await this.refreshLeaderboard();
    await this.refreshStore();
    this.updateMenuStats();
    if (options?.returnToMenu) {
      this.audio.stopMusic();
      this.platform.gameplayStop();
      this.showScreen("menu");
    }
  }

  private maybeRequestFullscreen(): void {
    if (this.platform.id !== "yandex" || !detectTouchSupport()) {
      return;
    }
    void this.platform.requestFullscreen();
  }

  private preventContextMenu(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest("#app") && !this.isEditableTarget(target)) {
      event.preventDefault();
    }
  }

  private preventSelection(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest("#app") && !this.isEditableTarget(target)) {
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
    this.elements.canvas.setAttribute("aria-label", t(lang, "game.board_aria"));
    this.elements.settingLanguage.value = lang;
    this.elements.settingPlayerName.placeholder = t(lang, "settings.player_name_placeholder");
    this.updatePlayerNameField();
    this.renderPlatformAccount();
    this.renderLeaderboard();
    this.renderThemes();
    this.renderStore();
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

  private getHasDailyCompletionToday(): boolean {
    return (
      this.currentDailyBest !== null ||
      (this.session?.state.mode === "daily" && this.pendingDailyBest !== null)
    );
  }

  private getResultsReplayMode(): GameMode {
    return resolveResultsReplayMode(
      this.session?.state.mode ?? "play",
      this.getHasDailyCompletionToday()
    );
  }

  private updateResultsReplayCta(): void {
    const button = document.getElementById("btn-play-again") as HTMLButtonElement | null;
    if (!button) {
      return;
    }
    const lang = this.progress.settings.language;
    const currentMode = this.session?.state.mode ?? "play";
    const replayMode = this.getResultsReplayMode();
    const promoteDaily = replayMode === "daily" && currentMode !== "daily";
    const label = t(lang, promoteDaily ? "results.play_daily" : "results.play_again");
    button.textContent = label;
    button.setAttribute("aria-label", label);
  }

  private async startRun(mode: GameMode): Promise<void> {
    this.maybeRequestFullscreen();
    await this.refreshTrustedTime();
    const now = Date.now();
    const dateKey = this.getCurrentCalendarDateKey();
    const seed =
      mode === "daily"
        ? this.trustedTimeOffsetMs === null
          ? createDailySeed(new Date())
          : createDailySeedFromDateKey(dateKey)
        : mode === "tutorial"
          ? "tutorial_v1"
          : `run_${now}`;
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
    this.runDailyStreakRewardTokens = 0;
    this.runDailyStreakDay = 0;
    this.runWeeklyLoopRewardTokens = 0;
    this.runWeeklyLoopDays = 0;
    this.runWeeklyLoopGoalDays = 0;
    this.runDailyImproved = false;
    this.runLeaderboardRank = null;
    this.runDailyLeaderboardRank = null;
    this.runJourneyPreview = [];
    this.runDailyMissionPreview = [];
    this.pendingLeaderboardEntry = null;
    this.pendingLeaderboardSubmitted = false;
    this.runDailyKey = mode === "daily" ? dailyBestKeyFromDateKey(dateKey) : null;
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

    logger.info("startSession", { mode, date: dateKey });
    logger.info("startRun", { mode, seed });
    this.platform.track("startSession", { mode, date: dateKey });
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
    this.maybeRequestFullscreen();
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
    const sourceMode = this.session?.state.mode ?? "play";
    const mode = this.getResultsReplayMode();
    this.platform.track("resultsReplayClicked", {
      sourceMode,
      targetMode: mode,
      suggestedDaily: mode === "daily" && sourceMode !== "daily"
    });
    await this.startRun(mode);
  }

  private async returnToMenu(): Promise<void> {
    const reviewRequest = this.buildResultsReviewRequest();
    if (this.activeScreen === "results") {
      await this.finalizeRun();
    }
    this.audio.stopMusic();
    this.platform.gameplayStop();
    this.showScreen("menu");
    if (reviewRequest) {
      void this.maybeRequestReview(reviewRequest.source, reviewRequest.payload);
    }
  }

  private openThemes(): void {
    const themesCta = this.getMenuThemesCta();
    this.platform.track("themeShopOpen", {
      source: "menu",
      tokens: this.progress.tokens,
      unlockedThemes: this.progress.themesUnlocked.length,
      storeSupported: this.store.supported,
      ctaReason: themesCta.reason,
      ctaTargetTheme: themesCta.targetThemeId
    });
    this.renderThemes();
    void this.refreshStore();
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
      this.menuRewardOfferTracked = false;
      void this.syncMenuDailyState();
      this.updateMenuRewardState();
      this.updateTutorialCta();
    } else if (id === "leaderboard") {
      this.leaderboardAuthPromptTracked = false;
      this.renderLeaderboard();
    } else if (id === "results") {
      this.resultsOffersTracked = false;
      this.resultsAuthPromptTracked = false;
      this.resultsStorePromptTracked = false;
    } else if (id === "themes") {
      this.themesStoreTracked = false;
      this.renderThemes();
      this.renderStore();
    } else if (id === "game") {
      this.elements.canvas.focus();
    }
    this.updateGameHint();
    this.updateResultsTitle();
    this.syncStickyBanner();
  }

  private updateMenuStats(): void {
    this.elements.menuBest.textContent = `${this.progress.bestScore}`;
    this.elements.menuTokens.textContent = `${this.progress.tokens}`;
    this.updateTutorialCta();
    this.updateMenuDailyStatus();
    this.updateMenuLoginRewardStatus();
    this.updateMenuThemesCta();
    this.updateDailyMissions();
    this.updateJourneyGoals();
  }

  private updateDailyMissions(): void {
    if (!this.elements.menuDailyMissions) {
      return;
    }

    const statuses = getDailyMissionStatuses(
      this.progress.dailyMissions,
      this.getCurrentCalendarDateKey()
    );
    const lang = this.progress.settings.language;
    this.elements.menuDailyMissions.replaceChildren();

    for (const status of statuses) {
      const card = document.createElement("article");
      card.className = "mission-card";
      if (status.claimed) {
        card.classList.add("mission-card--done");
      }

      const head = document.createElement("div");
      head.className = "mission-card__head";

      const title = document.createElement("strong");
      title.className = "mission-card__title";
      title.textContent = t(lang, status.definition.titleKey);

      const progress = document.createElement("span");
      progress.className = "mission-card__progress";
      progress.textContent = status.claimed
        ? t(lang, "daily_mission.done")
        : t(lang, "daily_mission.progress_count", {
            value: status.progressValue,
            total: status.definition.targetValue
          });

      head.append(title, progress);

      const description = document.createElement("p");
      description.className = "mission-card__description";
      description.textContent = t(lang, status.definition.descriptionKey);

      const reward = document.createElement("span");
      reward.className = "mission-card__reward";
      reward.textContent = t(lang, "daily_mission.reward", {
        count: status.definition.rewardTokens
      });

      card.append(head, description, reward);
      this.elements.menuDailyMissions.appendChild(card);
    }
  }

  private buildJourneyContext(options?: { includePendingRun?: boolean }): JourneyContext {
    const includePendingRun = options?.includePendingRun === true;
    const bestScore = includePendingRun
      ? Math.max(this.progress.bestScore, this.pendingBestScore)
      : this.progress.bestScore;
    const hasDailyCompletion = includePendingRun
      ? this.currentDailyBest !== null || this.pendingDailyBest !== null || this.runFirstDaily
      : this.currentDailyBest !== null;

    return {
      tutorialCompleted: this.progress.tutorialCompleted,
      runsCount: this.progress.runsCount,
      bestScore,
      themesUnlockedCount: this.progress.themesUnlocked.length,
      hasDailyCompletion
    };
  }

  private updateJourneyGoals(): void {
    if (!this.elements.menuGoalsList || !this.elements.menuGoalsMeta) {
      return;
    }

    const summary = resolveJourneyProgress(this.progress.journey, this.buildJourneyContext());
    const lang = this.progress.settings.language;
    this.elements.menuGoalsMeta.textContent = t(lang, "menu.goals_progress", {
      claimed: summary.claimedCount,
      total: summary.totalCount
    });
    this.elements.menuGoalsList.replaceChildren();

    if (summary.nextMilestones.length === 0) {
      const empty = document.createElement("p");
      empty.className = "menu-goals__empty";
      empty.textContent = t(lang, "menu.goals_empty");
      this.elements.menuGoalsList.appendChild(empty);
      return;
    }

    for (const milestone of summary.nextMilestones.slice(0, 3)) {
      const card = document.createElement("article");
      card.className = "goal-card";

      const title = document.createElement("strong");
      title.className = "goal-card__title";
      title.textContent = t(lang, milestone.titleKey);

      const description = document.createElement("p");
      description.className = "goal-card__description";
      description.textContent = t(lang, milestone.descriptionKey);

      const reward = document.createElement("span");
      reward.className = "goal-card__reward";
      reward.textContent = t(lang, "journey.reward", {
        count: milestone.rewardTokens
      });

      card.append(title, description, reward);
      this.elements.menuGoalsList.appendChild(card);
    }
  }

  private async syncJourneyProgress(options?: { showToast?: boolean }): Promise<void> {
    const summary = resolveJourneyProgress(this.progress.journey, this.buildJourneyContext());
    if (summary.newlyClaimed.length === 0) {
      return;
    }

    this.progress.journey = summary.updatedState;
    this.progress.tokens += summary.totalRewardTokens;
    await this.saveProgress();
    this.updateMenuStats();

    if (!options?.showToast) {
      return;
    }

    const lang = this.progress.settings.language;
    if (summary.newlyClaimed.length === 1) {
      const milestone = summary.newlyClaimed[0];
      this.toast.show(
        t(lang, "toast.journey_goal", {
          goal: t(lang, milestone.titleKey),
          count: milestone.rewardTokens
        })
      );
      return;
    }

    this.toast.show(
      t(lang, "toast.journey_bonus_multi", {
        goals: summary.newlyClaimed.length,
        count: summary.totalRewardTokens
      })
    );
  }

  private normalizeDailyMissionStateForToday(): boolean {
    const nextState = normalizeDailyMissionProgress(
      this.progress.dailyMissions,
      this.getCurrentCalendarDateKey()
    );
    const current = this.progress.dailyMissions;
    const changed =
      current.dateKey !== nextState.dateKey ||
      current.stats.completedRuns !== nextState.stats.completedRuns ||
      current.stats.totalLinesCleared !== nextState.stats.totalLinesCleared ||
      current.stats.completedDaily !== nextState.stats.completedDaily ||
      current.claimedMissionIds.join(",") !== nextState.claimedMissionIds.join(",");

    if (changed) {
      this.progress.dailyMissions = nextState;
    }
    return changed;
  }

  private async syncDailyMissionProgress(options?: { showToast?: boolean }): Promise<void> {
    if (!this.session || this.session.state.mode === "tutorial") {
      return;
    }

    const resolution = applyCompletedRunToDailyMissions(
      this.progress.dailyMissions,
      this.getCurrentCalendarDateKey(),
      {
        mode: this.session.state.mode,
        linesCleared: this.session.state.linesCleared
      }
    );
    this.progress.dailyMissions = resolution.updatedState;
    if (resolution.newlyClaimed.length === 0) {
      return;
    }

    this.progress.tokens += resolution.totalRewardTokens;
    await this.saveProgress();
    this.updateMenuStats();

    if (!options?.showToast) {
      return;
    }

    const lang = this.progress.settings.language;
    if (resolution.newlyClaimed.length === 1) {
      const mission = resolution.newlyClaimed[0];
      this.toast.show(
        t(lang, "toast.daily_mission", {
          mission: t(lang, mission.titleKey),
          count: mission.rewardTokens
        })
      );
      return;
    }

    this.toast.show(
      t(lang, "toast.daily_mission_multi", {
        missions: resolution.newlyClaimed.length,
        count: resolution.totalRewardTokens
      })
    );
  }

  private getDailyStreakPreview(): DailyStreakResolution | null {
    if (!this.session || this.session.state.mode !== "daily" || !this.runFirstDaily) {
      return null;
    }

    return applyDailyCompletionToStreak(
      this.progress.dailyStreak,
      this.getCurrentCalendarDateKey()
    );
  }

  private getWeeklyLoopPreview(): WeeklyLoopResolution | null {
    if (!this.session || this.session.state.mode !== "daily" || !this.runFirstDaily) {
      return null;
    }

    return applyDailyCompletionToWeeklyLoop(
      this.progress.weeklyLoop,
      this.getCurrentCalendarDateKey()
    );
  }

  private renderLeaderboard(): void {
    this.renderLeaderboardMeta();
    this.renderLeaderboardList(this.elements.leaderboardAllTime, this.leaderboard.allTime, "overall");
    this.renderLeaderboardList(this.elements.leaderboardDaily, this.leaderboard.daily, "daily");
  }

  private async refreshLeaderboard(): Promise<void> {
    await this.refreshTrustedTime();
    const leaderboardLoad = await this.leaderboardService.load(this.getCurrentCalendarDateKey());
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
    this.updateLeaderboardAuthPrompt(needsPlatformAuth);
  }

  private needsLeaderboardAuth(): boolean {
    return (
      this.leaderboardMeta.overall.submissionState === "auth_required" ||
      this.leaderboardMeta.daily.submissionState === "auth_required"
    );
  }

  private canPromptForLeaderboardAuth(): boolean {
    return this.platform.id === "yandex" && !this.platformPlayer.authorized && this.needsLeaderboardAuth();
  }

  private shouldShowResultsAuthPrompt(): boolean {
    if (!this.session || this.session.state.mode === "tutorial" || !this.pendingLeaderboardEntry) {
      return false;
    }
    if (!this.canPromptForLeaderboardAuth()) {
      return false;
    }
    return (
      this.runNewBest ||
      this.session.state.mode === "daily" ||
      this.runLeaderboardRank !== null ||
      this.runDailyLeaderboardRank !== null
    );
  }

  private getResultsStoreOfferSelection(): ResultsOfferSelection | null {
    if (!this.session) {
      return null;
    }

    return selectResultsOffer({
      platformId: this.platform.id,
      mode: this.session.state.mode,
      storeLoading: this.store.loading,
      storeSupported: this.store.supported,
      enabledOfferIds: this.storeExperiment.enabledOfferIds,
      availableOfferIds: this.getAvailableStoreOfferIds(),
      ownedOfferIds: this.getOwnedStoreOfferIds(),
      hasAdsDisabled: this.hasAdsDisabled(),
      runsCount: this.progress.runsCount,
      themesUnlockedCount: this.progress.themesUnlocked.length,
      runNewBest: this.runNewBest,
      runFirstDaily: this.runFirstDaily,
      runDailyImproved: this.runDailyImproved,
      runLeaderboardRank: this.runLeaderboardRank,
      runDailyLeaderboardRank: this.runDailyLeaderboardRank,
      score: this.session.state.score,
      storeExperiment: this.storeExperiment
    });
  }

  private getResultsStoreHint(selection: ResultsOfferSelection, lang: Language): string {
    return t(lang, `results.store_hint.${selection.reason}`);
  }

  private getResultsDailyResetHint(lang: Language): string | null {
    if (!this.session || this.session.state.mode === "tutorial") {
      return null;
    }

    const time = this.formatResetCountdown(this.getMsUntilDailyReset(), lang);
    if (this.getResultsReplayMode() === "daily" && this.session.state.mode !== "daily") {
      return t(lang, "hint.daily_reset_in", { time });
    }
    if (this.session.state.mode === "daily" || this.currentDailyBest !== null) {
      return t(lang, "hint.next_daily_in", { time });
    }
    return null;
  }

  private updateLeaderboardAuthPrompt(forceNeedsAuth?: boolean): void {
    const button = this.elements.leaderboardAuth;
    if (!button) {
      return;
    }
    const visible =
      this.platform.id === "yandex" &&
      !this.platformPlayer.authorized &&
      (forceNeedsAuth ?? this.needsLeaderboardAuth());
    button.hidden = !visible;
    button.disabled = !visible;
    if (visible && this.activeScreen === "leaderboard" && !this.leaderboardAuthPromptTracked) {
      this.platform.track("authPromptShown", {
        source: "leaderboard",
        submissionStateOverall: this.leaderboardMeta.overall.submissionState,
        submissionStateDaily: this.leaderboardMeta.daily.submissionState
      });
      this.leaderboardAuthPromptTracked = true;
    }
  }

  private updateResultsAuthPrompt(): void {
    const button = this.elements.resultsAuth;
    if (!button) {
      return;
    }
    const visible = this.shouldShowResultsAuthPrompt();
    button.hidden = !visible;
    button.disabled = !visible;
    if (visible && this.activeScreen === "results" && !this.resultsAuthPromptTracked) {
      this.platform.track("authPromptShown", {
        source: "results",
        score: this.pendingLeaderboardEntry?.score ?? this.session?.state.score ?? 0,
        mode: this.pendingLeaderboardEntry?.mode ?? this.session?.state.mode ?? "play"
      });
      this.resultsAuthPromptTracked = true;
    }
  }

  private updateResultsStorePrompt(): void {
    const button = this.elements.resultsStore;
    if (!button) {
      return;
    }
    const lang = this.progress.settings.language;
    const selection = this.getResultsStoreOfferSelection();
    const visible = selection !== null;
    button.hidden = !visible;
    button.disabled = !visible;
    if (!selection) {
      const label = t(lang, "results.store");
      button.textContent = label;
      button.title = "";
      button.setAttribute("aria-label", label);
      return;
    }

    const offerName = t(lang, `store.offer.${selection.offerId}.short`);
    const product = this.store.products.get(this.getStoreOfferProductId(selection.offerId));
    const label = product?.priceText ? `${offerName} - ${product.priceText}` : offerName;
    button.textContent = label;
    button.title = this.getResultsStoreHint(selection, lang);
    button.setAttribute("aria-label", label);
    if (visible && this.activeScreen === "results" && !this.resultsStorePromptTracked) {
      this.platform.track("storePromptShown", {
        source: "results",
        offerId: selection.offerId,
        reason: selection.reason,
        mode: this.session?.state.mode ?? "play",
        score: this.session?.state.score ?? 0
      });
      this.resultsStorePromptTracked = true;
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
    await this.refreshTrustedTime();
    const cleared = await this.leaderboardService.clear(this.getCurrentCalendarDateKey());
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
    if (this.elements.menuDailyResetStatus) {
      this.elements.menuDailyResetStatus.textContent = this.getMenuDailyResetHint(lang);
    }
    this.updateMenuDailyStreakStatus();
    this.updateMenuWeeklyLoopStatus();
    this.updateMenuDailyCta();
  }

  private getMenuDailyResetHint(lang: Language): string {
    const time = this.formatResetCountdown(this.getMsUntilDailyReset(), lang);
    return t(
      lang,
      this.currentDailyBest === null ? "menu.daily_reset_in" : "menu.next_daily_in",
      { time }
    );
  }

  private updateMenuDailyCta(): void {
    const lang = this.progress.settings.language;
    const highlightDaily = this.progress.tutorialCompleted && this.currentDailyBest === null;
    const streakStatus = getDailyStreakStatus(
      this.progress.dailyStreak,
      this.getCurrentCalendarDateKey()
    );
    this.elements.menuDaily.classList.toggle("btn--attention", highlightDaily);
    this.elements.menuDaily.title =
      highlightDaily && streakStatus.remainingDays === 1 && streakStatus.nextMilestoneDay !== null
        ? t(lang, "menu.daily_cta_streak", {
            day: streakStatus.nextMilestoneDay,
            count: streakStatus.nextMilestoneTokens
          })
        : highlightDaily
          ? t(lang, "menu.daily_cta_ready")
          : "";
  }

  private updateMenuDailyStreakStatus(): void {
    if (!this.elements.menuDailyStreakStatus) {
      return;
    }

    const lang = this.progress.settings.language;
    const status = getDailyStreakStatus(this.progress.dailyStreak, this.getCurrentCalendarDateKey());
    const key =
      status.current === 0
        ? "menu.daily_streak.idle"
        : status.activeToday
          ? status.nextMilestoneDay === null
            ? "menu.daily_streak.max_active"
            : "menu.daily_streak.active"
          : status.nextMilestoneDay === null
            ? "menu.daily_streak.max_chase"
            : "menu.daily_streak.chase";

    this.elements.menuDailyStreakStatus.textContent = t(lang, key, {
      current: status.current,
      day: status.nextMilestoneDay ?? status.current,
      count: status.nextMilestoneTokens
    });
  }

  private updateMenuWeeklyLoopStatus(): void {
    if (!this.elements.menuWeeklyLoopStatus) {
      return;
    }

    const lang = this.progress.settings.language;
    const status = getWeeklyLoopStatus(this.progress.weeklyLoop, this.getCurrentCalendarDateKey());
    this.elements.menuWeeklyLoopStatus.textContent = t(
      lang,
      status.complete ? "menu.weekly_loop.complete" : "menu.weekly_loop.progress",
      {
        value: status.completedDays,
        total: status.goalDays,
        count: status.nextMilestoneTokens
      }
    );
  }

  private getMenuThemesCta(): {
    reason: "none" | "ready" | "reward";
    targetThemeId: string | null;
  } {
    const nextThemeTarget = this.getNextThemeTarget();
    const rewardEligibility = this.getThemeRewardEligibility();
    const state = resolveMenuThemesCta({
      tutorialCompleted: this.progress.tutorialCompleted,
      nextThemeMissingTokens: nextThemeTarget?.missingTokens ?? null,
      rewardEligible: rewardEligibility.ok,
      rewardTokens: this.monetization.menuRewardTokens
    });

    return {
      reason: state.reason,
      targetThemeId: nextThemeTarget?.theme.id ?? null
    };
  }

  private updateMenuThemesCta(): void {
    const lang = this.progress.settings.language;
    const nextThemeTarget = this.getNextThemeTarget();
    const rewardEligibility = this.getThemeRewardEligibility();
    const state = resolveMenuThemesCta({
      tutorialCompleted: this.progress.tutorialCompleted,
      nextThemeMissingTokens: nextThemeTarget?.missingTokens ?? null,
      rewardEligible: rewardEligibility.ok,
      rewardTokens: this.monetization.menuRewardTokens
    });
    const message =
      nextThemeTarget && state.reason !== "none"
        ? t(
            lang,
            state.reason === "ready" ? "menu.themes_ready" : "menu.themes_reward_ready",
            {
              theme: t(lang, `theme.name.${nextThemeTarget.theme.id}`)
            }
          )
        : "";

    this.elements.menuThemes.classList.toggle("btn--attention", state.highlight);
    this.elements.menuThemes.title = message;
    if (message) {
      this.elements.menuThemes.setAttribute("aria-label", `${t(lang, "menu.themes")}. ${message}`);
      return;
    }
    this.elements.menuThemes.removeAttribute("aria-label");
  }

  private updateMenuLoginRewardStatus(): void {
    const lang = this.progress.settings.language;
    const reward = getLoginRewardStatus(this.progress.loginReward, this.getCurrentCalendarDateKey());
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
    this.updateMenuLoginRewardTrack();
  }

  private updateMenuLoginRewardTrack(): void {
    if (!this.elements.menuLoginTrack) {
      return;
    }

    const lang = this.progress.settings.language;
    const track = getLoginRewardTrack(this.progress.loginReward, this.getCurrentCalendarDateKey());
    this.elements.menuLoginTrack.replaceChildren();
    this.elements.menuLoginTrack.setAttribute(
      "aria-label",
      t(lang, "menu.login_reward.track_aria")
    );

    for (const entry of track) {
      const item = document.createElement("div");
      item.className = `login-track__day login-track__day--${entry.state}`;

      const day = document.createElement("span");
      day.className = "login-track__label";
      day.textContent = t(lang, "menu.login_reward.track_day", { day: entry.day });

      const reward = document.createElement("strong");
      reward.className = "login-track__reward";
      reward.textContent = `+${entry.tokens}`;

      item.append(day, reward);
      item.setAttribute(
        "aria-label",
        t(lang, `menu.login_reward.track_${entry.state}`, {
          day: entry.day,
          count: entry.tokens
        })
      );
      this.elements.menuLoginTrack.appendChild(item);
    }
  }

  private async refreshCurrentDailyBest(): Promise<void> {
    if (!this.storage) {
      return;
    }
    const todayKey = this.getCurrentDailyBestStorageKey();
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
    await this.refreshTrustedTime();
    await this.refreshCurrentDailyBest();
    if (this.normalizeDailyMissionStateForToday()) {
      await this.saveProgress();
      this.updateMenuStats();
    }
    await this.syncLoginReward();
  }

  private maybeSyncMenuDailyStateForRollover(): void {
    if (this.menuDailySyncInFlight) {
      return;
    }
    if (this.getCurrentDailyBestStorageKey() === this.currentDailyKey) {
      return;
    }
    this.menuDailySyncInFlight = true;
    void this.syncMenuDailyState().finally(() => {
      this.menuDailySyncInFlight = false;
    });
  }

  private async syncLoginReward(): Promise<void> {
    if (!this.storage) {
      return;
    }

    const dateKey = this.getCurrentCalendarDateKey();
    const reward = claimLoginReward(this.progress.loginReward, dateKey);
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
      date: dateKey
    });
    this.platform.track("loginRewardClaimed", {
      day: reward.day,
      rewardTokens: reward.tokens,
      date: dateKey
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
    this.updateResultsReturnNote();
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
    if (this.runDailyStreakDay > 0) {
      items.push(
        t(
          lang,
          this.runDailyStreakRewardTokens > 0
            ? "results.summary.daily_streak_bonus"
            : "results.summary.daily_streak",
          {
            day: this.runDailyStreakDay,
            count: this.runDailyStreakRewardTokens
          }
        )
      );
    }
    if (this.runWeeklyLoopDays > 0 && this.runWeeklyLoopGoalDays > 0) {
      items.push(
        t(
          lang,
          this.runWeeklyLoopRewardTokens > 0
            ? "results.summary.weekly_loop_bonus"
            : "results.summary.weekly_loop",
          {
            value: this.runWeeklyLoopDays,
            total: this.runWeeklyLoopGoalDays,
            count: this.runWeeklyLoopRewardTokens
          }
        )
      );
    }
    if (this.session.doubleTokensUsed) {
      items.push(t(lang, "results.summary.double_applied"));
    }
    const nextThemeTarget = this.getNextThemeTarget({ includePendingRunTokens: true });
    if (nextThemeTarget) {
      items.push(
        t(
          lang,
          nextThemeTarget.missingTokens > 0
            ? "results.summary.theme_target"
            : "results.summary.theme_ready",
          {
            theme: t(lang, `theme.name.${nextThemeTarget.theme.id}`),
            count: nextThemeTarget.missingTokens
          }
        )
      );
    }
    for (const milestone of this.runJourneyPreview.slice(0, 2)) {
      items.push(
        t(lang, "results.summary.goal_ready", {
          goal: t(lang, milestone.titleKey),
          count: milestone.rewardTokens
        })
      );
    }
    for (const mission of this.runDailyMissionPreview.slice(0, 2)) {
      items.push(
        t(lang, "results.summary.daily_mission_ready", {
          mission: t(lang, mission.titleKey),
          count: mission.rewardTokens
        })
      );
    }
    if (this.runJourneyPreview.length === 0 && this.runDailyMissionPreview.length === 0) {
      const nextStep = this.getResultsNextStep();
      if (nextStep) {
        items.push(this.formatResultsNextStep(nextStep, lang));
      }
    }

    this.elements.resultsSummary.hidden = items.length === 0;
    this.elements.resultsSummary.textContent = items.join(" • ");
  }

  private getResultsNextStep(): ResultsNextStep | null {
    if (!this.session || this.session.state.mode === "tutorial") {
      return null;
    }

    const dailyStatuses = applyCompletedRunToDailyMissions(
      this.progress.dailyMissions,
      this.getCurrentCalendarDateKey(),
      {
        mode: this.session.state.mode,
        linesCleared: this.session.state.linesCleared
      }
    ).statuses;

    return resolveResultsNextStep(
      dailyStatuses,
      this.progress.journey,
      this.buildJourneyContext({ includePendingRun: true })
    );
  }

  private formatResultsNextStep(nextStep: ResultsNextStep, lang: Language): string {
    if (nextStep.kind === "daily_mission_daily") {
      const streakStatus = getDailyStreakStatus(
        this.progress.dailyStreak,
        this.getCurrentCalendarDateKey()
      );
      if (
        !streakStatus.activeToday &&
        streakStatus.remainingDays === 1 &&
        streakStatus.nextMilestoneDay !== null
      ) {
        return t(lang, "results.summary.next_daily_streak", {
          day: streakStatus.nextMilestoneDay,
          count: streakStatus.nextMilestoneTokens
        });
      }
      const weeklyStatus = getWeeklyLoopStatus(
        this.progress.weeklyLoop,
        this.getCurrentCalendarDateKey()
      );
      if (
        !weeklyStatus.completedToday &&
        !weeklyStatus.complete &&
        weeklyStatus.nextMilestoneDay !== null &&
        weeklyStatus.nextMilestoneDay - weeklyStatus.completedDays === 1
      ) {
        return t(lang, "results.summary.next_weekly_loop", {
          value: weeklyStatus.completedDays + 1,
          total: weeklyStatus.nextMilestoneDay,
          count: weeklyStatus.nextMilestoneTokens
        });
      }
      return t(lang, "results.summary.next_daily_mission", {
        count: nextStep.rewardTokens
      });
    }
    if (nextStep.kind === "daily_mission_lines") {
      return t(lang, "results.summary.next_lines_mission", {
        value: nextStep.remaining,
        count: nextStep.rewardTokens
      });
    }
    if (nextStep.kind === "journey_runs") {
      return t(
        lang,
        nextStep.remaining === 1
          ? "results.summary.next_runs_goal.one"
          : "results.summary.next_runs_goal.other",
        {
          value: nextStep.remaining,
          goal: t(lang, nextStep.titleKey),
          count: nextStep.rewardTokens
        }
      );
    }
    return t(lang, "results.summary.next_score_goal", {
      value: nextStep.remaining,
      goal: t(lang, nextStep.titleKey),
      count: nextStep.rewardTokens
    });
  }

  private updateResultsReturnNote(): void {
    const note = this.elements.resultsReturnNote;
    if (!note || !this.session) {
      return;
    }

    const prompt = resolveResultsReturnPrompt(
      this.session.state.mode,
      getLoginRewardStatus(this.progress.loginReward, this.getCurrentCalendarDateKey())
    );
    if (!prompt) {
      note.hidden = true;
      note.textContent = "";
      note.classList.remove("results-return-note--ready");
      return;
    }

    const lang = this.progress.settings.language;
    note.hidden = false;
    note.classList.toggle("results-return-note--ready", prompt.kind === "ready");
    note.textContent =
      prompt.kind === "ready"
        ? t(lang, "results.return_ready", {
            day: prompt.day,
            count: prompt.tokens
          })
        : t(lang, "results.return_next", {
            time: this.formatResetCountdown(this.getMsUntilDailyReset(), lang),
            day: prompt.day,
            count: prompt.tokens
          });
  }

  private getThemeRewardEligibility(): { ok: boolean; reason?: string } {
    return this.getMenuRewardEligibility();
  }

  private getNextThemeTarget(options?: { includePendingRunTokens?: boolean }):
    | {
        theme: Theme;
        missingTokens: number;
        availableTokens: number;
      }
    | null {
    const availableTokens =
      this.progress.tokens + (options?.includePendingRunTokens ? this.runTokens : 0);
    const lockedTokenThemes = THEMES.filter((theme) => {
      if (this.progress.themesUnlocked.includes(theme.id)) {
        return false;
      }
      return theme.unlockType !== "offer";
    });
    if (lockedTokenThemes.length === 0) {
      return null;
    }

    const sorted = lockedTokenThemes
      .map((theme) => ({
        theme,
        missingTokens: Math.max(0, theme.price - availableTokens)
      }))
      .sort(
        (left, right) =>
          left.missingTokens - right.missingTokens ||
          left.theme.price - right.theme.price ||
          left.theme.id.localeCompare(right.theme.id)
      );

    const target = sorted[0];
    if (!target) {
      return null;
    }

    return {
      theme: target.theme,
      missingTokens: target.missingTokens,
      availableTokens
    };
  }

  private buildPendingLeaderboardEntry(duration: number): LeaderboardEntry | null {
    if (!this.session || this.session.state.mode === "tutorial") {
      return null;
    }

    const createdAt = Date.now();
    const dateKey = this.getCurrentCalendarDateKey();
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
    this.elements.menuReward.textContent = t(lang, "menu.rewarded", {
      count: this.monetization.menuRewardTokens
    });
    this.elements.menuReward.hidden = false;
    this.elements.menuReward.disabled = !eligibility.ok;
    let hint = t(lang, "hint.menu_reward", { count: this.monetization.menuRewardTokens });
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
    if (this.activeScreen === "menu" && !this.menuRewardOfferTracked) {
      this.platform.track("rewardOfferShown", {
        source: "menu",
        kind: "rewarded",
        eligible: eligibility.ok,
        reason: eligibility.reason ?? "available",
        rewardTokens: this.monetization.menuRewardTokens
      });
      this.menuRewardOfferTracked = true;
    }
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
    if (this.session.state.score < this.monetization.continueMinScore) {
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
    if (this.runTokens < this.monetization.doubleMinTokens) {
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
      await this.syncJourneyProgress({ showToast: true });
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

    const streakPreview = this.getDailyStreakPreview();
    this.runDailyStreakRewardTokens = streakPreview?.milestoneRewardTokens ?? 0;
    this.runDailyStreakDay = streakPreview?.advanced ? streakPreview.current : 0;
    const weeklyPreview = this.getWeeklyLoopPreview();
    this.runWeeklyLoopRewardTokens = weeklyPreview?.totalRewardTokens ?? 0;
    this.runWeeklyLoopDays = weeklyPreview?.advanced ? weeklyPreview.completedDays : 0;
    this.runWeeklyLoopGoalDays = weeklyPreview?.advanced ? weeklyPreview.goalDays : 0;

    const bonus =
      (this.runNewBest ? 2 : 0) +
      (this.runFirstDaily ? 3 : 0) +
      this.runDailyStreakRewardTokens +
      this.runWeeklyLoopRewardTokens;
    this.runBonusTokens = bonus;
    this.runTokens = baseTokens + bonus;
    this.pendingLeaderboardEntry = this.buildPendingLeaderboardEntry(duration);
    this.pendingLeaderboardSubmitted = false;
    if (this.pendingLeaderboardEntry) {
      const preview = recordLeaderboardEntry(this.leaderboard, this.pendingLeaderboardEntry);
      this.runLeaderboardRank = preview.overallRank;
      this.runDailyLeaderboardRank = preview.dailyRank;
    } else {
      this.runLeaderboardRank = null;
      this.runDailyLeaderboardRank = null;
    }
    this.runJourneyPreview = resolveJourneyProgress(
      this.progress.journey,
      this.buildJourneyContext({ includePendingRun: true })
    ).newlyClaimed;
    this.runDailyMissionPreview = applyCompletedRunToDailyMissions(
      this.progress.dailyMissions,
      this.getCurrentCalendarDateKey(),
      {
        mode: this.session.state.mode,
        linesCleared: this.session.state.linesCleared
      }
    ).newlyClaimed;
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
    if (this.shouldShowMidgameAd()) {
      this.requestMidgameAd();
    }

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
      if (!this.pendingLeaderboardSubmitted) {
        void this.leaderboardService
          .submit(this.pendingLeaderboardEntry)
          .then((submitted) => {
            if (submitted) {
              this.pendingLeaderboardSubmitted = true;
            }
          })
          .catch(() => undefined);
      }
    }
    await this.syncDailyMissionProgress({ showToast: true });
    await this.syncDailyStreakProgress({ showToast: true });
    await this.syncWeeklyLoopProgress({ showToast: true });
    await this.syncJourneyProgress({ showToast: true });
    await this.saveProgress();
    this.updateMenuStats();
  }

  private async syncDailyStreakProgress(options?: { showToast?: boolean }): Promise<void> {
    if (!this.session || this.session.state.mode !== "daily" || !this.runFirstDaily) {
      return;
    }

    const resolution = applyDailyCompletionToStreak(
      this.progress.dailyStreak,
      this.getCurrentCalendarDateKey()
    );
    if (!resolution.advanced) {
      return;
    }

    this.progress.dailyStreak = resolution.updatedState;
    await this.saveProgress();
    this.updateMenuStats();

    logger.info("dailyStreakUpdated", {
      day: resolution.current,
      milestoneReached: resolution.milestoneReached,
      rewardTokens: resolution.milestoneRewardTokens
    });
    this.platform.track("dailyStreakUpdated", {
      day: resolution.current,
      milestoneReached: resolution.milestoneReached ?? 0,
      rewardTokens: resolution.milestoneRewardTokens
    });

    if (!options?.showToast) {
      return;
    }

    const lang = this.progress.settings.language;
    this.toast.show(
      t(
        lang,
        resolution.milestoneRewardTokens > 0 ? "toast.daily_streak" : "toast.daily_streak_continue",
        {
          day: resolution.current,
          count: resolution.milestoneRewardTokens
        }
      )
    );
  }

  private async syncWeeklyLoopProgress(options?: { showToast?: boolean }): Promise<void> {
    if (!this.session || this.session.state.mode !== "daily" || !this.runFirstDaily) {
      return;
    }

    const resolution = applyDailyCompletionToWeeklyLoop(
      this.progress.weeklyLoop,
      this.getCurrentCalendarDateKey()
    );
    if (!resolution.advanced) {
      return;
    }

    this.progress.weeklyLoop = resolution.updatedState;
    await this.saveProgress();
    this.updateMenuStats();

    logger.info("weeklyLoopUpdated", {
      completedDays: resolution.completedDays,
      goalDays: resolution.goalDays,
      rewardTokens: resolution.totalRewardTokens
    });
    this.platform.track("weeklyLoopUpdated", {
      completedDays: resolution.completedDays,
      goalDays: resolution.goalDays,
      rewardTokens: resolution.totalRewardTokens
    });

    if (!options?.showToast || resolution.totalRewardTokens <= 0) {
      return;
    }

    const lang = this.progress.settings.language;
    this.toast.show(
      t(lang, "toast.weekly_loop", {
        value: resolution.completedDays,
        total: resolution.goalDays,
        count: resolution.totalRewardTokens
      })
    );
  }

  private updateResultsHints(): void {
    if (!this.session) {
      return;
    }
    this.updateResultsReturnNote();
    this.updateResultsReplayCta();
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
      if (this.elements.resultsAuth) {
        this.elements.resultsAuth.hidden = true;
        this.elements.resultsAuth.disabled = true;
      }
      if (this.elements.resultsStore) {
        this.elements.resultsStore.hidden = true;
        this.elements.resultsStore.disabled = true;
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
    const storeSelection = this.getResultsStoreOfferSelection();
    const storeHint = storeSelection ? this.getResultsStoreHint(storeSelection, lang) : null;
    const dailyResetHint = this.getResultsDailyResetHint(lang);
    const adsUnavailable =
      continueEligibility.reason === "ads_unavailable" &&
      doubleEligibility.reason === "ads_unavailable";

    this.updateResultsAuthPrompt();
    this.updateResultsStorePrompt();
    if (this.activeScreen === "results" && !this.resultsOffersTracked) {
      this.platform.track("rewardOfferShown", {
        source: "results",
        kind: "continue",
        eligible: continueEligibility.ok,
        reason: continueEligibility.reason ?? "available",
        score: this.session.state.score
      });
      this.platform.track("rewardOfferShown", {
        source: "results",
        kind: "double_tokens",
        eligible: doubleEligibility.ok,
        reason: doubleEligibility.reason ?? "available",
        runTokens: this.runTokens
      });
      this.resultsOffersTracked = true;
    }

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
      this.elements.resultsHint.textContent = storeHint ?? dailyResetHint ?? "";
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
        hints.add(
          t(lang, "hint.continue_need_score", { score: this.monetization.continueMinScore })
        );
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
      hints.add(
        t(lang, "hint.double_need_tokens", { count: this.monetization.doubleMinTokens })
      );
    } else if (doubleEligibility.reason === "already_used") {
      hints.add(t(lang, "hint.reward_already_used"));
    } else if (doubleEligibility.ok) {
      hints.add(t(lang, "hint.double_reward"));
    }
    const cooldownHint = this.getCooldownHint(continueEligibility, doubleEligibility, lang);
    if (cooldownHint) {
      hints.add(cooldownHint);
    }
    if (storeHint && hints.size < 2) {
      hints.add(storeHint);
    }
    if (dailyResetHint && hints.size < 2) {
      hints.add(dailyResetHint);
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
    this.platform.track("rewardOfferClicked", {
      source: "menu",
      kind: "rewarded",
      rewardTokens: this.monetization.menuRewardTokens
    });
    await this.requestRewarded("rewarded", () => {
      this.progress.tokens += this.monetization.menuRewardTokens;
      void this.saveProgress();
      this.updateMenuStats();
      this.toast.show(
        t(lang, "toast.rewarded_tokens", { count: this.monetization.menuRewardTokens })
      );
    });
    this.updateMenuRewardState();
  }

  private async tryThemeRewarded(themeId: string): Promise<void> {
    const eligibility = this.getThemeRewardEligibility();
    const lang = this.progress.settings.language;
    if (!eligibility.ok) {
      this.platform.track("rewardedDenied", {
        kind: "rewarded",
        source: "themes",
        reason: eligibility.reason ?? "unavailable"
      });
      if (eligibility.reason === "rewarded_cooldown") {
        this.toast.show(t(lang, "toast.rewarded_cooldown"));
      } else {
        this.toast.show(t(lang, "toast.ad_unavailable"));
      }
      return;
    }

    this.platform.track("rewardOfferClicked", {
      source: "themes",
      kind: "rewarded",
      rewardTokens: this.monetization.menuRewardTokens,
      themeId
    });
    await this.requestRewarded("rewarded", () => {
      this.progress.tokens += this.monetization.menuRewardTokens;
      void this.saveProgress();
      this.updateMenuStats();
      this.renderThemes();
      const nextTarget = this.getNextThemeTarget();
      if (nextTarget && nextTarget.theme.id === themeId && nextTarget.missingTokens === 0) {
        this.toast.show(
          t(lang, "toast.theme_ready", {
            theme: t(lang, `theme.name.${themeId}`)
          })
        );
        return;
      }
      this.toast.show(
        t(lang, "toast.rewarded_tokens", { count: this.monetization.menuRewardTokens })
      );
    });
    if (this.activeScreen === "themes") {
      this.renderThemes();
    }
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
        this.toast.show(
          t(lang, "toast.continue_need_score", { score: this.monetization.continueMinScore })
        );
      } else if (eligibility.reason === "no_space") {
        this.toast.show(t(lang, "toast.continue_no_space"));
      } else if (eligibility.reason === "already_used") {
        this.toast.show(t(lang, "toast.reward_already_used"));
      } else {
        this.toast.show(t(lang, "toast.continue_unavailable"));
      }
      return;
    }

    this.platform.track("rewardOfferClicked", {
      source: "results",
      kind: "continue",
      score: this.session.state.score
    });
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
      this.runJourneyPreview = [];
      this.runDailyMissionPreview = [];
      this.pendingLeaderboardEntry = null;
      this.pendingLeaderboardSubmitted = false;
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

    this.platform.track("rewardOfferClicked", {
      source: "results",
      kind: "double_tokens",
      runTokens: this.runTokens
    });
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

  private async tryResultsStoreOffer(): Promise<void> {
    const selection = this.getResultsStoreOfferSelection();
    if (!selection) {
      return;
    }
    await this.purchaseStoreOffer(selection.offerId, "results");
    this.updateResultsHints();
  }

  private shouldShowMidgameAd(): boolean {
    const interval = this.monetization.interstitialIntervalRuns;
    if (
      interval <= 0 ||
      !this.session ||
      this.session.state.mode === "tutorial" ||
      this.hasAdsDisabled()
    ) {
      return false;
    }
    return this.progress.runsCount > 0 && this.progress.runsCount % interval === 0;
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
      this.maybeSyncMenuDailyStateForRollover();
      this.updateMenuRewardState();
      this.updateMenuDailyStatus();
      this.updateMenuThemesCta();
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
    const currentThemeId = this.progress.settings.themeId;
    const nextThemeTarget = this.getNextThemeTarget();
    const rewardEligibility = this.getThemeRewardEligibility();
    this.elements.themesGrid.replaceChildren();

    for (const theme of THEMES) {
      const unlocked = this.progress.themesUnlocked.includes(theme.id);
      const selected = theme.id === currentThemeId;
      const isNextThemeTarget = nextThemeTarget?.theme.id === theme.id;

      const card = document.createElement("article");
      card.className = "theme-card";
      this.applyThemeCardVars(card, theme);
      if (selected) {
        card.classList.add("theme-card--active");
      } else if (unlocked) {
        card.classList.add("theme-card--owned");
      } else if (isNextThemeTarget) {
        card.classList.add("theme-card--focus");
      }

      const preview = this.createThemePreview(theme, lang);

      const title = document.createElement("strong");
      title.className = "theme-card__title";
      title.textContent = t(lang, `theme.name.${theme.id}`);

      const description = document.createElement("p");
      description.className = "theme-card__description";
      description.textContent = t(lang, `theme.description.${theme.id}`);

      const meta = document.createElement("span");
      meta.className = "theme-card__meta";
      if (selected) {
        meta.textContent = t(lang, "theme.meta.selected");
      } else if (unlocked) {
        meta.textContent = t(lang, "theme.meta.unlocked");
      } else if (theme.unlockType === "offer" && theme.offerId) {
        meta.textContent = t(lang, "theme.included_in_pack", {
          pack: t(lang, `store.offer.${theme.offerId}.short`)
        });
      } else {
        meta.textContent = t(lang, "theme.price", { price: theme.price });
      }

      const progress = document.createElement("p");
      progress.className = "theme-card__progress";
      progress.hidden = true;

      const action = document.createElement("button");
      action.className = "btn theme-card__action";

      if (unlocked) {
        action.textContent =
          selected ? t(lang, "theme.action.selected") : t(lang, "theme.action.select");
        action.disabled = selected;
        action.addEventListener("click", () => {
          this.audio.unlock();
          this.audio.playButton();
          this.progress.settings.themeId = theme.id;
          this.applySettings();
          this.renderThemes();
        });
      } else if (theme.unlockType === "offer" && theme.offerId) {
        action.textContent = t(lang, "theme.action.offer", {
          pack: t(lang, `store.offer.${theme.offerId}.short`)
        });
        action.disabled = true;
      } else if (this.progress.tokens >= theme.price) {
        action.textContent = t(lang, "theme.action.buy", { price: theme.price });
        if (isNextThemeTarget) {
          progress.hidden = false;
          progress.textContent = t(lang, "theme.progress.ready");
        }
        action.addEventListener("click", () => {
          this.audio.unlock();
          this.audio.playButton();
          void this.purchaseTheme(theme.id, theme.price);
        });
      } else {
        action.textContent = t(lang, "theme.action.need", { price: theme.price });
        action.disabled = true;
        if (isNextThemeTarget && nextThemeTarget) {
          progress.hidden = false;
          progress.textContent = t(lang, "theme.progress.need", {
            count: nextThemeTarget.missingTokens
          });
        }
      }

      if (!action.disabled) {
        action.classList.add("primary");
      }

      const rewardAction =
        !unlocked &&
        theme.unlockType !== "offer" &&
        isNextThemeTarget &&
        this.isRewardedAvailable()
          ? document.createElement("button")
          : null;

      if (rewardAction && nextThemeTarget) {
        rewardAction.className = "btn theme-card__reward";
        rewardAction.textContent = t(lang, "theme.action.reward", {
          count: this.monetization.menuRewardTokens
        });
        rewardAction.disabled = !rewardEligibility.ok;
        rewardAction.addEventListener("click", () => {
          this.audio.unlock();
          this.audio.playButton();
          void this.tryThemeRewarded(theme.id);
        });

        if (rewardEligibility.reason === "rewarded_cooldown") {
          const cooldowns = this.platform.getCooldownStatus();
          const remainingMs = Math.max(0, cooldowns.rewardedAvailableAt - Date.now());
          progress.hidden = false;
          progress.textContent = t(lang, "theme.progress.reward_cooldown", {
            time: this.formatDuration(remainingMs)
          });
        } else if (rewardEligibility.ok && nextThemeTarget.missingTokens > 0) {
          progress.hidden = false;
          progress.textContent = t(lang, "theme.progress.reward_ready", {
            count: this.monetization.menuRewardTokens
          });
        } else if (!rewardEligibility.ok && rewardEligibility.reason === "ads_unavailable") {
          rewardAction.hidden = true;
        }
      }

      card.appendChild(preview);
      card.appendChild(title);
      card.appendChild(description);
      card.appendChild(meta);
      if (!progress.hidden) {
        card.appendChild(progress);
      }
      card.appendChild(action);
      if (rewardAction && !rewardAction.hidden) {
        card.appendChild(rewardAction);
      }
      this.elements.themesGrid.appendChild(card);
    }
  }

  private applyThemeCardVars(element: HTMLElement, theme: Theme): void {
    const vars: Record<string, string> = {
      "--theme-sky-top": theme.atmosphere.skyTop,
      "--theme-sky-mid": theme.atmosphere.skyMid,
      "--theme-sky-bottom": theme.atmosphere.skyBottom,
      "--theme-bloom-a": theme.atmosphere.bloomA,
      "--theme-bloom-b": theme.atmosphere.bloomB,
      "--theme-bloom-c": theme.atmosphere.bloomC,
      "--theme-board": theme.palette.board,
      "--theme-grid": theme.palette.grid,
      "--theme-accent": theme.palette.accent,
      "--theme-accent-alt": theme.palette.accentAlt,
      "--theme-block": theme.palette.block,
      "--theme-block-top": theme.style.blockTop,
      "--theme-block-bottom": theme.style.blockBottom,
      "--theme-block-inner": theme.style.blockInner,
      "--theme-board-frame": theme.style.boardFrame,
      "--theme-board-glow": theme.style.boardGlow,
      "--theme-board-sheen": theme.style.boardSheen,
      "--theme-pattern": theme.style.patternColor,
      "--theme-sparkle": theme.style.sparkle
    };

    for (const [name, value] of Object.entries(vars)) {
      element.style.setProperty(name, value);
    }
  }

  private createThemePreview(theme: Theme, lang: Language): HTMLElement {
    const preview = document.createElement("div");
    preview.className = "theme-preview";
    preview.dataset.scenePattern = theme.style.scenePattern;
    preview.dataset.blockPattern = theme.style.blockPattern;
    preview.setAttribute("aria-hidden", "true");

    const chip = document.createElement("span");
    chip.className = "theme-preview__chip";
    chip.textContent = t(lang, `theme.motif.${theme.id}`);

    const spark = document.createElement("span");
    spark.className = "theme-preview__spark";

    const board = document.createElement("div");
    board.className = "theme-preview__board";
    board.dataset.scenePattern = theme.style.scenePattern;

    for (let index = 1; index <= 5; index += 1) {
      const block = document.createElement("span");
      block.className = `theme-preview__block theme-preview__block--${index}`;
      board.appendChild(block);
    }

    preview.append(chip, spark, board);
    return preview;
  }

  private async purchaseTheme(themeId: string, price: number): Promise<void> {
    this.platform.track("themePurchaseClicked", {
      themeId,
      price,
      tokensBefore: this.progress.tokens
    });
    this.progress.tokens -= price;
    this.progress.themesUnlocked.push(themeId);
    this.progress.settings.themeId = themeId;
    logger.info("purchaseTheme", { themeId });
    this.platform.track("purchaseTheme", {
      themeId,
      price
    });
    this.applySettings();
    await this.syncJourneyProgress({ showToast: true });
    await this.saveProgress();
    this.updateMenuStats();
    this.renderThemes();
    await this.maybeRequestReview("theme_purchase", {
      themeId,
      price
    });
  }

}
