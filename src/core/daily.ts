import { DAILY_SEED_SALT } from "./constants";

export const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
};

export const createDailySeed = (date: Date): string =>
  `${formatDateKey(date)}${DAILY_SEED_SALT}`;

export const dailyBestKey = (date: Date): string => `dailyBest_${formatDateKey(date)}`;
