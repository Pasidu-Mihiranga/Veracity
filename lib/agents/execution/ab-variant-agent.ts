/**
 * Member 3 — Sub-agent 2: A/B Variant Agent
 *
 * Skill ref: .claude/.agents/skills/ab-test-orchestrator/SKILL.md
 *
 * Responsibilities:
 *  - Scrape competitor Meta Ad Library for real ad messaging
 *  - Search HN for sentiment signals
 *  - For each copy angle from ContentAgent, produce a CampaignVariant with:
 *    - A single falsifiable hypothesis tied to a specific research signal
 *    - A defined success metric
 *    - The single variable being tested
 *    - Grounded signal pointers
 */

import { searchMetaAds } from '../../tools/meta-ads';
import { searchHN } from '../../tools/hn-algolia';
import { searchWeb } from '../../tools/serpapi';
import { generateHuggingFaceJson } from '../gemini';
import type {
  AgentContext,
  AgentOutput,
  AgentSource,
  CampaignVariant,
  ConfidenceLevel,
} from '../types';
import { scoreToLevel } from '../types';
import { computeSignalQualityPenalty, extractToolResults } from '../../tools/fallback';

export interface ABVariantOutput extends AgentOutput {
  artifactType: 'execution-plan';
  variants: CampaignVariant[];
}

export async function runABVariantAgent(ctx: AgentContext): Promise<ABVariantOutput> {
  const { query, product, competitor, priorContext, researchOutputs = [] } = ctx;

  // ── Parallel tool fetch ───────────────────────────────────────────────────
  const [metaAdsResult, hnResult, webResult] = await Promise.allSettled([
    competitor ? searchMetaAds(competitor) : searchMetaAds(product),
    searchHN(`${product} ${competitor ?? ''} outreach messaging`),
    searchWeb(`${product} vs ${competitor ?? 'competitors'} buyer decision 2025`),
  ]);

  const sources: AgentSource[] = [];
  const rawContent: string[] = [];

  // Research findings as grounding
  if (researchOutputs.length > 0) {
    const researchSummary = researchOutputs
      .map(o => `[${o.domain}] FACTS: ${o.facts.slice(0, 3).join('; ')} | INTERPRETATION: ${o.interpretation.slice(0, 2).join('; ')}`)
      .join('\n');
    rawContent.push(`[RESEARCH GROUNDING]\n${researchSummary}`);
  }

  if (metaAdsResult.status === 'fulfilled') {
    metaAdsResult.value.data.slice(0, 5).forEach(ad => {
      if (ad.ad_snapshot_url) {
        sources.push({ url: ad.ad_snapshot_url, title: `${ad.page_name} Ad`, timestamp: metaAdsResult.value.timestamp, tool: 'firecrawl' });
      }
      if (ad.ad_creative_body) rawContent.push(`[COMPETITOR AD] ${ad.page_name}: "${ad.ad_creative_body}"`);
    });
  }

  if (hnResult.status === 'fulfilled') {
    hnResult.value.data.slice(0, 4).forEach(p => {
      sources.push({ url: p.url, title: p.title, timestamp: p.created, tool: 'hn' });
      rawContent.push(`[HN SENTIMENT] ${p.title}`);
    });
  }

  if (webResult.status === 'fulfilled') {
    webResult.value.data.slice(0, 3).forEach(r => {
      sources.push({ url: r.url, title: r.title, timestamp: webResult.value.timestamp, tool: 'serpapi' });
      rawContent.push(`[BUYER DECISION] ${r.title}: ${r.snippet}`);
    });
  }

  // ── Gemini synthesis ──────────────────────────────────────────────────────
  const systemPrompt = `You are a specialist A/B test strategist for B2B SaaS outreach campaigns.

Your job is to produce 3 structured, hypothesis-driven message variants grounded in live signals.

Rules:
- Each variant tests ONE variable (angle/hook/frame) — not multiple things at once.
- Every hypothesis must be falsifiable: it predicts a specific outcome for a specific audience because of a specific signal.
- Variants must be meaningfully different: ROI, competitor gap, insight-led, no-headcount, pain-point-first are all distinct.
- Success metrics must be concrete and measurable (reply rate, meetings booked, etc.).
- Ground every hypothesis explicitly in a signal from the research or raw data.
- Output valid JSON matching the schema exactly.
${priorContext ? `\nPrior conversation context (build on this):\n${priorContext}` : ''}`;

  const userPrompt = `Query: "${query}"
Product: ${product}
${competitor ? `Competitor: ${competitor}` : ''}

Raw signals:
${rawContent.join('\n')}

Produce a JSON object with this exact shape:
{
  "variants": [
    {
      "id": string,                  // e.g. "V1-ROI"
      "angle": string,               // e.g. "ROI-focused"
      "hypothesis": string,          // falsifiable — e.g. "ROI messaging outperforms competitor-gap for Series B VP Sales because pricing-agent found 73% cite budget pressure"
      "successMetric": string,       // e.g. "reply rate > 4% within 72h"
      "variable": string,            // single thing being tested, e.g. "opening hook angle"
      "channels": {
        "email": {
          "subject": string,
          "body": string,            // 3-4 sentences, no placeholders
          "followUps": string[]      // 1-2 follow-up messages
        },
        "linkedin": {
          "hook": string,            // first line — must create curiosity
          "post": string             // 3-5 sentences
        }
      },
      "groundedSignals": string[]    // 2-3 direct quotes or paraphrases from raw signals above
    }
  ],
  "facts": string[],
  "interpretation": string[],
  "confidenceScore": number
}`;

  const parsed = await generateHuggingFaceJson<any>(systemPrompt, userPrompt, {
    maxNewTokens: 1800,
    temperature: 0.25,
  });

  const rawScore: number = typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.65;
  const toolResults = extractToolResults([metaAdsResult, hnResult, webResult]);
  const confScore = Number.parseFloat((rawScore * computeSignalQualityPenalty(toolResults, 3)).toFixed(2));
  const confidence: ConfidenceLevel = scoreToLevel(confScore);

  return {
    agentId: 'ab-variant-agent',
    domain: 'execution-engine',
    artifactType: 'execution-plan',
    confidence,
    confidenceScore: confScore,
    facts: parsed.facts ?? [],
    interpretation: parsed.interpretation ?? [],
    sources,
    generatedAt: new Date().toISOString(),
    variants: (parsed.variants ?? []) as CampaignVariant[],
  };
}
