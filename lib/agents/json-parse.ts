/** Shared JSON helpers for LLM text that may include markdown fences. */

export function stripJsonFences(raw: string): string {
  return raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export function safeParseJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(stripJsonFences(raw));
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        /* ignore */
      }
    }
    return {};
  }
}
