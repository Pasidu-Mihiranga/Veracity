import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes, randomUUID } from 'node:crypto';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFields = Record<string, unknown>;

export type LogContext = {
  correlationId: string;
  requestId: string;
  traceId: string;
  spanId: string;
  userId?: string;
  sessionId?: string;
  conversationId?: string;
};

const storage = new AsyncLocalStorage<LogContext>();
const tracer = trace.getTracer('veracity-phase2');

function nowIso(): string {
  return new Date().toISOString();
}

function randomTraceId() {
  return randomBytes(16).toString('hex');
}

function randomSpanId() {
  return randomBytes(8).toString('hex');
}

function write(level: LogLevel, message: string, fields?: LogFields): void {
  const ctx = storage.getStore();
  const entry = {
    ts: nowIso(),
    level,
    msg: message,
    correlationId: ctx?.correlationId,
    requestId: ctx?.requestId,
    traceId: ctx?.traceId,
    spanId: ctx?.spanId,
    userId: ctx?.userId,
    sessionId: ctx?.sessionId,
    conversationId: ctx?.conversationId,
    ...fields,
  };

  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: LogFields) => write('debug', message, fields),
  info: (message: string, fields?: LogFields) => write('info', message, fields),
  warn: (message: string, fields?: LogFields) => write('warn', message, fields),
  error: (message: string, fields?: LogFields) => write('error', message, fields),
};

export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

export function getLogContext(): LogContext | undefined {
  return storage.getStore();
}

export function getRequestContext(): LogContext | undefined {
  return storage.getStore();
}

export function withCorrelation<T>(
  opts: {
    correlationId?: string | null;
    requestId?: string | null;
    traceId?: string | null;
    spanId?: string | null;
    userId?: string | null;
    sessionId?: string | null;
    conversationId?: string | null;
  },
  fn: () => T,
): T {
  const correlationId = opts.correlationId?.trim() || randomUUID();
  const requestId = opts.requestId?.trim() || correlationId;
  const traceId = opts.traceId?.trim() || randomTraceId();
  const spanId = opts.spanId?.trim() || randomSpanId();
  const userId = opts.userId?.trim() || undefined;
  const sessionId = opts.sessionId?.trim() || undefined;
  const conversationId = opts.conversationId?.trim() || sessionId;
  return storage.run({ correlationId, requestId, traceId, spanId, userId, sessionId, conversationId }, fn);
}

export async function withSpan<T>(
  name: string,
  fields: LogFields,
  fn: () => Promise<T>,
): Promise<T> {
  const parent = storage.getStore();
  return tracer.startActiveSpan(name, async (span) => {
    const spanCtx = span.spanContext();
    const traceId = spanCtx.traceId && !/^0+$/.test(spanCtx.traceId) ? spanCtx.traceId : parent?.traceId || randomTraceId();
    const spanId = spanCtx.spanId && !/^0+$/.test(spanCtx.spanId) ? spanCtx.spanId : randomSpanId();
    return storage.run(
      {
        correlationId: parent?.correlationId || randomUUID(),
        requestId: parent?.requestId || randomUUID(),
        traceId,
        spanId,
        userId: parent?.userId,
        sessionId: typeof fields.sessionId === 'string' ? fields.sessionId : parent?.sessionId,
        conversationId: typeof fields.conversationId === 'string' ? fields.conversationId : parent?.conversationId,
      },
      async () => {
        try {
          const result = await fn();
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (err) {
          span.recordException(err as Error);
          span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : String(err) });
          throw err;
        } finally {
          span.end();
        }
      },
    );
  });
}

export function captureException(err: unknown, fields?: LogFields): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error('exception', {
    error: message,
    stack,
    ...fields,
  });

  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (dsn) {
    import('@sentry/nextjs')
      .then((Sentry) => {
        Sentry.captureException(err, { extra: { ...fields, requestContext: getRequestContext() } });
      })
      .catch(() => {});
  }
}

export async function withToolLatency<T>(
  tool: string,
  fn: () => Promise<T>,
  fields?: LogFields,
): Promise<T> {
  const started = Date.now();
  return withSpan(`tool:${tool}`, { tool, ...fields }, async () => {
    try {
      const result = await fn();
      const outcome = classifyToolOutcome(result);
      const log = outcome.status === 'failed'
        ? logger.warn.bind(logger)
        : outcome.status === 'degraded'
          ? logger.warn.bind(logger)
          : logger.info.bind(logger);
      log(`tool.${outcome.status}`, {
        tool,
        latencyMs: Date.now() - started,
        success: outcome.status !== 'failed',
        ...(outcome.providerError ? { providerError: outcome.providerError } : {}),
        ...fields,
      });
      return result;
    } catch (err) {
      logger.error('tool.failed', {
        tool,
        latencyMs: Date.now() - started,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        ...fields,
      });
      throw err;
    }
  });
}

export function classifyToolOutcome(result: unknown): {
  status: 'ok' | 'degraded' | 'failed';
  providerError?: string;
} {
  if (!result || typeof result !== 'object') return { status: 'ok' };
  const value = result as { status?: unknown; providerError?: unknown };
  const status = value.status === 'failed' || value.status === 'degraded' || value.status === 'ok'
    ? value.status
    : 'ok';
  return {
    status,
    ...(typeof value.providerError === 'string' && value.providerError.trim()
      ? { providerError: value.providerError.trim() }
      : {}),
  };
}
