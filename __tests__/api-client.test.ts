import { describe, expect, it } from 'vitest';
import { unwrapApiPayload } from '@/lib/api-client';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

describe('unwrapApiPayload', () => {
  it('reads Phase envelope data', () => {
    const sessions = [{ id: '1', title: 'Hi' }];
    expect(
      unwrapApiPayload<{ sessions: typeof sessions }>({
        success: true,
        data: { sessions },
        timestamp: new Date().toISOString(),
      }).sessions,
    ).toEqual(sessions);
  });

  it('passes through legacy flat bodies', () => {
    expect(
      unwrapApiPayload<{ alerts: number[] }>({ alerts: [1, 2] }).alerts,
    ).toEqual([1, 2]);
  });

  it('handles null / non-objects', () => {
    expect(unwrapApiPayload(null)).toEqual({});
    expect(unwrapApiPayload('x')).toEqual({});
  });

  it('unwraps sessions envelope the sidebar depends on', () => {
    const payload = {
      success: true,
      data: {
        sessions: [
          { id: 'a', title: 'Lilian query', folder_name: null, created_at: '', updated_at: '' },
        ],
      },
      timestamp: new Date().toISOString(),
    };
    const data = unwrapApiPayload<{ sessions: Array<{ id: string; title: string }> }>(payload);
    expect(Array.isArray(data.sessions)).toBe(true);
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].title).toMatch(/Lilian/);
  });
});

describe('API route inventory', () => {
  function walk(dir: string, prefix = ''): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        out.push(...walk(full, prefix ? `${prefix}/${name}` : name));
      } else if (name === 'route.ts') {
        out.push(prefix);
      }
    }
    return out;
  }

  it('discovers all app/api route handlers', () => {
    const routes = walk(join(process.cwd(), 'app', 'api')).sort();
    expect(routes.length).toBeGreaterThanOrEqual(40);
    expect(routes).toEqual(expect.arrayContaining([
      'alerts',
      'sessions',
      'sessions/[id]',
      'sessions/[id]/messages',
      'folders',
      'memory',
      'chat',
      'auth/me',
      'watchlists',
      'decisions',
      'timeline',
    ]));
  });
});
