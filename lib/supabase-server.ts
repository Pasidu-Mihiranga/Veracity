import {
  AUTH_COOKIE,
  authenticateUser,
  clearAuthCookie,
  createSessionToken,
  createUser,
  getCurrentUser,
  setAuthCookie,
  type AuthUser,
} from '@/lib/auth';

/** Compatibility shim — previously returned a Supabase server client. */
export async function createClient() {
  return {
    auth: {
      async getUser(): Promise<{ data: { user: AuthUser | null }; error: null }> {
        const user = await getCurrentUser();
        return { data: { user }, error: null };
      },
    },
  };
}

export {
  AUTH_COOKIE,
  authenticateUser,
  clearAuthCookie,
  createSessionToken,
  createUser,
  getCurrentUser,
  setAuthCookie,
};
export type { AuthUser };
