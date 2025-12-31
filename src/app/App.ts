import { createDailySeed, dailyBestKey, formatDateKey } from "../core/daily";
import { canPlace } from "../core/board";
import { tokensFromScore } from "../core/game";
import { isContinueAllowed, isRewardedAllowed } from "../core/cooldowns";
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
import { CrazyGamesService } from "../services/crazygames";
import { LocalStorageProvider, StorageService } from "../services/storage";

interface SettingsState {
  audio: boolean;
  tapToPlace: boolean;
  themeId: string;
}

interface ProgressState {
  bestScore: number;
  tokens: number;
  themesUnlocked: string[];
  rewardCooldownUntil: number;
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

export class App {
  private screens!: ScreenManager;
  private renderer!: Renderer;
  private themeManager = new ThemeManager();
  private toast!: Toast;
  private debugOverlay!: DebugOverlay;
  private audio = new AudioManager();
  private sdk = new CrazyGamesService();
  private storage!: StorageService;
  private session: GameSession | null = null;
  private progress: ProgressState = this.defaultProgress();
  private activeScreen: ScreenId = "loading";
  private returnScreen: ScreenId = "menu";
  private lastRewardedRequestAt = 0;
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
  private selectedPieceId: string | null = null;
  private fpsSample = { last: 0, frames: 0, fps: 0 };

  private elements = {
    canvas: document.getElementById("game-canvas") as HTMLCanvasElement,
    menuBest: document.getElementById("menu-best") as HTMLElement,
    menuTokens: document.getElementById("menu-tokens") as HTMLElement,
    hudScore: document.getElementById("hud-score") as HTMLElement,
    hudCombo: document.getElementById("hud-combo") as HTMLElement,
    hudTokens: document.getElementById("hud-tokens") as HTMLElement,
    resultsScore: document.getElementById("results-score") as HTMLElement,
    resultsBest: document.getElementById("results-best") as HTMLElement,
    resultsTokens: document.getElementById("results-tokens") as HTMLElement,
    resultsHint: document.getElementById("results-hint") as HTMLElement,
    adblockBanner: document.getElementById("adblock-banner") as HTMLElement,
    themesGrid: document.getElementById("themes-grid") as HTMLElement,
    settingAudio: document.getElementById("setting-audio") as HTMLInputElement,
    settingTap: document.getElementById("setting-tap") as HTMLInputElement,
    toast: document.getElementById("toast") as HTMLElement,
    debug: document.getElementById("debug-overlay") as HTMLElement
  };

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

    this.sdk.loadingStart();
    await this.sdk.init();

    const dataModule = this.sdk.getDataModule();
    this.storage = new StorageService(dataModule ?? new LocalStorageProvider());
    await this.loadProgress();

    const theme = this.themeManager.setTheme(this.progress.settings.themeId);
    this.renderer = new Renderer(this.elements.canvas, theme, {
      board: this.session?.state.board ?? Array.from({ length: 10 }, () => Array(10).fill(0)),
      pieces: this.session?.pieces ?? [null, null, null]
    });

    this.attachEvents();
    this.applySettings();
    await this.checkAdblock();

    this.showScreen("menu");
    this.sdk.loadingStop();

    this.resize();
    requestAnimationFrame((t) => this.loop(t));
  }

  private attachEvents(): void {
    window.addEventListener("resize", () => this.resize());

    const play = document.getElementById("btn-play");
    const daily = document.getElementById("btn-daily");
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

    play?.addEventListener("click", () => void this.startRun("play"));
    daily?.addEventListener("click", () => void this.startRun("daily"));
    themes?.addEventListener("click", () => this.openThemes());
    settings?.addEventListener("click", () => this.openSettings("menu"));
    pause?.addEventListener("click", () => this.pauseGame());
    resume?.addEventListener("click", () => this.resumeGame());
    restart?.addEventListener("click", () => this.restartRun());
    pauseMenu?.addEventListener("click", () => this.returnToMenu());
    pauseSettings?.addEventListener("click", () => this.openSettings("pause"));
    resultsMenu?.addEventListener("click", () => this.returnToMenu());
    playAgain?.addEventListener("click", () => void this.playAgain());
    continueBtn?.addEventListener("click", () => this.tryContinue());
    doubleBtn?.addEventListener("click", () => this.tryDoubleTokens());
    themesBack?.addEventListener("click", () => this.showScreen("menu"));
    settingsClose?.addEventListener("click", () => this.closeSettings());

    this.elements.settingAudio.addEventListener("change", () => {
      this.progress.settings.audio = this.elements.settingAudio.checked;
      this.applySettings();
    });

    this.elements.settingTap.addEventListener("change", () => {
      this.progress.settings.tapToPlace = this.elements.settingTap.checked;
      this.saveProgress();
    });

    this.elements.canvas.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    this.elements.canvas.addEventListener("pointermove", (event) => this.onPointerMove(event));
    this.elements.canvas.addEventListener("pointerup", (event) => this.onPointerUp(event));
    this.elements.canvas.addEventListener("pointerleave", (event) => this.onPointerUp(event));
  }

