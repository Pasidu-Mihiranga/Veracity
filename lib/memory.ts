export interface UserMemory {
  role: string | null;
  company: string | null;
  products: string[];
  competitors: string[];
  interests: string[];
  facts: MemoryFact[];
  raw_summary: string | null;
  updated_at: string;
}

export interface MemoryFact {
  fact: string;
  source_session: string;
  created_at: string;
}

const EMPTY_MEMORY: UserMemory = {
  role: null,
  company: null,
  products: [],
  competitors: [],
  interests: [],
  facts: [],
  raw_summary: null,
  updated_at: new Date().toISOString(),
};

export async function getUserMemory(): Promise<UserMemory> {
  const res = await fetch('/api/memory', { credentials: 'include' });
  if (!res.ok) return EMPTY_MEMORY;
  const json = await res.json();
  return (json.memory as UserMemory) ?? EMPTY_MEMORY;
}

export async function extractAndUpdateMemory(
  sessionId: string,
  userQuery: string,
  assistantAnswer: string,
  existingMemory: UserMemory,
): Promise<void> {
  try {
    await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId, userQuery, assistantAnswer, existingMemory }),
    });
  } catch (err) {
    console.error('memory extraction failed:', err);
  }
}

import { loadUserProfile } from '@/lib/user-profile';

export function buildMemoryContext(memory: UserMemory | null): string {
  const profile = typeof window !== 'undefined' ? loadUserProfile() : null;
  const role = memory?.role || profile?.role || null;
  const company = memory?.company || profile?.company || null;
  const websiteUrl = profile?.websiteUrl || null;
  const competitors = [...new Set([...(memory?.competitors || []), ...(profile?.competitors || [])])];
  const facts = memory?.facts ?? [];
  const interests = memory?.interests ?? [];

  if (!role && !company && competitors.length === 0 && facts.length === 0 && !memory?.raw_summary) {
    return '';
  }

  const lines: string[] = ['[USER PROFILE & PERSONAL MEMORY — persistent baseline]'];

  if (role) lines.push(`User Role: ${role}`);
  if (company) lines.push(`User Company: ${company}`);
  if (websiteUrl) lines.push(`Company Website: ${websiteUrl}`);
  if (competitors.length > 0) lines.push(`Tracked Competitors: ${competitors.join(', ')}`);
  if (interests.length > 0) lines.push(`Strategic Focus Topics: ${interests.join(', ')}`);
  if (memory?.raw_summary) lines.push(`User Summary: ${memory.raw_summary}`);
  if (facts.length > 0) {
    lines.push('Durable Facts:');
    facts.slice(-8).forEach((f) => lines.push(`  - ${f.fact}`));
  }

  return lines.join('\n');
}
