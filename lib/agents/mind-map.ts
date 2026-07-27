import { generateHuggingFaceJson } from '@/lib/agents/gemini';
import { normalizeMindMapTree } from '@/lib/agents/mind-map-normalize';
import {
  buildMindMapUserPrompt,
  MIND_MAP_SYSTEM_PROMPT,
} from '@/lib/agents/prompts/synthesis';
import { filterAndRankSources } from '@/lib/tools/source-validator';
import { logger } from '@/lib/logger';
import type { AgentOutput, MindMapOutput } from '@/lib/agents/types';
import { scoreToLevel } from '@/lib/agents/types';

export async function generateMindMap(
  query: string,
  product: string,
  outputs: AgentOutput[],
): Promise<MindMapOutput | null> {
  if (outputs.length === 0) return null;

  const outputSummaries = outputs.map((o) => ({
    domain: o.domain,
    confidence: o.confidence,
    confidenceScore: o.confidenceScore,
    facts: o.facts.slice(0, 5),
    interpretation: o.interpretation.slice(0, 3),
  }));

  const userPrompt = buildMindMapUserPrompt({
    product,
    query,
    outputSummariesJson: JSON.stringify(outputSummaries, null, 2),
  });

  try {
    const parsed = await generateHuggingFaceJson<Record<string, unknown>>(
      MIND_MAP_SYSTEM_PROMPT,
      userPrompt,
      {
        maxNewTokens: 2048,
        temperature: 0.15,
      },
    );

    const normalized = normalizeMindMapTree({
      centralTopic: parsed.centralTopic,
      summary: parsed.summary,
      branches: parsed.branches,
      product,
      query,
    });
    if (normalized.branches.length === 0) return null;

    const avgScore = outputs.reduce((s, o) => s + o.confidenceScore, 0) / outputs.length;

    return {
      agentId: 'mind-map-synthesis',
      domain: 'market-trends',
      confidence: scoreToLevel(avgScore),
      confidenceScore: avgScore,
      facts: [],
      interpretation: [],
      sources: filterAndRankSources(
        outputs.flatMap((o) => o.sources),
        10,
      ),
      generatedAt: new Date().toISOString(),
      artifactType: 'mind-map',
      centralTopic: normalized.centralTopic,
      branches: normalized.branches,
      summary: normalized.summary,
    };
  } catch (err) {
    logger.error('mindmap.generation_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
