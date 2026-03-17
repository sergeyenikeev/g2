import type { PlatformId } from "./bridge";

const getProcessEnv = (): Record<string, string | undefined> | undefined => {
  const processLike = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process;
  return processLike?.env;
};

const isTestEnv = (): boolean => {
  const metaEnv = (import.meta as { env?: Record<string, unknown> }).env;
  if (typeof metaEnv?.VITEST === "boolean") {
    return metaEnv.VITEST;
  }
  const processEnv = getProcessEnv();
  if (processEnv) {
    return processEnv.VITEST === "true" || processEnv.NODE_ENV === "test";
  }
  return false;
};

const getEnvValue = (key: string): string | undefined => {
  const processEnv = getProcessEnv();
  if (isTestEnv()) {
    return processEnv?.[key];
  }
  const metaEnv = (import.meta as { env?: Record<string, string> }).env;
  const value = metaEnv?.[key];
  if (value && value.length > 0) {
    return value;
  }
  if (processEnv?.[key]) {
    return processEnv[key];
  }
  return undefined;
};

export const resolvePlatformId = (): PlatformId => {
  const raw = (getEnvValue("VITE_PLATFORM") ?? "generic").toLowerCase();
  switch (raw) {
    case "yandex":
    case "vkplay":
    case "rustore":
    case "generic":
      return raw;
    default:
      return "generic";
  }
};

export const resolveUseMock = (): boolean => {
  const raw = getEnvValue("VITE_USE_PLATFORM_MOCK");
  if (raw !== undefined) {
    return raw === "1" || raw.toLowerCase() === "true";
  }
  const metaEnv = (import.meta as { env?: Record<string, boolean> }).env;
  if (typeof metaEnv?.DEV === "boolean") {
    return metaEnv.DEV;
  }
  const processEnv = getProcessEnv();
  return processEnv ? processEnv.NODE_ENV !== "production" : false;
};
