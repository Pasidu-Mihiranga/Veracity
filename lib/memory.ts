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
  source_session?: string;
  created_at?: string;
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
  const res = await fetch('/api/memory', { credentials: 'include' }).catch(() => null);
  if (!res || !res.ok) return EMPTY_MEMORY;
  const json = await res.json().catch(() => null);
  return (json?.memory as UserMemory) ?? EMPTY_MEMORY;
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

export async function updateUserMemoryFacts(facts: MemoryFact[]): Promise<void> {
  try {
    await fetch('/api/memory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ facts }),
    });
  } catch (err) {
    console.error('updateUserMemoryFacts failed:', err);
  }
}

import { loadUserProfile } from '@/lib/user-profile';

export function getFactText(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    if ('fact' in item && typeof (item as { fact: unknown }).fact === 'string') {
      return (item as { fact: string }).fact;
    }
    if ('text' in item && typeof (item as { text: unknown }).text === 'string') {
      return (item as { text: string }).text;
    }
    if ('content' in item && typeof (item as { content: unknown }).content === 'string') {
      return (item as { content: string }).content;
    }
  }
  return String(item);
}

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
    facts.slice(-12).forEach((f) => {
      const txt = getFactText(f);
      if (txt) lines.push(`  - ${txt}`);
    });
  }

  return lines.join('\n');
}
