import type {
  LeaderboardBoard,
  LeaderboardSubmissionState,
  PlatformBridge,
  PlatformId,
  PlatformLeaderboardEntry,
  StorageScope
} from "../platform/bridge";
import type { StorageService } from "../services/storage";
import {
  createEmptyLeaderboard,
  MAX_LEADERBOARD_ENTRIES,
  parseLeaderboardEntryExtraData,
  serializeLeaderboardEntryExtraData,
  type LeaderboardEntry,
  type LeaderboardState,
  normalizeStoredLeaderboard
} from "./leaderboard";

const LEADERBOARD_STORAGE_KEY = "leaderboard";
const PLATFORM_SUBMIT_DELAY_MS = 1100;

export interface LeaderboardBoardMeta {
  source: "local" | "platform";
  scope: StorageScope | "platform";
  provider: PlatformId | null;
  submissionState: LeaderboardSubmissionState;
}

export interface LeaderboardMeta {
  overall: LeaderboardBoardMeta;
  daily: LeaderboardBoardMeta;
}

export class LeaderboardService {
  private platformSubmitQueue: Promise<void> = Promise.resolve();
  private platformSubmitDelayMs: number;

  constructor(
    private storage: StorageService,
    private platform: PlatformBridge,
    options?: { platformSubmitDelayMs?: number }
  ) {
    this.platformSubmitDelayMs = options?.platformSubmitDelayMs ?? PLATFORM_SUBMIT_DELAY_MS;
  }

  async load(dateKey: string): Promise<{ state: LeaderboardState; meta: LeaderboardMeta }> {
    const localState = await this.loadLocalState(dateKey);
    const localScope = this.platform.getStorageScope();
    const [overall, daily] = await Promise.all([
      this.loadBoardState("overall", localState.allTime, dateKey, localScope),
      this.loadBoardState("daily", localState.daily, dateKey, localScope)
    ]);

    return {
      state: {
        allTime: overall.entries,
        daily: daily.entries
      },
      meta: {
        overall: overall.meta,
        daily: daily.meta
      }
    };
  }

  async save(state: LeaderboardState): Promise<void> {
    await this.storage.set(LEADERBOARD_STORAGE_KEY, state);
  }

  async clear(dateKey: string): Promise<{ state: LeaderboardState; meta: LeaderboardMeta }> {
    await this.save(createEmptyLeaderboard());
    return this.load(dateKey);
  }

  async submit(entry: LeaderboardEntry): Promise<boolean> {
    const boards: LeaderboardBoard[] = entry.mode === "daily" ? ["overall", "daily"] : ["overall"];
    const jobs: Promise<void>[] = [];

    for (const board of boards) {
      const info = await this.platform.getLeaderboardInfo(board);
      if (!info.enabled || info.submissionState !== "enabled") {
        continue;
      }
      jobs.push(
        this.enqueuePlatformSubmit(async () => {
          await this.platform.submitLeaderboardScore({
            board,
            score: entry.score,
            extraData: serializeLeaderboardEntryExtraData(entry)
          });
        })
      );
    }

    if (jobs.length === 0) {
      return false;
    }

    await Promise.all(jobs);
    return true;
  }

  private async loadLocalState(dateKey: string): Promise<LeaderboardState> {
    const snapshot = await this.storage.getOptional<unknown>(LEADERBOARD_STORAGE_KEY);
    return normalizeStoredLeaderboard(snapshot, dateKey);
  }

  private async loadBoardState(
    board: LeaderboardBoard,
    localEntries: LeaderboardEntry[],
    dateKey: string,
    localScope: StorageScope
  ): Promise<{ entries: LeaderboardEntry[]; meta: LeaderboardBoardMeta }> {
    const info = await this.platform.getLeaderboardInfo(board);
    if (!info.enabled) {
      return {
        entries: localEntries,
        meta: this.createLocalBoardMeta(localScope)
      };
    }

    const snapshot = await this.platform.getLeaderboardSnapshot(board);
    if (!snapshot) {
      return {
        entries: localEntries,
        meta: this.createLocalBoardMeta(localScope)
      };
    }

    return {
      entries: snapshot.entries
        .slice(0, MAX_LEADERBOARD_ENTRIES)
        .map((entry, index) => this.createPlatformEntry(board, entry, index, dateKey)),
      meta: this.createPlatformBoardMeta(info.provider, info.submissionState)
    };
  }

  private createLocalBoardMeta(scope: StorageScope): LeaderboardBoardMeta {
    return {
      source: "local",
      scope,
      provider: null,
      submissionState: "unavailable"
    };
  }

  private createPlatformBoardMeta(
    provider: PlatformId | null,
    submissionState: LeaderboardSubmissionState
  ): LeaderboardBoardMeta {
    return {
      source: "platform",
      scope: "platform",
      provider,
      submissionState
    };
  }

  private createPlatformEntry(
    board: LeaderboardBoard,
    entry: PlatformLeaderboardEntry,
    index: number,
    dateKey: string
  ): LeaderboardEntry {
    const extra = parseLeaderboardEntryExtraData(entry.extraData, dateKey);
    const mode = board === "daily" ? "daily" : extra.mode === "daily" ? "daily" : "play";
    const playerName =
      extra.playerName && extra.playerName.length > 0 ? extra.playerName : entry.playerName;

    return {
      id: `platform_${board}_${entry.playerId ?? "hidden"}_${entry.rank}_${entry.score}_${index}`,
      playerName,
      score: Math.max(0, Math.floor(entry.score)),
      mode,
      level: extra.level ?? 1,
      lines: extra.lines ?? 0,
      moves: extra.moves ?? 0,
      durationMs: extra.durationMs ?? 0,
      seed: extra.seed ?? `platform-${board}`,
      createdAt: extra.createdAt ?? 0,
      dateKey: extra.dateKey ?? dateKey
    };
  }

  private enqueuePlatformSubmit(task: () => Promise<void>): Promise<void> {
    const scheduled = this.platformSubmitQueue.catch(() => undefined).then(task);
    this.platformSubmitQueue = scheduled.then(
      () => this.wait(this.platformSubmitDelayMs),
      () => this.wait(this.platformSubmitDelayMs)
    );
    return scheduled;
  }

  private async wait(ms: number): Promise<void> {
    if (ms <= 0) {
      return;
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
