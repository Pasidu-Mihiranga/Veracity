import { unwrapApiPayload } from '@/lib/api-client';

export interface MarketProject {
  id: string;
  name: string;
  product: string;
  product_url: string | null;
  competitors: string[];
  geography: string | null;
  decision_context: string | null;
  approved_sources: string[];
  blocked_sources: string[];
  created_at: string;
  updated_at: string;
}

export interface MarketProjectOverview extends Record<string, unknown> {
  conversationCount: number;
  researchRunCount: number;
  decisionCount: number;
  openDecisionCount: number;
  latestSnapshot: null | {
    product: string;
    competitor: string | null;
    summary: string;
    source_count: number;
    evidence_score: number | null;
    generated_at: string;
  };
  recentSnapshots: Array<{
    id: string;
    product: string;
    competitor: string | null;
    summary: string;
    source_count: number;
    evidence_score: number | null;
    generated_at: string;
  }>;
  coverageEvents: Array<{
    id: string;
    title: string;
    details: { added?: string[]; removed?: string[] };
    observed_at: string;
  }>;
}

export type CreateMarketProjectInput = {
  name: string;
  product: string;
  productUrl?: string;
  competitors?: string[];
  geography?: string;
  decisionContext?: string;
  approvedSources?: string[];
  blockedSources?: string[];
};

export async function listMarketProjects(): Promise<MarketProject[]> {
  const response = await fetch('/api/projects', { credentials: 'include' });
  if (!response.ok) throw new Error(`listMarketProjects failed: ${response.status}`);
  const payload = unwrapApiPayload<{ projects?: MarketProject[] }>(await response.json());
  return Array.isArray(payload.projects) ? payload.projects : [];
}

export async function createMarketProject(input: CreateMarketProjectInput): Promise<MarketProject> {
  const response = await fetch('/api/projects', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`createMarketProject failed: ${response.status}`);
  const payload = unwrapApiPayload<{ project?: MarketProject }>(await response.json());
  if (!payload.project) throw new Error('createMarketProject returned no project');
  return payload.project;
}

export async function updateMarketProject(projectId: string, input: CreateMarketProjectInput): Promise<MarketProject> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`updateMarketProject failed: ${response.status}`);
  const payload = unwrapApiPayload<{ project?: MarketProject }>(await response.json());
  if (!payload.project) throw new Error('updateMarketProject returned no project');
  return payload.project;
}

export async function deleteMarketProject(projectId: string): Promise<void> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`deleteMarketProject failed: ${response.status}`);
}

export async function getMarketProjectOverview(projectId: string): Promise<MarketProjectOverview> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/overview`, { credentials: 'include' });
  if (!response.ok) throw new Error(`getMarketProjectOverview failed: ${response.status}`);
  return unwrapApiPayload<MarketProjectOverview>(await response.json());
}

export function buildMarketProjectContext(project: MarketProject): string {
  const lines = [
    `Active market project: ${project.name}`,
    `Product: ${project.product}`,
  ];
  if (project.product_url) lines.push(`Product URL: ${project.product_url}`);
  if (project.competitors.length) lines.push(`Tracked competitors: ${project.competitors.join(', ')}`);
  if (project.geography) lines.push(`Geography: ${project.geography}`);
  if (project.decision_context) lines.push(`Decision context: ${project.decision_context}`);
  if (project.approved_sources.length) lines.push(`Preferred source domains: ${project.approved_sources.join(', ')}`);
  if (project.blocked_sources.length) lines.push(`Avoid these source domains when alternatives exist: ${project.blocked_sources.join(', ')}`);
  return lines.join('\n');
}
