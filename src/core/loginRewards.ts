import { formatDateKey } from "./daily";

export const LOGIN_REWARD_SEQUENCE = [1, 2, 3, 4, 5] as const;
export const LOGIN_REWARD_CYCLE_LENGTH = LOGIN_REWARD_SEQUENCE.length;

export interface LoginRewardState {
  cycleDay: number;
  lastClaimDate: string | null;
}

export interface LoginRewardStatus {
  claimedToday: boolean;
  day: number;
  tokens: number;
  nextDay: number;
  nextTokens: number;
}

export interface LoginRewardClaimResult extends LoginRewardStatus {
  granted: boolean;
  state: LoginRewardState;
}

export interface LoginRewardTrackEntry {
  day: number;
  tokens: number;
  state: "claimed" | "ready" | "next" | "locked";
}

type LoginRewardDateInput = Date | string;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeCycleDay = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  const normalized = Math.floor(value);
  if (normalized < 0) {
    return 0;
  }
  return Math.min(normalized, LOGIN_REWARD_CYCLE_LENGTH);
};

const normalizeDateKey = (value: unknown): string | null => {
  if (typeof value !== "string" || !/^\d{8}$/.test(value)) {
    return null;
  }
  return value;
};

const resolveDateKey = (input: LoginRewardDateInput): string =>
  typeof input === "string" ? input : formatDateKey(input);

const toEpochDay = (dateKey: string): number => {
  const year = Number.parseInt(dateKey.slice(0, 4), 10);
  const month = Number.parseInt(dateKey.slice(4, 6), 10);
  const day = Number.parseInt(dateKey.slice(6, 8), 10);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
};

const getDayDistance = (fromDateKey: string, toDateKey: string): number =>
  toEpochDay(toDateKey) - toEpochDay(fromDateKey);

const resolveClaimDay = (state: LoginRewardState): number => {
  const cycleDay = normalizeCycleDay(state.cycleDay);
  return cycleDay > 0 ? cycleDay : 1;
};

const shouldResetCycle = (state: LoginRewardState, todayKey: string): boolean => {
  if (!state.lastClaimDate || state.lastClaimDate === todayKey) {
    return false;
  }

  return getDayDistance(state.lastClaimDate, todayKey) !== 1;
};

export const createDefaultLoginRewardState = (): LoginRewardState => ({
  cycleDay: 0,
  lastClaimDate: null
});

export const normalizeLoginRewardState = (value: unknown): LoginRewardState => {
  const raw = isRecord(value) ? value : {};
  return {
    cycleDay: normalizeCycleDay(raw.cycleDay),
    lastClaimDate: normalizeDateKey(raw.lastClaimDate)
  };
};

export const getNextLoginRewardDay = (state: LoginRewardState, date: LoginRewardDateInput): number => {
  const todayKey = resolveDateKey(date);
  if (shouldResetCycle(state, todayKey)) {
    return 1;
  }
  return (normalizeCycleDay(state.cycleDay) % LOGIN_REWARD_CYCLE_LENGTH) + 1;
};

export const getLoginRewardTokens = (day: number): number => {
  const normalizedDay = Math.min(Math.max(Math.floor(day), 1), LOGIN_REWARD_CYCLE_LENGTH);
  return LOGIN_REWARD_SEQUENCE[normalizedDay - 1] ?? LOGIN_REWARD_SEQUENCE[0];
};

export const getLoginRewardStatus = (
  state: LoginRewardState,
  date: LoginRewardDateInput
): LoginRewardStatus => {
  const todayKey = resolveDateKey(date);
  const claimedToday = state.lastClaimDate === todayKey;
  const day = claimedToday ? resolveClaimDay(state) : getNextLoginRewardDay(state, date);
  const nextDay = (day % LOGIN_REWARD_CYCLE_LENGTH) + 1;

  return {
    claimedToday,
    day,
    tokens: getLoginRewardTokens(day),
    nextDay,
    nextTokens: getLoginRewardTokens(nextDay)
  };
};

export const getLoginRewardTrack = (
  state: LoginRewardState,
  date: LoginRewardDateInput
): LoginRewardTrackEntry[] => {
  const todayKey = resolveDateKey(date);
  const status = getLoginRewardStatus(state, date);
  const claimedCount = status.claimedToday
    ? resolveClaimDay(state)
    : shouldResetCycle(state, todayKey)
      ? 0
      : normalizeCycleDay(state.cycleDay);

  return LOGIN_REWARD_SEQUENCE.map((_, index) => {
    const day = index + 1;
    let entryState: LoginRewardTrackEntry["state"] = "locked";

    if (day <= claimedCount) {
      entryState = "claimed";
    } else if (!status.claimedToday && day === status.day) {
      entryState = "ready";
    } else if (day === status.nextDay) {
      entryState = "next";
    }

    return {
      day,
      tokens: getLoginRewardTokens(day),
      state: entryState
    };
  });
};

export const claimLoginReward = (
  state: LoginRewardState,
  date: LoginRewardDateInput
): LoginRewardClaimResult => {
  const todayKey = resolveDateKey(date);
  if (state.lastClaimDate === todayKey) {
    return {
      granted: false,
      state,
      ...getLoginRewardStatus(state, date)
    };
  }

  const day = getNextLoginRewardDay(state, date);
  const nextDay = (day % LOGIN_REWARD_CYCLE_LENGTH) + 1;

  return {
    granted: true,
    claimedToday: true,
    day,
    tokens: getLoginRewardTokens(day),
    nextDay,
    nextTokens: getLoginRewardTokens(nextDay),
    state: {
      cycleDay: day,
      lastClaimDate: todayKey
    }
  };
};
