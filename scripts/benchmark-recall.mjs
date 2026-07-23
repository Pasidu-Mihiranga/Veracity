import { performance } from 'node:perf_hooks';

process.loadEnvFile?.('.env');

const [{ query }, { embedText }, { toPgVectorLiteral }] = await Promise.all([
  import('../lib/db.ts'),
  import('../lib/embeddings.ts'),
  import('../lib/pgvector.ts'),
]);

const sessionId = process.env.BENCH_SESSION_ID;
const prompt = process.env.BENCH_RECALL_QUERY || 'What did we discuss about Vector Agents?';
const limit = Math.max(1, Math.min(25, Number(process.env.BENCH_RECALL_LIMIT || 5)));

if (!sessionId) {
  console.error('Set BENCH_SESSION_ID before running bench:recall');
  process.exit(1);
}

const started = performance.now();
const embedding = await embedText(prompt);
if (!embedding) {
  console.error('Embedding failed; verify GEMINI_API_KEY.');
  process.exit(1);
}

const vectorLiteral = toPgVectorLiteral(embedding);
const dbStarted = performance.now();
const result = await query(
  `SELECT message_id, role, content, (1 - (embedding <=> $1::vector))::float8 AS similarity
   FROM chat_embeddings
   WHERE session_id = $2
   ORDER BY embedding <=> $1::vector
   LIMIT $3`,
  [vectorLiteral, sessionId, limit],
);

const totalMs = performance.now() - started;
const dbMs = performance.now() - dbStarted;
console.log(JSON.stringify({
  query: prompt,
  sessionId,
  limit,
  embeddingMs: Number((dbStarted - started).toFixed(1)),
  dbMs: Number(dbMs.toFixed(1)),
  totalMs: Number(totalMs.toFixed(1)),
  hitCount: result.rows.length,
  topHit: result.rows[0]
    ? {
      role: result.rows[0].role,
      similarity: Number(result.rows[0].similarity),
      preview: String(result.rows[0].content).slice(0, 120),
    }
    : null,
}));
