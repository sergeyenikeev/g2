import { DAILY_SEED_SALT } from "./constants";

export const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
};

export const formatUtcDateKey = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
};

export const createDailySeedFromDateKey = (dateKey: string): string => `${dateKey}${DAILY_SEED_SALT}`;

export const createDailySeed = (date: Date): string => createDailySeedFromDateKey(formatDateKey(date));

export const dailyBestKeyFromDateKey = (dateKey: string): string => `dailyBest_${dateKey}`;

export const dailyBestKey = (date: Date): string => dailyBestKeyFromDateKey(formatDateKey(date));

export const getMsUntilNextDailyReset = (
  date: Date,
  options?: {
    useUtc?: boolean;
  }
): number => {
  const nextResetMs = options?.useUtc
    ? Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)
    : new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();

  return Math.max(0, nextResetMs - date.getTime());
};
