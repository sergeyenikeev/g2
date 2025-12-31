export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

export interface LogEvent {
  level: LogLevel;
  event: string;
  data?: Record<string, unknown>;
  time: string;
}

const log = (level: LogLevel, event: string, data?: Record<string, unknown>): void => {
  const payload: LogEvent = {
    level,
    event,
    data,
    time: new Date().toISOString()
  };
  const output = JSON.stringify(payload);
  switch (level) {
    case "ERROR":
      console.error(output);
      break;
    case "WARN":
      console.warn(output);
      break;
    default:
      console.log(output);
  }
};

export const logger = {
  info: (event: string, data?: Record<string, unknown>) => log("INFO", event, data),
  warn: (event: string, data?: Record<string, unknown>) => log("WARN", event, data),
  error: (event: string, data?: Record<string, unknown>) => log("ERROR", event, data),
  debug: (event: string, data?: Record<string, unknown>) => {
    if (import.meta.env.DEV) {
      log("DEBUG", event, data);
    }
  }
};
