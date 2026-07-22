import type {
  AgentOutput,
  CompetitiveOutput,
  MindMapNode,
  MindMapOutput,
  OrchestratorOutput,
} from '@/lib/agents/types';
import type { ChatMessage } from '@/types/chat-ui';

export type ReportSource = {
  title: string;
  url: string;
  tool?: string;
};

export type ReportMatrixRow = {
  feature: string;
  yours: string;
  competitor: string;
  gap: string;
};

export type ReportMindBranch = {
  label: string;
  children: string[];
};

export type ExecutiveReportData = {
  product: string;
  competitor?: string;
  query: string;
  generatedAt: string;
  summary: string;
  confidence?: string;
  recommendations: Array<{
    title: string;
    rationale: string;
    priority: string;
    confidence: string;
  }>;
  domainHighlights: Array<{
    domain: string;
    confidence: string;
    highlight: string;
  }>;
  matrix: ReportMatrixRow[];
  matrixCompetitor?: string;
  mindMap: {
    centralTopic: string;
    summary: string;
    branches: ReportMindBranch[];
  } | null;
  sources: ReportSource[];
};

function flattenMindChildren(nodes: MindMapNode[] | undefined, limit = 6): string[] {
  if (!nodes?.length) return [];
  const out: string[] = [];
  for (const n of nodes) {
    if (out.length >= limit) break;
    out.push(n.label);
    for (const child of n.children ?? []) {
      if (out.length >= limit) break;
      out.push(`  · ${child.label}`);
    }
  }
  return out;
}

function collectSources(outputs: AgentOutput[], fallback: ChatMessage['sources']): ReportSource[] {
  const seen = new Set<string>();
  const sources: ReportSource[] = [];
  for (const output of outputs) {
    for (const s of output.sources ?? []) {
      if (!s.url || seen.has(s.url)) continue;
      seen.add(s.url);
      sources.push({ title: s.title || s.url, url: s.url, tool: s.tool });
    }
  }
  for (const s of fallback ?? []) {
    if (!s.url || seen.has(s.url)) continue;
    seen.add(s.url);
    sources.push({ title: s.title || s.url, url: s.url });
  }
  return sources.slice(0, 40);
}

export function buildExecutiveReport(message: ChatMessage): ExecutiveReportData {
  const out: OrchestratorOutput | undefined = message.orchestratorOutput;
  const outputs = out?.outputs ?? [];
  const competitive = outputs.find((o): o is CompetitiveOutput => o.artifactType === 'competitive-matrix');
  const mindMap = outputs.find((o): o is MindMapOutput => o.artifactType === 'mind-map');

  const recommendations = (message.recommendations ?? out?.topRecommendations ?? []).map((rec) => ({
    title: String(rec.title ?? 'Recommendation'),
    rationale: String(rec.rationale ?? ''),
    priority: String(rec.priority ?? 'strategic'),
    confidence: String(rec.confidence ?? 'medium'),
  }));

  return {
    product: out?.product || 'Veracity intelligence',
    competitor: out?.competitor || competitive?.competitor,
    query: out?.query || '',
    generatedAt: out?.generatedAt || new Date().toISOString(),
    summary: message.content || out?.synthesizedAnswer || '',
    confidence: out?.totalConfidence,
    recommendations: recommendations.slice(0, 8),
    domainHighlights: outputs
      .filter((o) => o.artifactType !== 'mind-map')
      .slice(0, 8)
      .map((o) => ({
        domain: o.domain,
        confidence: o.confidence,
        highlight: o.interpretation?.[0] || o.facts?.[0] || 'No highlight.',
      })),
    matrix: (competitive?.matrix ?? []).slice(0, 16).map((row) => ({
      feature: row.feature,
      yours: row.yourProduct,
      competitor: row.competitor,
      gap: row.gapDirection,
    })),
    matrixCompetitor: competitive?.competitor,
    mindMap: mindMap
      ? {
          centralTopic: mindMap.centralTopic,
          summary: mindMap.summary,
          branches: (mindMap.branches ?? []).slice(0, 8).map((b) => ({
            label: b.label,
            children: flattenMindChildren(b.children, 5),
          })),
        }
      : null,
    sources: collectSources(outputs, message.sources),
  };
}

export function reportFilename(data: ExecutiveReportData): string {
  const slug = (data.product || 'veracity')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const day = data.generatedAt.slice(0, 10);
  return `${slug || 'veracity'}-executive-report-${day}.pdf`;
}
