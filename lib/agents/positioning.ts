import { searchWeb, searchAdsTransparency } from '../tools/serpapi';
import { scrapePage } from '../tools/firecrawl';
import { searchReddit } from '../tools/reddit';
import { generateHuggingFaceJson } from './gemini';
import type {
  AgentConfig,
  AgentContext,
  AgentOutput,
  PositioningOutput,
  MessagingGap,
  AgentSource,
  ConfidenceLevel,
} from './types';
import { scoreToLevel } from './types';
import { computeSignalQualityPenalty, extractToolResults } from '../tools/fallback';
import {
  competitorSiteUrl,
  isUsableScrapePage,
  productSiteUrl,
  skippedScrapePromise,
} from './entity-url';
import {
  SYNTHESIS_FAILURE_CONFIDENCE,
  factsFromRawSignals,
  synthesisFailureInterpretation,
} from './synthesis-fallback';

async function run(ctx: AgentContext): Promise<AgentOutput> {
  const { query, product, competitor, priorContext, evidencePackBlock } = ctx;
  const vertical = ctx.industryVertical || 'GENERAL';
  const competitorName = competitor?.trim() || null;
  const searchSubject = competitorName || product;
  const compUrl = competitorSiteUrl(ctx);
  const prodUrl = productSiteUrl(ctx);

  // ── Parallel data fetch with vertical awareness ────────────────────────────
  const messagingQuery = vertical === 'FMCG_RETAIL'
    ? `${searchSubject} advertising campaign brand slogan packaging taste heritage 2025`
    : vertical === 'FINANCE'
    ? `${searchSubject} banking brand trust campaign interest rates customer service`
    : competitorName
    ? `${competitorName} vs ${product} messaging positioning marketing`
    : `${product} messaging positioning marketing brand`;

  const [
    compHomeResult,
    prodHomeResult,
    compAdsResult,
    prodAdsResult,
    messagingSearchResult,
    redditPerceptionResult,
    socialVoiceResult,
  ] = await Promise.allSettled([
    compUrl ? scrapePage(compUrl) : skippedScrapePromise(),
    prodUrl ? scrapePage(prodUrl) : skippedScrapePromise(),
    competitorName ? searchAdsTransparency(competitorName) : searchAdsTransparency(product),
    searchAdsTransparency(product),
    searchWeb(messagingQuery),
    searchReddit(competitorName
      ? `how does ${competitorName} market itself brand perception`
      : `how does ${product} market itself brand perception`),
    searchWeb(`${searchSubject} OR ${product} site:x.com OR site:twitter.com OR site:instagram.com OR site:linkedin.com positioning brand`),
  ]);

  const compAboutUrl = compUrl ? `${compUrl.replace(/\/$/, '')}/about` : '';
  const prodAboutUrl = prodUrl ? `${prodUrl.replace(/\/$/, '')}/about` : '';

  const [compAboutResult, prodAboutResult] = await Promise.allSettled([
    compAboutUrl ? scrapePage(compAboutUrl) : skippedScrapePromise(),
    prodAboutUrl ? scrapePage(prodAboutUrl) : skippedScrapePromise(),
  ]);

  // ── Collect sources ────────────────────────────────────────────────────────
  const sources: AgentSource[] = [];
  const rawContent: string[] = [];

  if (isUsableScrapePage(compHomeResult)) {
    const page = compHomeResult.value.data;
    const title = competitor ? `${competitor} — homepage` : 'Competitor homepage';
    sources.push({ url: page.url, title, timestamp: compHomeResult.value.timestamp, tool: 'firecrawl' });
    rawContent.push(`[COMPETITOR HOMEPAGE] ${page.excerpt}`);
  }
  if (isUsableScrapePage(prodHomeResult)) {
    const page = prodHomeResult.value.data;
    const title = product.length < 50 ? `${product} — homepage` : 'Product homepage';
    sources.push({ url: page.url, title, timestamp: prodHomeResult.value.timestamp, tool: 'firecrawl' });
    rawContent.push(`[OUR HOMEPAGE] ${page.excerpt}`);
  }
  if (isUsableScrapePage(compAboutResult)) {
    rawContent.push(`[COMPETITOR ABOUT] ${compAboutResult.value.data.excerpt}`);
  }
  if (isUsableScrapePage(prodAboutResult)) {
    rawContent.push(`[OUR ABOUT] ${prodAboutResult.value.data.excerpt}`);
  }
  if (compAdsResult.status === 'fulfilled' && 'data' in compAdsResult.value) {
    compAdsResult.value.data.slice(0, 3).forEach((r: any) => {
      sources.push({ url: r.url, title: r.title, timestamp: compAdsResult.value.timestamp, tool: 'serpapi' });
      rawContent.push(`[COMPETITOR AD] ${r.title}: ${r.snippet}`);
    });
  }
  if (prodAdsResult.status === 'fulfilled' && 'data' in prodAdsResult.value) {
    prodAdsResult.value.data.slice(0, 3).forEach((r: any) => {
      sources.push({ url: r.url, title: r.title, timestamp: prodAdsResult.value.timestamp, tool: 'serpapi' });
      rawContent.push(`[OUR AD] ${r.title}: ${r.snippet}`);
    });
  }
  if (messagingSearchResult.status === 'fulfilled' && 'data' in messagingSearchResult.value) {
    messagingSearchResult.value.data.slice(0, 4).forEach((r: any) => {
      sources.push({ url: r.url, title: r.title, timestamp: messagingSearchResult.value.timestamp, tool: 'serpapi' });
      rawContent.push(`[MESSAGING SEARCH] ${r.title}: ${r.snippet}`);
    });
  }
  if (redditPerceptionResult.status === 'fulfilled' && 'data' in redditPerceptionResult.value) {
    (redditPerceptionResult.value.data as any[]).slice(0, 3).forEach((p: any) => {
      sources.push({ url: p.url, title: p.title, timestamp: p.created, tool: 'reddit' });
      rawContent.push(`[REDDIT PERCEPTION] ${p.title}: ${p.snippet}`);
    });
  }
  if (socialVoiceResult.status === 'fulfilled' && 'data' in socialVoiceResult.value) {
    socialVoiceResult.value.data.slice(0, 3).forEach((r: any) => {
      sources.push({ url: r.url, title: r.title, timestamp: socialVoiceResult.value.timestamp, tool: 'serpapi' });
      rawContent.push(`[SOCIAL VOICE] ${r.title}: ${r.snippet}`);
    });
  }

  // ── Gemini synthesis ───────────────────────────────────────────────────────
  const positioningGuidelines = vertical === 'FMCG_RETAIL'
    ? `- Brand heritage, trust, and national identity
- Taste, freshness, and quality assurance
- Packaging claims and shelf visibility
- Everyday consumer vs premium indulgence framing`
    : vertical === 'FINANCE'
    ? `- Financial security, trust, and stability
- Interest rate and loan advantages
- Branch access vs digital banking convenience`
    : `- Value framing differences (technology-first vs outcome-first)
- Audience language differences
- Category claim differences`;

  const systemPrompt = `You are a brand positioning strategist. You analyse how companies talk about themselves — their hero message, value frame, audience language — and find gaps and opportunities. Use established corporate knowledge when web signals are minimal.

Key insight: Positioning is how companies connect with their audience and claim market territory.

Look for:
${positioningGuidelines}
${priorContext ? `\nPrior conversation context:\n${priorContext}` : ''}${evidencePackBlock ? `\n\n${evidencePackBlock}` : ''}`;

  const userPrompt = `Query: "${query}"
Our product: ${product}
Competitor: ${competitorName ?? 'not specified — focus on product messaging only'}

Raw signals:
${rawContent.join('\n')}

Produce JSON:
{
  "facts": string[],
  "interpretation": string[],
  "yourPositioning": string,
  "competitorPositioning": string,
  "gaps": [
    {
      "dimension": string,
      "yourMessage": string,
      "competitorMessage": string,
      "gap": string,
      "opportunity": string
    }
  ],
  "adThemes": string[],
  "openQuestions": string[],
  "synthesizedAnswer": string,
  "confidenceScore": number
}

Dimensions to analyse: Value Framing, Audience Language, Category Claim, Emotional Appeal, Social Proof Style, Feature Focus vs Outcome Focus, Brand Personality.`;

  let parsed: any = {};
  try {
    parsed = await generateHuggingFaceJson<any>(systemPrompt, userPrompt, {
      maxNewTokens: 1400,
      temperature: 0.2,
    });
  } catch (err) {
    parsed = {
      facts: factsFromRawSignals(rawContent, 3),
      interpretation: synthesisFailureInterpretation(err),
      yourPositioning: '',
      competitorPositioning: '',
      gaps: [],
      adThemes: [],
      synthesizedAnswer: 'Positioning data collected but synthesis failed.',
      confidenceScore: SYNTHESIS_FAILURE_CONFIDENCE,
    };
  }

  const rawScore: number = typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.6;
  const toolResults = extractToolResults([compHomeResult, prodHomeResult, compAdsResult, prodAdsResult, messagingSearchResult, redditPerceptionResult, socialVoiceResult, compAboutResult, prodAboutResult]);
  const confScore = Number.parseFloat((rawScore * computeSignalQualityPenalty(toolResults, 9)).toFixed(2));
  const confidence: ConfidenceLevel = scoreToLevel(confScore);

  const output: PositioningOutput = {
    agentId: 'positioning',
    domain: 'positioning',
    artifactType: 'positioning-gap',
    confidence,
    confidenceScore: confScore,
    facts: parsed.facts ?? [],
    interpretation: parsed.interpretation ?? [],
    openQuestions: parsed.openQuestions ?? [],
    sources,
    generatedAt: new Date().toISOString(),
    competitor: competitorName ?? 'category alternatives',
    yourPositioning: parsed.yourPositioning ?? '',
    competitorPositioning: parsed.competitorPositioning ?? '',
    gaps: (parsed.gaps ?? []) as MessagingGap[],
    adThemes: parsed.adThemes ?? [],
  };

  return output;
}

export const positioningAgent: AgentConfig = {
  id: 'positioning',
  name: 'Positioning Agent',
  description: 'Analyses homepages, ads, and marketing copy to surface messaging gaps and positioning opportunities.',
  run,
};