  private async loadProgress(): Promise<void> {
    const defaults = this.defaultProgress();
    const bestScore = await this.storage.get("bestScore", defaults.bestScore);
    const tokens = await this.storage.get("tokens", defaults.tokens);
    const themesUnlocked = await this.storage.get("themesUnlocked", defaults.themesUnlocked);
    const rewardCooldownUntil = await this.storage.get(
      "rewardCooldownUntil",
      defaults.rewardCooldownUntil
    );
    const runsCount = await this.storage.get("runsCount", defaults.runsCount);
    const settings = await this.storage.get("settings", defaults.settings);

    this.progress = {
      bestScore,
      tokens,
      themesUnlocked: Array.from(new Set([...themesUnlocked, "lume"])),
      rewardCooldownUntil,
      runsCount,
      settings: { ...defaults.settings, ...settings }
    };

    this.elements.settingAudio.checked = this.progress.settings.audio;
    this.elements.settingTap.checked = this.progress.settings.tapToPlace;
    this.updateMenuStats();
  }

  private async saveProgress(): Promise<void> {
    await this.storage.set("bestScore", this.progress.bestScore);
    await this.storage.set("tokens", this.progress.tokens);
    await this.storage.set("themesUnlocked", this.progress.themesUnlocked);
    await this.storage.set("rewardCooldownUntil", this.progress.rewardCooldownUntil);
    await this.storage.set("runsCount", this.progress.runsCount);
    await this.storage.set("settings", this.progress.settings);
  }

  private applySettings(): void {
    this.audio.setMuted(!this.progress.settings.audio);
    this.themeManager.setTheme(this.progress.settings.themeId);
    if (this.renderer) {
      this.renderer.setTheme(this.themeManager.getTheme());
    }
    this.saveProgress();
  }

