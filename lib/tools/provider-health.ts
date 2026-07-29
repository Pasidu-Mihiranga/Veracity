export type ProviderFailure = {
  failed: boolean;
  code?: string;
  message?: string;
};

const FAILURE_STATUS = new Set([
  'failed',
  'error',
  'aborted',
  'timed-out',
  'timeout',
  'not-found',
]);

export function detectProviderFailure(payload: unknown): ProviderFailure {
  if (!payload || typeof payload !== 'object') return { failed: false };
  const value = payload as Record<string, unknown>;
  const nested = value.data && typeof value.data === 'object'
    ? value.data as Record<string, unknown>
    : {};
  const status = String(
    value.status ?? nested.status ?? value.state ?? nested.state ?? '',
  ).toLowerCase();
  const success = value.success ?? nested.success;
  const message = firstString(
    value.error,
    nested.error,
    value.message,
    nested.message,
    value.detail,
    nested.detail,
  );
  const code = firstString(value.code, nested.code);
  const failureLanguage = /quota|credit|subscription|billing|rate.?limit|unauthori[sz]ed|forbidden|payment|exhausted/i;
  const failed = success === false ||
    FAILURE_STATUS.has(status) ||
    Boolean(message && failureLanguage.test(message)) ||
    Boolean(code && failureLanguage.test(code));
  return {
    failed,
    ...(code ? { code } : {}),
    ...(message ? { message } : {}),
  };
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string =>
    typeof value === 'string' && value.trim().length > 0,
  )?.trim();
}

