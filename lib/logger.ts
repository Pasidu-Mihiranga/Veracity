/**
 * Structured JSON logger with request correlation IDs (Phase 2B).
 *
 * Usage:
 *   await withCorrelation(req, async () => {
 *     logger.info('chat.started', { userId });
 *   });
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = Record<string, unknown>;

type LogContext = {
  correlationId: string;
  userId?: string;
};

const storage = new AsyncLocalStorage<LogContext>();

function nowIso(): string {
  return new Date().toISOString();
}

function write(level: LogLevel, message: string, fields?: LogFields): void {
  const ctx = storage.getStore();
  const entry = {
    ts: nowIso(),
    level,
    msg: message,
    correlationId: ctx?.correlationId,
    userId: ctx?.userId,
    ...fields,
  };

  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, fields?: LogFields) => write('debug', message, fields),
  info: (message: string, fields?: LogFields) => write('info', message, fields),
  warn: (message: string, fields?: LogFields) => write('warn', message, fields),
  error: (message: string, fields?: LogFields) => write('error', message, fields),
};

/** Current correlation id (if inside withCorrelation). */
export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

export function getLogContext(): LogContext | undefined {
  return storage.getStore();
}

/**
 * Run `fn` with a correlation id from `x-correlation-id` or a fresh UUID.
 * Supports sync or async callbacks (ALS context is preserved across awaits).
 */
export function withCorrelation<T>(
  opts: { correlationId?: string | null; userId?: string | null },
  fn: () => T,
): T {
  const correlationId = (opts.correlationId?.trim() || randomUUID());
  const userId = opts.userId?.trim() || undefined;
  return storage.run({ correlationId, userId }, fn);
}

/** Capture an exception as structured JSON (Sentry-equivalent baseline). */
export function captureException(
  err: unknown,
  fields?: LogFields,
): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error('exception', {
    error: message,
    stack,
    ...fields,
  });
}

/**
 * Time an async tool/API call and log latency.
 */
export async function withToolLatency<T>(
  tool: string,
  fn: () => Promise<T>,
  fields?: LogFields,
): Promise<T> {
  const started = Date.now();
  try {
    const result = await fn();
    logger.info('tool.ok', {
      tool,
      latencyMs: Date.now() - started,
      ...fields,
    });
    return result;
  } catch (err) {
    logger.error('tool.failed', {
      tool,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
      ...fields,
    });
    throw err;
  }
}
