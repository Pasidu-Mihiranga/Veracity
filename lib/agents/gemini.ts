import { getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';
import { recordGeminiUsage } from '@/lib/gemini-usage';

/** Reliable free-tier Flash-Lite (new keys often cannot use 2.5-flash). */
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-001';

/**
 * Free-tier model chain. Older 2.x Flash IDs return 404 for many new keys.
 * Order: env/default first, then stable free Flash options.
 */
export const GEMINI_FREE_MODEL_FALLBACKS = [
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash',
] as const;
// DB column is `vector(768)`. gemini-embedding-001 default is 3072 dims, so
// we explicitly request 768 via outputDimensionality and re-normalize the
// returned vector (Gemini docs: normalization is required for <3072 dims).
//
// Gemini 2.5 models have built-in "thinking" that consumes output tokens
// before emitting the actual response. Thinking budget defaults come from
// lib/config.ts (`GEMINI_THINKING_BUDGET`, default 0 = disabled).

// Raised defaults: the previous 1024/1400 limits were too low for complex
// agent outputs (matrices, distributions, contributingSignals) once thinking
// tokens were removed we still want room for large structured responses.
const DEFAULT_TEXT_MAX_OUTPUT = 2048;
const DEFAULT_JSON_MAX_OUTPUT = 4096;

type GeminiOptions = {
  model?: string;
  maxNewTokens?: number;
  temperature?: number;
  thinkingBudget?: number; // override per-call; 0 disables, -1 = dynamic
};

function safePreview(value: string, maxLength = 300): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

/** Primary key first, then optional fallback key (quota / auth failures). */
export function geminiApiKeyCandidates(): string[] {
  const cfg = getConfig();
  const keys = [cfg.GEMINI_API_KEY, cfg.GEMINI_API_KEY_FALLBACK]
    .map((k) => k?.trim())
    .filter((k): k is string => Boolean(k && k.length > 0));
  return [...new Set(keys)];
}

function resolveModel(override?: string): string {
  return override?.trim() || getConfig().GEMINI_MODEL || DEFAULT_MODEL;
}

function modelCandidates(preferred: string): string[] {
  const ordered = [preferred, ...GEMINI_FREE_MODEL_FALLBACKS];
  return [...new Set(ordered.map((m) => m.trim()).filter(Boolean))];
}

function isModelUnavailableError(status: number, body: string): boolean {
  if (status !== 404) return false;
  return /no longer available|NOT_FOUND|is not found|not supported/i.test(body);
}

/** Auth / quota failures that warrant trying GEMINI_API_KEY_FALLBACK. */
function isApiKeyFailure(status: number): boolean {
  return status === 401 || status === 403 || status === 429;
}

function keyLabel(index: number): string {
  return index === 0 ? 'primary' : `fallback-${index}`;
}

function resolveEmbeddingModel(): string {
  const cfg = getConfig();
  return cfg.GEMINI_EMBEDDING_MODEL || cfg.HUGGING_FACE_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
}

/** URL without secrets — API key is sent via `x-goog-api-key` (TASK-1.1). */
export function geminiGenerateContentUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

export function geminiEmbedContentUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`;
}

export function geminiAuthHeaders(apiKey: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
  };
}

function buildGenerationConfig(
  options: GeminiOptions,
  defaultMax: number,
  responseMimeType?: string,
): Record<string, unknown> {
  const budget = options.thinkingBudget ?? getConfig().GEMINI_THINKING_BUDGET;
  const generationConfig: Record<string, unknown> = {
    temperature: options.temperature ?? 0.2,
    maxOutputTokens: options.maxNewTokens ?? defaultMax,
    thinkingConfig: { thinkingBudget: budget },
  };
  if (responseMimeType) generationConfig.responseMimeType = responseMimeType;
  return generationConfig;
}

async function fetchWithRetry(url: string, init?: RequestInit, retries = 5, delay = 1000): Promise<Response> {
  let lastError: unknown;
  let lastThrottle: Response | undefined;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, init);
      if (response.status === 429 || response.status === 503) {
        lastThrottle = response;
        logger.warn('gemini.retry', {
          status: response.status,
          attempt: i + 1,
          retries,
          delayMs: delay,
        });
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2.5;
        continue;
      }
      return response;
    } catch (err: unknown) {
      lastError = err;
      logger.warn('gemini.fetch_error', {
        error: err instanceof Error ? err.message : String(err),
        attempt: i + 1,
        retries,
        delayMs: delay,
      });
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2.5;
    }
  }
  if (lastThrottle) return lastThrottle;
  throw lastError || new Error(`Failed after ${retries} retries`);
}

function parseGeminiBody(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function noteUsage(parsed: Record<string, unknown> | null, model: string, kind: string): void {
  if (!parsed) return;
  const usage = recordGeminiUsage(parsed);
  if (!usage) return;
  logger.info('gemini.usage', {
    kind,
    model,
    promptTokens: usage.promptTokenCount,
    candidatesTokens: usage.candidatesTokenCount,
    thoughtsTokens: usage.thoughtsTokenCount ?? 0,
    totalTokens: usage.totalTokenCount,
  });
}

export async function generateHuggingFaceText(
  prompt: string,
  options: GeminiOptions = {},
): Promise<string> {
  const keys = geminiApiKeyCandidates();
  const candidates = modelCandidates(resolveModel(options.model));
  let lastError: Error | null = null;

  for (let k = 0; k < keys.length; k++) {
    const apiKey = keys[k];
    for (let i = 0; i < candidates.length; i++) {
      const model = candidates[i];
      const response = await fetchWithRetry(geminiGenerateContentUrl(model), {
        method: 'POST',
        headers: geminiAuthHeaders(apiKey),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: buildGenerationConfig(options, DEFAULT_TEXT_MAX_OUTPUT),
        }),
      });

      const raw = await response.text();
      if (!response.ok) {
        lastError = new Error(`Gemini generateContent failed (${response.status}): ${safePreview(raw)}`);
        if (isModelUnavailableError(response.status, raw) && i < candidates.length - 1) {
          logger.warn('gemini.model_fallback', {
            from: model,
            to: candidates[i + 1],
            status: response.status,
            key: keyLabel(k),
          });
          continue;
        }
        if (isApiKeyFailure(response.status) && k < keys.length - 1) {
          logger.warn('gemini.api_key_fallback', {
            from: keyLabel(k),
            to: keyLabel(k + 1),
            status: response.status,
            model,
          });
          break; // next API key
        }
        throw lastError;
      }

      if (k > 0 || i > 0) {
        logger.info('gemini.request_ok', { model, key: keyLabel(k) });
      }

      const parsed = parseGeminiBody(raw);
      noteUsage(parsed, model, 'text');
      if (!parsed) return raw.trim();

      const parts = parsed.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
      return parts?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    }
  }

  throw lastError || new Error('Gemini generateContent failed: no key/model candidates left');
}

export async function embedTextWithHuggingFace(text: string): Promise<number[] | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const keys = geminiApiKeyCandidates();
  const model = resolveEmbeddingModel();
  const embeddingDimensions = getConfig().GEMINI_EMBEDDING_DIMENSIONS;
  let lastError: Error | null = null;

  for (let k = 0; k < keys.length; k++) {
    const response = await fetchWithRetry(geminiEmbedContentUrl(model), {
      method: 'POST',
      headers: geminiAuthHeaders(keys[k]),
      body: JSON.stringify({
        content: { parts: [{ text: trimmed.slice(0, 8000) }] },
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality: embeddingDimensions,
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      lastError = new Error(`Gemini embedContent failed (${response.status}): ${safePreview(raw)}`);
      if (isApiKeyFailure(response.status) && k < keys.length - 1) {
        logger.warn('gemini.api_key_fallback', {
          from: keyLabel(k),
          to: keyLabel(k + 1),
          status: response.status,
          kind: 'embed',
        });
        continue;
      }
      throw lastError;
    }

    const parsed = parseGeminiBody(raw);
    noteUsage(parsed, model, 'embed');
    if (!parsed) return null;

    const embedding = parsed.embedding as { values?: number[] } | undefined;
    const values = embedding?.values;
    if (!Array.isArray(values)) return null;

    if (embeddingDimensions < 3072) {
      const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0));
      if (norm > 0) {
        return values.map(v => v / norm);
      }
    }
    return values;
  }

  throw lastError || new Error('Gemini embedContent failed: no key candidates left');
}

// ── JSON helper ───────────────────────────────────────────────────────────────
// Gemini supports responseMimeType: 'application/json' natively, so we use
// that instead of prompting for JSON and stripping fences.
export async function generateHuggingFaceJson<T = Record<string, unknown>>(
  systemPrompt: string,
  userPrompt: string,
  options: GeminiOptions = {},
): Promise<T> {
  const keys = geminiApiKeyCandidates();
  const candidates = modelCandidates(resolveModel(options.model));
  const combined = `${systemPrompt.trim()}\n\n${userPrompt.trim()}`;
  let lastError: Error | null = null;

  for (let k = 0; k < keys.length; k++) {
    const apiKey = keys[k];
    for (let i = 0; i < candidates.length; i++) {
      const model = candidates[i];
      const response = await fetchWithRetry(geminiGenerateContentUrl(model), {
        method: 'POST',
        headers: geminiAuthHeaders(apiKey),
        body: JSON.stringify({
          contents: [{ parts: [{ text: combined }] }],
          generationConfig: buildGenerationConfig(options, DEFAULT_JSON_MAX_OUTPUT, 'application/json'),
        }),
      });

      const raw = await response.text();
      if (!response.ok) {
        lastError = new Error(`Gemini JSON generateContent failed (${response.status}): ${safePreview(raw)}`);
        if (isModelUnavailableError(response.status, raw) && i < candidates.length - 1) {
          logger.warn('gemini.model_fallback', {
            from: model,
            to: candidates[i + 1],
            status: response.status,
            kind: 'json',
            key: keyLabel(k),
          });
          continue;
        }
        if (isApiKeyFailure(response.status) && k < keys.length - 1) {
          logger.warn('gemini.api_key_fallback', {
            from: keyLabel(k),
            to: keyLabel(k + 1),
            status: response.status,
            model,
            kind: 'json',
          });
          break;
        }
        throw lastError;
      }

      if (k > 0 || i > 0) {
        logger.info('gemini.request_ok', { model, key: keyLabel(k), kind: 'json' });
      }

      const parsed = parseGeminiBody(raw);
      noteUsage(parsed, model, 'json');
      if (!parsed) {
        throw new Error(`Gemini response is not valid JSON: ${safePreview(raw)}`);
      }

      const geminiCandidates = parsed.candidates as Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }> | undefined;
      const candidate = geminiCandidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text?.trim() ?? '';
      if (!text) {
        const reason = candidate?.finishReason ?? 'unknown';
        throw new Error(`Gemini returned empty JSON response (finishReason: ${reason})`);
      }

      try {
        return JSON.parse(text) as T;
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            return JSON.parse(match[0]) as T;
          } catch {
            // fall through
          }
        }
        throw new Error(`Gemini JSON parse failed: ${safePreview(text)}`);
      }
    }
  }

  throw lastError || new Error('Gemini JSON generateContent failed: no key/model candidates left');
}