  private async checkAdblock(): Promise<void> {
    try {
      const adblock = await this.sdk.hasAdblock();
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
    this.sdk.gameplayStart();
  }

  private pauseGame(): void {
    if (this.activeScreen !== "game") {
      return;
    }
    this.showScreen("pause");
    this.sdk.gameplayStop();
  }

  private resumeGame(): void {
    if (this.activeScreen !== "pause") {
      return;
    }
    this.showScreen("game");
    this.sdk.gameplayStart();
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
    this.sdk.gameplayStop();
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

    this.sdk.gameplayStop();
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
    const canContinue = isContinueAllowed(
      this.session.state.score,
      this.session.continueUsed,
      this.progress.rewardCooldownUntil,
      Date.now()
    );
    const continueBtn = document.getElementById("btn-continue") as HTMLButtonElement;
    const doubleBtn = document.getElementById("btn-double") as HTMLButtonElement;

    continueBtn.disabled = !canContinue.ok || this.runFinalized;
    doubleBtn.disabled = this.session.doubleTokensUsed || this.runTokens < 2 || this.runFinalized;

    const hints: string[] = [];
    if (!canContinue.ok) {
      hints.push("Continue unavailable");
    }
    if (this.runTokens < 2) {
      hints.push("Need at least 2 tokens to double");
    }
    this.elements.resultsHint.textContent = hints.join(" - ");
  }

  private tryContinue(): void {
    if (!this.session) {
      return;
    }
    if (this.runFinalized) {
      this.toast.show("Continue unavailable");
      return;
    }
    const eligibility = isContinueAllowed(
      this.session.state.score,
      this.session.continueUsed,
      this.progress.rewardCooldownUntil,
      Date.now()
    );
    if (!eligibility.ok) {
      logger.warn("rewardedDenied", { reason: eligibility.reason ?? "continue_unavailable" });
      this.toast.show("Continue unavailable");
      return;
    }

    this.requestRewarded("continue", () => {
      this.session?.setContinuePieces();
      this.progress.rewardCooldownUntil = Date.now() + 10 * 60 * 1000;
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
      this.sdk.gameplayStart();
      logger.info("rewardedUsed", { kind: "continue" });
    });
  }

  private async tryDoubleTokens(): Promise<void> {
    if (!this.session) {
      return;
    }
    if (this.runFinalized) {
      return;
    }
    if (this.session.doubleTokensUsed || this.runTokens < 2) {
      logger.warn("rewardedDenied", { reason: "double_unavailable" });
      this.toast.show("Double tokens unavailable");
      return;
    }

    this.requestRewarded("double_tokens", () => {
      this.session!.doubleTokensUsed = true;
      this.runTokens *= 2;
      void this.finalizeRun();
      this.updateResults();
      this.updateResultsHints();
      logger.info("rewardedUsed", { kind: "double_tokens" });
    });
  }

  private requestMidgameAd(): void {
    logger.info("adRequested", { type: "midgame" });
    this.sdk.requestAd("midgame", {
      adStarted: () => logger.info("adStarted", { type: "midgame" }),
      adFinished: () => logger.info("adFinished", { type: "midgame" }),
      adError: (error) => logger.warn("adError", { type: "midgame", error })
    });
  }

  private requestRewarded(kind: "continue" | "double_tokens", onSuccess: () => void): void {
    const now = Date.now();
    if (!isRewardedAllowed(this.lastRewardedRequestAt, now)) {
      logger.warn("rewardedDenied", { reason: "rewarded_cooldown" });
      this.toast.show("Rewarded cooldown");
      return;
    }
    this.lastRewardedRequestAt = now;
    const wasGameplay = this.activeScreen === "game";

    logger.info("adRequested", { type: "rewarded", kind });
    this.sdk.requestAd("rewarded", {
      adStarted: () => {
        logger.info("adStarted", { type: "rewarded", kind });
        this.audio.setMuted(true);
        if (wasGameplay) {
          this.sdk.gameplayStop();
        }
      },
      adFinished: () => {
        logger.info("adFinished", { type: "rewarded", kind });
        this.audio.setMuted(!this.progress.settings.audio);
        if (wasGameplay) {
          this.sdk.gameplayStart();
        }
        onSuccess();
      },
      adError: (error) => {
        logger.warn("adError", { type: "rewarded", kind, error });
        this.audio.setMuted(!this.progress.settings.audio);
        if (wasGameplay) {
          this.sdk.gameplayStart();
        }
        this.toast.show("Ad unavailable");
      }
    });
  }

  private onPointerDown(event: PointerEvent): void {
    if (!this.session || this.activeScreen !== "game") {
      return;
    }
    const point = this.getCanvasPoint(event);
    const pieceId = this.renderer.hitTestPiece(point);
    const isTapMode = this.progress.settings.tapToPlace && event.pointerType !== "mouse";

    if (isTapMode) {
      if (pieceId) {
        this.selectedPieceId = pieceId;
        this.renderer.setState({ selectedPieceId: pieceId });
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
      this.dragging = {
        pieceId,
        offsetX: point.x - rect.x,
        offsetY: point.y - rect.y
      };
      this.renderer.setState({
        dragging: { pieceId, x: rect.x, y: rect.y },
        selectedPieceId: null,
        ghost: undefined
      });
    }
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.session || this.activeScreen !== "game" || !this.dragging) {
      return;
    }
    const point = this.getCanvasPoint(event);
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
    if (!this.session || this.activeScreen !== "game" || !this.dragging) {
      return;
    }
    const point = this.getCanvasPoint(event);
    const piece = this.session.pieces.find((slot) => slot?.instanceId === this.dragging?.pieceId);
    if (!piece) {
      return;
    }

    const dragX = point.x - this.dragging.offsetX;
    const dragY = point.y - this.dragging.offsetY;
    const ghost = this.getGhostPlacement(piece, { x: dragX, y: dragY });

    if (ghost && ghost.valid) {
      this.commitPlacement(piece.instanceId, ghost.origin);
    }

    this.dragging = null;
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
      this.toast.show("Can't place there");
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
      return;
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
    this.sdk.happytime();
  }

  private resize(): void {
    if (this.renderer) {
      this.renderer.resize();
    }
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
    this.debugOverlay.update({
      fps: this.fpsSample.fps,
      seed: this.session.state.seed,
      combo: this.session.state.combo,
      nextPieces: this.session.pieces
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
    this.elements.themesGrid.innerHTML = "";
    for (const theme of THEMES) {
      const card = document.createElement("div");
      card.className = "theme-card";

      const preview = document.createElement("div");
      preview.className = "theme-preview";
      preview.style.background = `linear-gradient(135deg, ${theme.palette.block}, ${theme.palette.accentAlt})`;

      const title = document.createElement("strong");
      title.textContent = theme.name;

      const cost = document.createElement("span");
      cost.textContent = `${theme.price} Tokens`;

      const action = document.createElement("button");
      action.className = "btn";

      const unlocked = this.progress.themesUnlocked.includes(theme.id);
      if (unlocked) {
        action.textContent = theme.id === this.progress.settings.themeId ? "Selected" : "Select";
        action.disabled = theme.id === this.progress.settings.themeId;
        action.addEventListener("click", () => {
          this.progress.settings.themeId = theme.id;
          this.applySettings();
          this.renderThemes();
        });
      } else if (this.progress.tokens >= theme.price) {
        action.textContent = `Buy (${theme.price})`;
        action.addEventListener("click", () => {
          this.progress.tokens -= theme.price;
          this.progress.themesUnlocked.push(theme.id);
          this.progress.settings.themeId = theme.id;
          logger.info("purchaseTheme", { themeId: theme.id });
          this.applySettings();
          this.updateMenuStats();
          this.renderThemes();
        });
      } else {
        action.textContent = `Need ${theme.price}`;
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
      rewardCooldownUntil: 0,
      runsCount: 0,
      settings: {
        audio: true,
        tapToPlace: isTouch,
        themeId: "lume"
      }
    };
  }
}
