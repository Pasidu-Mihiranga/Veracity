import { Pool, type QueryResultRow } from 'pg';
import { getConfig } from '@/lib/config';

const { DATABASE_URL: connectionString, NODE_ENV } = getConfig();

const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString,
    max: 10,
  });

if (NODE_ENV !== 'production') {
  globalForPg.pgPool = pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
) {
  return pool.query<T>(text, params);
}
