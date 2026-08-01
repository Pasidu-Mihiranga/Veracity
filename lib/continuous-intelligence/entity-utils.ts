import { createHash } from 'node:crypto';

export type ContinuousScope = {
  userId: string;
  workspaceId?: string | null;
};

export type CanonicalEntityType = 'company' | 'competitor' | 'product';

export type CanonicalEntity = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  scope_key: string;
  entity_key: string;
  entity_type: CanonicalEntityType;
  display_name: string;
  official_domains: string[];
  product_lines: string[];
  props: Record<string, unknown>;
  confidence: number;
  created_at: string;
  updated_at: string;
};

export function continuousScopeKey(scope: ContinuousScope): string {
  return scope.workspaceId ?? `user:${scope.userId}`;
}

export function normalizeOfficialDomain(value: string): string | null {
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

export function stableContentHash(value: unknown): string {
  return createHash('sha256')
    .update(stableJson(value))
    .digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
