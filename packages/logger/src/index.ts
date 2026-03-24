import pino from "pino";

const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";

export const logger = pino({
  level: LOG_LEVEL,
  base: {
    service: process.env.SERVICE_NAME ?? "avelero-api",
    env: process.env.NODE_ENV ?? "development",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

export type Logger = pino.Logger;

/**
 * Create a child logger with additional base context fields.
 *
 * Example: createChildLogger({ module: "billing" })
 */
export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
