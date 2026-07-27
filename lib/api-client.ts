/**
 * Normalize API JSON whether the route uses the Phase envelope
 * `{ success, data }` or a legacy flat `{ sessions, … }` body.
 */
export function unwrapApiPayload<T extends Record<string, unknown>>(json: unknown): T {
  if (!json || typeof json !== 'object') return {} as T;
  const obj = json as Record<string, unknown>;
  if (obj.success === true && obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
    return obj.data as T;
  }
  return obj as T;
}
