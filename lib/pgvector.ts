/**
 * Format a float embedding for PostgreSQL `vector` / pgvector casts.
 * Example: [0.1, -0.2] → "[0.1,-0.2]"
 */
export function toPgVectorLiteral(values: number[]): string {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('Embedding vector must be a non-empty number array');
  }
  return `[${values.map((v) => {
    if (!Number.isFinite(v)) throw new Error('Embedding contains non-finite values');
    return String(v);
  }).join(',')}]`;
}
