import { getConfig } from '@/lib/config';

const DEFAULT_MODEL = 'gemini-3.6-flash';
const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-001';
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

function getApiKey(): string {
  return getConfig().GEMINI_API_KEY;
}

function resolveModel(override?: string): string {
  return override?.trim() || getConfig().GEMINI_MODEL || DEFAULT_MODEL;
}

function resolveEmbeddingModel(): string {
  const cfg = getConfig();
  return cfg.GEMINI_EMBEDDING_MODEL || cfg.HUGGING_FACE_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
}

function generationUrl(model: string, apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
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
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, init);
      if (response.status === 429 || response.status === 503) {
        console.warn(`[Gemini API] Received HTTP ${response.status}. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2.5; // exponential backoff
        continue;
      }
      return response;
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini API] Fetch error: ${err.message}. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2.5;
    }
  }
  throw lastError || new Error(`Failed after ${retries} retries`);
}

export async function generateHuggingFaceText(
  prompt: string,
  options: GeminiOptions = {},
): Promise<string> {
  const apiKey = getApiKey();
  const model = resolveModel(options.model);

  const response = await fetchWithRetry(generationUrl(model, apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: buildGenerationConfig(options, DEFAULT_TEXT_MAX_OUTPUT),
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini generateContent failed (${response.status}): ${safePreview(raw)}`);
  }

  let parsed: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return raw.trim();
  }

  return parsed.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
}

export async function embedTextWithHuggingFace(text: string): Promise<number[] | null> {
  const apiKey = getApiKey();
  const trimmed = text.trim();
  if (!trimmed) return null;

  const model = resolveEmbeddingModel();
  const embeddingDimensions = getConfig().GEMINI_EMBEDDING_DIMENSIONS;

  const response = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text: trimmed.slice(0, 8000) }] },
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality: embeddingDimensions,
      }),
    },
  );

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini embedContent failed (${response.status}): ${safePreview(raw)}`);
  }

  let parsed: { embedding?: { values?: number[] } };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return null;
  }

  const values = parsed.embedding?.values;
  if (!Array.isArray(values)) return null;

  if (embeddingDimensions < 3072) {
    const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0));
    if (norm > 0) {
      return values.map(v => v / norm);
    }
  }
  return values;
}

// ── JSON helper ───────────────────────────────────────────────────────────────
// Gemini supports responseMimeType: 'application/json' natively, so we use
// that instead of prompting for JSON and stripping fences.
export async function generateHuggingFaceJson<T = Record<string, unknown>>(
  systemPrompt: string,
  userPrompt: string,
  options: GeminiOptions = {},
): Promise<T> {
  const apiKey = getApiKey();
  const model = resolveModel(options.model);

  const combined = `${systemPrompt.trim()}\n\n${userPrompt.trim()}`;

  const response = await fetchWithRetry(generationUrl(model, apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: combined }] }],
      generationConfig: buildGenerationConfig(options, DEFAULT_JSON_MAX_OUTPUT, 'application/json'),
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini JSON generateContent failed (${response.status}): ${safePreview(raw)}`);
  }

  let parsed: {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error(`Gemini response is not valid JSON: ${safePreview(raw)}`);
  }

  const candidate = parsed.candidates?.[0];
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
