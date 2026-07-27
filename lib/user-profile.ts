export interface UserProfile {
  role: string;
  company: string;
  websiteUrl: string;
  competitors: string[];
  industry: string;
  onboarded: boolean;
  updatedAt: string;
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  role: '',
  company: '',
  websiteUrl: '',
  competitors: [],
  industry: '',
  onboarded: false,
  updatedAt: new Date().toISOString(),
};

const STORAGE_KEY = 'veracity_user_profile_v1';

export function loadUserProfile(): UserProfile {
  if (typeof window === 'undefined') return DEFAULT_USER_PROFILE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_USER_PROFILE;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return DEFAULT_USER_PROFILE;
  }
}

export function saveUserProfile(profile: Partial<UserProfile>): UserProfile {
  const current = loadUserProfile();
  const updated: UserProfile = {
    ...current,
    ...profile,
    onboarded: true,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }
  return updated;
}
