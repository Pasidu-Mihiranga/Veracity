import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const action = process.argv[2] ?? 'status';
const allowed = new Set(['start', 'stop', 'status']);
if (!allowed.has(action)) {
  process.stderr.write('Usage: node scripts/local-postgres.mjs <start|stop|status>\n');
  process.exit(1);
}

const dataDir = resolve(process.cwd(), '.local/postgres-data');
const logPath = resolve(process.cwd(), '.local/postgres.log');
const port = process.env.VERACITY_LOCAL_DB_PORT ?? '5435';
const candidates = [
  process.env.POSTGRES_BIN_DIR ? resolve(process.env.POSTGRES_BIN_DIR, 'pg_ctl') : '',
  '/opt/homebrew/opt/postgresql@17/bin/pg_ctl',
  '/usr/local/opt/postgresql@17/bin/pg_ctl',
].filter(Boolean);
const pgCtl = candidates.find(existsSync);

if (!pgCtl) {
  process.stderr.write('PostgreSQL 17 pg_ctl was not found. Install postgresql@17 or set POSTGRES_BIN_DIR.\n');
  process.exit(1);
}
if (!existsSync(dataDir)) {
  process.stderr.write('Local Veracity database is not initialized. See README Local database setup.\n');
  process.exit(1);
}

const status = spawnSync(pgCtl, ['-D', dataDir, 'status'], { encoding: 'utf8' });
const running = status.status === 0;

if (action === 'status') {
  process.stdout.write(running ? `Veracity PostgreSQL is running on port ${port}.\n` : 'Veracity PostgreSQL is stopped.\n');
  process.exit(running ? 0 : 1);
}
if (action === 'start' && running) {
  process.stdout.write(`Veracity PostgreSQL is already running on port ${port}.\n`);
  process.exit(0);
}
if (action === 'stop' && !running) {
  process.stdout.write('Veracity PostgreSQL is already stopped.\n');
  process.exit(0);
}

const args = action === 'start'
  ? ['-D', dataDir, '-l', logPath, '-o', `-p ${port} -h localhost`, 'start']
  : ['-D', dataDir, 'stop'];
const result = spawnSync(pgCtl, args, { encoding: 'utf8', stdio: 'inherit' });
process.exit(result.status ?? 1);
