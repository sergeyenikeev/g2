import { PlatformId } from "./bridge";

const isTestEnv = (): boolean => {
  const metaEnv = (import.meta as { env?: Record<string, unknown> }).env;
  if (typeof metaEnv?.VITEST === "boolean") {
    return metaEnv.VITEST;
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
  }
  return false;
};

const getEnvValue = (key: string): string | undefined => {
  if (isTestEnv()) {
    return typeof process !== "undefined" ? process.env?.[key] : undefined;
  }
  const metaEnv = (import.meta as { env?: Record<string, string> }).env;
  const value = metaEnv?.[key];
  if (value && value.length > 0) {
    return value;
  }
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key];
  }
  return undefined;
};

export const resolvePlatformId = (): PlatformId => {
  const raw = (getEnvValue("VITE_PLATFORM") ?? "generic").toLowerCase();
  switch (raw) {
    case "crazygames":
    case "poki":
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
  return typeof process !== "undefined" ? process.env.NODE_ENV !== "production" : false;
};
