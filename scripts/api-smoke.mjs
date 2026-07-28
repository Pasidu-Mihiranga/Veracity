#!/usr/bin/env node
/**
 * Smoke-test all app/api route handlers against a running server.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 COOKIE='veracity_session=...' npm run test:api-smoke
 *
 * Without COOKIE, auth-required routes expect 401 (still counted as pass).
 * With COOKIE, they expect 2xx (or documented soft statuses like 403/404 for disabled features).
 */

import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const COOKIE = process.env.COOKIE || '';
const ROOT = join(process.cwd(), 'app', 'api');

function cookieLooksFake(cookie) {
  if (!cookie.trim()) return true;
  if (/veracity_session=\.\.\./.test(cookie)) return true;
  if (/\.\.\.|…|PASTE_|YOUR_COOKIE|paste[_-]?here/i.test(cookie)) return true;
  return false;
}

/** Routes that are POST/webhook only or need path params we stub. */
const SKIP_GET = new Set([
  'inngest',
  'auth/google/callback',
  'auth/saml/acs',
  'auth/signout',
  'auth/signin',
  'auth/signup',
  'auth/google',
  'auth/saml/login',
  'invites/accept',
]);

/** Soft-OK statuses when feature flags / missing resources apply. */
const SOFT_OK = new Set([200, 201, 204, 400, 401, 403, 404]);

function walkRoutes(dir, prefix = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walkRoutes(full, prefix ? `${prefix}/${name}` : name));
    } else if (name === 'route.ts' || name === 'route.js') {
      out.push(prefix);
    }
  }
  return out;
}

function toUrlPath(routeKey) {
  // Replace [id] style segments with a placeholder uuid
  return `/api/${routeKey}`
    .replace(/\[id\]/g, '00000000-0000-4000-8000-000000000001')
    .replace(/\[itemId\]/g, '00000000-0000-4000-8000-000000000002');
}

async function hit(method, path, body) {
  const headers = { Accept: 'application/json' };
  if (COOKIE) headers.Cookie = COOKIE;
  if (body) headers['Content-Type'] = 'application/json';
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* non-json */
      }
      return { status: res.status, json, text: text.slice(0, 200) };
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

function unwrapSessions(json) {
  if (!json || typeof json !== 'object') return [];
  if (json.success && json.data?.sessions) return json.data.sessions;
  if (Array.isArray(json.sessions)) return json.sessions;
  return [];
}

async function main() {
  const routes = walkRoutes(ROOT).sort();
  console.log(`API smoke against ${BASE} (${routes.length} route files)`);

  const authMode = !COOKIE
    ? 'none (expect 401 on protected GETs)'
    : cookieLooksFake(COOKIE)
      ? 'FAKE/PLACEHOLDER — replace ... with a real cookie from DevTools'
      : 'yes';
  console.log(`Auth cookie: ${authMode}\n`);

  if (COOKIE && cookieLooksFake(COOKIE)) {
    console.error(`
Cookie looks like a placeholder (e.g. veracity_session=...).
That will make auth/me fail with 401 and authenticated checks fail.

How to get a real cookie:
  1. Open http://localhost:3000 while logged in
  2. DevTools → Application → Cookies → copy veracity_session value
  3. Run:

     cd Veracity
     COOKIE='veracity_session=PASTE_FULL_JWT_HERE' npm run test:api-smoke
`);
    process.exit(1);
  }

  const results = [];
  let failed = 0;

  for (const key of routes) {
    if (SKIP_GET.has(key)) {
      results.push({ key, method: 'GET', status: 'skip', ok: true });
      continue;
    }
    const path = toUrlPath(key);
    // Prefer GET; some routes only implement POST — treat 405 as soft-ok
    try {
      const { status, json, text } = await hit('GET', path.includes('?') ? path : path);
      const ok = SOFT_OK.has(status) || status === 405;
      if (!ok) failed += 1;
      results.push({
        key,
        method: 'GET',
        path,
        status,
        ok,
        note: !ok ? text : json?.warning || '',
      });
      process.stdout.write(ok ? '.' : 'F');
    } catch (err) {
      failed += 1;
      results.push({ key, method: 'GET', path, status: 0, ok: false, note: String(err) });
      process.stdout.write('E');
    }
  }

  // Focused functional checks when authenticated
  const checks = [];
  if (COOKIE) {
    const me = await hit('GET', '/api/auth/me');
    checks.push({ name: 'auth/me', ok: me.status === 200, status: me.status });

    const sessions = await hit('GET', '/api/sessions');
    const list = unwrapSessions(sessions.json);
    checks.push({
      name: 'sessions list unwrap',
      ok: sessions.status === 200 && Array.isArray(list),
      status: sessions.status,
      detail: `count=${list.length}`,
    });

    const alerts = await hit('GET', '/api/alerts?unread=1');
    checks.push({
      name: 'alerts unread',
      ok: alerts.status === 200 && Array.isArray(alerts.json?.alerts),
      status: alerts.status,
      detail: alerts.json?.warning || `count=${alerts.json?.alerts?.length ?? '?'}`,
    });

    const folders = await hit('GET', '/api/folders');
    const folderList =
      folders.json?.data?.folders ?? folders.json?.folders ?? null;
    checks.push({
      name: 'folders',
      ok: folders.status === 200 && Array.isArray(folderList),
      status: folders.status,
    });

    const memory = await hit('GET', '/api/memory');
    checks.push({
      name: 'memory',
      ok: memory.status === 200,
      status: memory.status,
    });

    const decisions = await hit('GET', '/api/decisions');
    checks.push({
      name: 'decisions',
      ok: decisions.status === 200 && Array.isArray(decisions.json?.decisions),
      status: decisions.status,
    });

    const timeline = await hit('GET', '/api/timeline?product=Lilian');
    checks.push({
      name: 'timeline',
      ok: timeline.status === 200 && Array.isArray(timeline.json?.events),
      status: timeline.status,
      detail: timeline.json?.warning || '',
    });

    const watchlists = await hit('GET', '/api/watchlists');
    const wl = watchlists.json?.data?.watchlists ?? watchlists.json?.watchlists;
    checks.push({
      name: 'watchlists',
      ok: watchlists.status === 200 || watchlists.status === 403,
      status: watchlists.status,
      detail: Array.isArray(wl) ? `count=${wl.length}` : '',
    });
  }

  console.log('\n\n=== Route scan ===');
  for (const r of results.filter((x) => !x.ok)) {
    console.log(`FAIL ${r.method} ${r.path || r.key} → ${r.status} ${r.note}`);
  }
  const passed = results.filter((r) => r.ok).length;
  console.log(`Routes: ${passed}/${results.length} ok`);

  if (checks.length) {
    console.log('\n=== Authenticated checks ===');
    for (const c of checks) {
      const mark = c.ok ? 'PASS' : 'FAIL';
      if (!c.ok) failed += 1;
      console.log(`${mark} ${c.name} (${c.status}) ${c.detail || ''}`);
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} failure(s)`);
    process.exit(1);
  }
  console.log('\nAll API smoke checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
