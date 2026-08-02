/**
 * Multimodal image handling.
 *
 * Until this was wired, an attached image contributed only its *count* to the
 * prompt — "Attached images: 2. Metadata only." — while the product's copy
 * implied it had examined the screenshot. These tests hold the line that the
 * bytes actually travel, and that a dropped image is dropped rather than
 * silently claimed.
 */

import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';

// The Gemini module reads validated config at call time, so the required
// variables must exist before any of these tests run.
beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/test';
  process.env.AUTH_SECRET ??= 'test-secret-value-at-least-32-characters-long';
  process.env.GEMINI_API_KEY ??= 'test-key';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** Capture the request body Gemini would have received. */
function captureRequest() {
  const calls: Array<Record<string, unknown>> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)));
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }),
  );
  return calls;
}

const PNG = { data: 'aGVsbG8gd29ybGQ=', mimeType: 'image/png' };

async function loadGemini() {
  process.env.GEMINI_API_KEY = 'test-key';
  return import('@/lib/agents/gemini');
}

function partsOf(body: Record<string, unknown>): Array<Record<string, unknown>> {
  const contents = body.contents as Array<{ parts: Array<Record<string, unknown>> }>;
  return contents[0].parts;
}

describe('image parts', () => {
  it('sends the image bytes, not a description of them', async () => {
    const calls = captureRequest();
    const { generateHuggingFaceText } = await loadGemini();

    await generateHuggingFaceText('Describe this pricing page', { images: [PNG] });

    const parts = partsOf(calls[0]);
    const inline = parts.find((p) => 'inline_data' in p) as
      | { inline_data: { mime_type: string; data: string } }
      | undefined;

    expect(inline).toBeDefined();
    expect(inline!.inline_data.data).toBe(PNG.data);
    expect(inline!.inline_data.mime_type).toBe('image/png');
  });

  it('keeps the text prompt alongside the image', async () => {
    const calls = captureRequest();
    const { generateHuggingFaceText } = await loadGemini();

    await generateHuggingFaceText('Describe this pricing page', { images: [PNG] });

    const parts = partsOf(calls[0]);
    expect(parts[0]).toHaveProperty('text');
    expect(String(parts[0].text)).toContain('pricing page');
  });

  it('sends no image parts when none are attached', async () => {
    const calls = captureRequest();
    const { generateHuggingFaceText } = await loadGemini();

    await generateHuggingFaceText('No images here');

    expect(partsOf(calls[0]).every((p) => !('inline_data' in p))).toBe(true);
  });

  it('attaches images to JSON generation too', async () => {
    const calls = captureRequest();
    const { generateHuggingFaceJson } = await loadGemini();

    await generateHuggingFaceJson('system', 'user', { images: [PNG] });

    expect(partsOf(calls[0]).some((p) => 'inline_data' in p)).toBe(true);
  });
});

describe('rejected images', () => {
  it('skips an unsupported type rather than failing the whole request', async () => {
    // A text answer without one screenshot beats no answer at all.
    const calls = captureRequest();
    const { generateHuggingFaceText } = await loadGemini();

    await generateHuggingFaceText('Analyse', {
      images: [{ data: 'AAAA', mimeType: 'image/gif' }],
    });

    expect(calls).toHaveLength(1);
    expect(partsOf(calls[0]).every((p) => !('inline_data' in p))).toBe(true);
  });

  it('skips an oversized image', async () => {
    const calls = captureRequest();
    const { generateHuggingFaceText } = await loadGemini();

    await generateHuggingFaceText('Analyse', {
      images: [{ data: 'A'.repeat(8 * 1024 * 1024), mimeType: 'image/png' }],
    });

    expect(partsOf(calls[0]).every((p) => !('inline_data' in p))).toBe(true);
  });

  it('caps how many images travel in one request', async () => {
    const calls = captureRequest();
    const { generateHuggingFaceText } = await loadGemini();

    await generateHuggingFaceText('Analyse', {
      images: Array.from({ length: 10 }, () => PNG),
    });

    const inlineParts = partsOf(calls[0]).filter((p) => 'inline_data' in p);
    expect(inlineParts.length).toBeLessThanOrEqual(4);
    expect(inlineParts.length).toBeGreaterThan(0);
  });

  it('skips an empty payload', async () => {
    const calls = captureRequest();
    const { generateHuggingFaceText } = await loadGemini();

    await generateHuggingFaceText('Analyse', {
      images: [{ data: '', mimeType: 'image/png' }],
    });

    expect(partsOf(calls[0]).every((p) => !('inline_data' in p))).toBe(true);
  });
});

describe('prompt honesty', () => {
  it('no longer tells the model it has only metadata', async () => {
    // The old prompt line was "Attached images: N. Metadata only." — which was
    // accurate at the time and is exactly what had to change.
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync('lib/agents/classify.ts', 'utf8'),
    );
    // Comments in that file quote the old wording to explain why it changed,
    // so the check runs against code only.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    expect(code).not.toContain('Metadata only');
    expect(code).toContain('Read them and use what they show');
  });
});
