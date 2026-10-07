/**
 * Minimal structured logger.
 *
 * Emits one JSON object per line so logs are queryable in any aggregator
 * (Vercel, Datadog, Loki). Swap the transport for Sentry/Axiom by replacing
 * `write` — call sites stay the same.
 */

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const minLevel: Level =
  process.env.LOG_LEVEL === "debug"
    ? "debug"
    : process.env.NODE_ENV === "production"
      ? "info"
      : "debug";

const REDACT_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "tokenhash",
  "authorization",
  "cookie",
  "secret",
  "accesstoken",
]);

/** Strips secrets and truncates oversized values before serialisation. */
function sanitize(value: unknown, depth = 0): unknown {
  if (value == null || depth > 4) return value;

  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }

  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitize(v, depth + 1));

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACT_KEYS.has(key.toLowerCase()) ? "[redacted]" : sanitize(val, depth + 1);
    }
    return out;
  }

  if (typeof value === "string" && value.length > 500) return `${value.slice(0, 500)}…`;

  return value;
}

function write(level: Level, message: string, context?: Record<string, unknown>) {
  if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return;

  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    message,
    ...(context ? { context: sanitize(context) as Record<string, unknown> } : {}),
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => write("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => write("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => write("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => write("error", message, context),

  /** Binds context (request id, route) to every subsequent line. */
  child(bound: Record<string, unknown>) {
    return {
      debug: (m: string, c?: Record<string, unknown>) => write("debug", m, { ...bound, ...c }),
      info: (m: string, c?: Record<string, unknown>) => write("info", m, { ...bound, ...c }),
      warn: (m: string, c?: Record<string, unknown>) => write("warn", m, { ...bound, ...c }),
      error: (m: string, c?: Record<string, unknown>) => write("error", m, { ...bound, ...c }),
    };
  },
};
