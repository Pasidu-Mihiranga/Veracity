export type ChatErrorCode =
  | 'rate_limit'
  | 'provider_unavailable'
  | 'network'
  | 'timeout'
  | 'auth'
  | 'internal';

export type ChatErrorPayload = {
  code: ChatErrorCode;
  /** Short message safe to show any user */
  userMessage: string;
  /** Raw / technical message for logs and developer mode */
  detail: string;
  correlationId?: string;
};

export function buildChatErrorPayload(
  err: unknown,
  correlationId?: string,
): ChatErrorPayload {
  let detail = '';
  if (err instanceof Error) {
    detail = err.message || err.name;
  } else if (typeof err === 'string') {
    detail = err;
  } else if (err && typeof err === 'object') {
    if ('message' in err && typeof (err as any).message === 'string') {
      detail = (err as any).message;
    } else if ('error' in err && typeof (err as any).error === 'string') {
      detail = (err as any).error;
    } else if ('type' in err && (err as any).type === 'error') {
      detail = 'Connection interrupted or network stream event failed';
    } else {
      try {
        detail = JSON.stringify(err);
      } catch {
        detail = 'A network or stream event error occurred';
      }
    }
  } else {
    detail = String(err);
  }

  if (detail === '[object Event]' || detail === '[object Object]') {
    detail = 'Connection interrupted or network stream disconnected';
  }

  const lower = detail.toLowerCase();

  if (/429|rate limit|quota|resource exhausted|too many requests/i.test(lower)) {
    return {
      code: 'rate_limit',
      userMessage:
        'The AI service is rate-limited right now. Wait about a minute, then try again or use a shorter question.',
      detail,
      correlationId,
    };
  }

  if (/401|403|unauthorized|forbidden|invalid api key|api key/i.test(lower)) {
    return {
      code: 'auth',
      userMessage:
        'We could not reach the AI service with the current API credentials. An admin should check Gemini API keys in the environment.',
      detail,
      correlationId,
    };
  }

  if (/fetch failed|network|econnreset|etimedout|socket|dns/i.test(lower)) {
    return {
      code: 'network',
      userMessage:
        'Network error while talking to the AI service. Check your connection and try again.',
      detail,
      correlationId,
    };
  }

  if (/timeout|timed out|deadline|maxduration/i.test(lower)) {
    return {
      code: 'timeout',
      userMessage:
        'This request took too long and was stopped. Try a narrower question or run a full sweep later.',
      detail,
      correlationId,
    };
  }

  if (/503|502|504|unavailable|overloaded|failed after \d+ retries/i.test(lower)) {
    return {
      code: 'provider_unavailable',
      userMessage:
        'The AI provider is temporarily unavailable. Please retry in a moment.',
      detail,
      correlationId,
    };
  }

  return {
    code: 'internal',
    userMessage:
      'Something went wrong while running this analysis. Please try again.',
    detail,
    correlationId,
  };
}

export function buildChatErrorFromStreamChunk(chunk: {
  message: string;
  code?: string;
  correlationId?: string;
  detail?: string;
}): ChatErrorPayload {
  if (chunk.code && chunk.detail) {
    const code = chunk.code as ChatErrorCode;
    return {
      code,
      userMessage: chunk.message,
      detail: chunk.detail,
      correlationId: chunk.correlationId,
    };
  }
  return buildChatErrorPayload(new Error(chunk.message), chunk.correlationId);
}

/** Render text in the chat bubble; developer mode adds code, detail, and ref id. */
export function formatChatErrorForDisplay(
  payload: ChatErrorPayload,
  devMode: boolean,
): string {
  if (!devMode) {
    return payload.userMessage;
  }
  const ref = payload.correlationId ? `\n\nReference: ${payload.correlationId}` : '';
  return `${payload.userMessage}\n\n[${payload.code}] ${payload.detail}${ref}`;
}

export function orchestrationLogLineForError(payload: ChatErrorPayload): string {
  const ref = payload.correlationId ? ` (ref ${payload.correlationId})` : '';
  return `Error [${payload.code}]: ${payload.userMessage}${ref}`;
}
