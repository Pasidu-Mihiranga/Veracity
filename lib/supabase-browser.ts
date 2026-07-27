export type AuthUser = {
  id: string;
  email: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json().catch(() => ({}))) as T;
}

export function createClient() {
  return {
    auth: {
      async getUser(): Promise<{ data: { user: AuthUser | null } }> {
        try {
          const res = await fetch('/api/auth/me', { credentials: 'include' });
          if (!res.ok) return { data: { user: null } };
          const json = await parseJson<{ user?: AuthUser | null }>(res);
          return { data: { user: json.user ?? null } };
        } catch {
          return { data: { user: null } };
        }
      },
      async signOut(): Promise<void> {
        try {
          await fetch('/api/auth/signout', { method: 'POST', credentials: 'include' });
        } catch {
          // Ignore network errors during sign-out
        }
      },
      async signInWithPassword(params: { email: string; password: string }) {
        try {
          const res = await fetch('/api/auth/signin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(params),
          });
          const json = await parseJson<{ error?: string; user?: AuthUser }>(res);
          if (!res.ok) return { error: { message: json.error || 'Sign in failed' } };
          return { error: null, data: { user: json.user } };
        } catch {
          return { error: { message: 'Network error — unable to reach server' } };
        }
      },
      async signUp(params: { email: string; password: string }) {
        try {
          const res = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(params),
          });
          const json = await parseJson<{ error?: string; user?: AuthUser }>(res);
          if (!res.ok) return { error: { message: json.error || 'Sign up failed' } };
          return { error: null, data: { user: json.user } };
        } catch {
          return { error: { message: 'Network error — unable to reach server' } };
        }
      },
    },
  };
}
