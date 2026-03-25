const BASE = "core-service";

function createLogger(scope: string) {
  const PREFIX = `[${BASE}][${scope}]`;

  function formatMessage(level: string, msg: string, err?: unknown): string {
    const base = `${PREFIX} ${level} ${msg}`;
    if (err === undefined) return base;
    if (err instanceof Error) return `${base} ${err.message} ${err.stack ?? ""}`.trim();
    return `${base} ${String(err)}`;
  }

  return {
    error(msg: string, err?: unknown): void {
      console.error(formatMessage("ERROR", msg, err));
    },
    warn(msg: string, err?: unknown): void {
      console.warn(formatMessage("WARN", msg, err));
    },
    info(msg: string, err?: unknown): void {
      console.info(err !== undefined ? formatMessage("INFO", msg, err) : `${PREFIX} ${msg}`);
    },
    debug(msg: string, err?: unknown): void {
      if (process.env.DEBUG) {
        console.debug(err !== undefined ? formatMessage("DEBUG", msg, err) : `${PREFIX} ${msg}`);
      }
    }
  };
}

/**
 * Lightweight structured console logger for core-service.
 * - `logger` — Nest HTTP API process
 * - `relayLogger` — outbox relay subprocess (src/relay/main.ts)
 * Debug lines only when DEBUG is set.
 */
export const logger = createLogger("api");

/**
 * Lightweight structured console logger for core-service.
 * - `logger` — Nest HTTP API process
 * - `relayLogger` — outbox relay subprocess (src/relay/main.ts)
 * Debug lines only when DEBUG is set.
 */
export const relayLogger = createLogger("relay");
