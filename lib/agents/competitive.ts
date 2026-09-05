import { searchWeb, searchNews } from '../tools/serpapi';
import { scrapePage, scrapeCompetitorPricing } from '../tools/firecrawl';
import { searchHN } from '../tools/hn-algolia';
import { scrapeTwitterX } from '../tools/apify-twitter';
import { generateHuggingFaceJson } from './gemini';
import {
  competitorSiteUrl,
  isUsableScrapePage,
  skippedScrapePromise,
} from './entity-url';
import type {
  AgentConfig,
  AgentContext,
  AgentOutput,
  CompetitiveOutput,
  CompetitorFeature,
  AgentSource,
  ConfidenceLevel,
} from './types';
import { scoreToLevel } from './types';
import { computeSignalQualityPenalty, extractToolResults } from '../tools/fallback';
import {
  SYNTHESIS_FAILURE_CONFIDENCE,
  factsFromRawSignals,
  synthesisFailureInterpretation,
} from './synthesis-fallback';

async function run(ctx: AgentContext): Promise<AgentOutput> {
  const { query, product, competitor, priorContext, evidencePackBlock} = ctx;

  const vertical = ctx.industryVertical || 'GENERAL';
  const competitorName = competitor?.trim() || null;
  const searchSubject = competitorName || `${product} competitors alternatives`;
  const compUrl = competitorSiteUrl(ctx);

  // ── Parallel data fetch with vertical awareness ────────────────────────────
  const webQuery = vertical === 'FMCG_RETAIL'
    ? `${searchSubject} products SKU portfolio market share 2025 2026`
    : vertical === 'FINANCE'
    ? `${searchSubject} banking products interest rates loans market share 2025 2026`
    : `${searchSubject} features product update 2025 2026`;

  const newsQuery = vertical === 'FMCG_RETAIL'
    ? `${searchSubject} retail distribution factory export expansion product launch 2025 2026`
    : vertical === 'FINANCE'
    ? `${searchSubject} financial performance banking growth branch network 2025 2026`
    : `${searchSubject} funding launch product announcement 2025`;

  const socialQuery = vertical === 'FMCG_RETAIL'
    ? `${searchSubject} ${product} quality taste packaging retail feedback`
    : `${searchSubject} ${product} site:x.com OR site:twitter.com OR site:instagram.com OR site:linkedin.com launch feature feedback`;

  const [webResult, newsResult, hnResult, scrapeResult, pricingResult, socialSignalsResult, apifyTwitterResult] = await Promise.allSettled([
    searchWeb(webQuery),
    searchNews(newsQuery),
    vertical === 'B2B_SAAS' || vertical === 'CONSUMER_TECH'
      ? searchHN(competitorName ? `${competitorName} ${product}` : `${product} competitors`)
      : Promise.resolve({ data: [], status: 'ok', timestamp: new Date().toISOString(), source: 'hn' }),
    compUrl ? scrapePage(compUrl) : skippedScrapePromise(),
    compUrl ? scrapeCompetitorPricing(compUrl) : skippedScrapePromise(),
    searchWeb(socialQuery),
    scrapeTwitterX(
      competitorName
        ? [`${competitorName} ${product}`, `${competitorName} feedback`]
        : [`${product} competitors`, `${product} alternatives`],
      {
        maxItems: 40,
        sort: 'Latest',
        language: 'en',
      },
    ),
  ]);

  // Hiring signals (only for tech/SaaS where dev hiring reflects feature velocity)
  const hiringResult = vertical === 'B2B_SAAS' || vertical === 'CONSUMER_TECH'
    ? await Promise.allSettled([
        searchWeb(`${searchSubject} jobs hiring "AI" OR "machine learning" OR "sales" site:linkedin.com OR site:greenhouse.io`),
      ])
    : [];

  // ── Collect sources ────────────────────────────────────────────────────────
  const sources: AgentSource[] = [];
  const rawContent: string[] = [];

  if (webResult.status === 'fulfilled' && 'data' in webResult.value) {
    webResult.value.data.slice(0, 5).forEach((r: any) => {
      sources.push({ url: r.url, title: r.title, timestamp: webResult.value.timestamp, tool: 'serpapi' });
      rawContent.push(`[COMPETITOR WEB] ${r.title}: ${r.snippet}`);
    });
  }
  if (newsResult.status === 'fulfilled' && 'data' in newsResult.value) {
    newsResult.value.data.slice(0, 4).forEach((r: any) => {
      sources.push({ url: r.url, title: r.title, timestamp: newsResult.value.timestamp, tool: 'serpapi' });
      rawContent.push(`[COMPETITOR NEWS] ${r.title}: ${r.snippet}`);
    });
  }
  if (hnResult.status === 'fulfilled' && 'data' in hnResult.value) {
    (hnResult.value.data as any[]).slice(0, 3).forEach((p: any) => {
      sources.push({ url: p.url, title: p.title, timestamp: p.created, tool: 'hn' });
      rawContent.push(`[HN] ${p.title}`);
    });
  }
  if (isUsableScrapePage(scrapeResult)) {
    const page = scrapeResult.value.data;
    sources.push({ url: page.url, title: page.title || searchSubject, timestamp: scrapeResult.value.timestamp, tool: 'firecrawl' });
    rawContent.push(`[COMPETITOR HOMEPAGE] ${page.excerpt}`);
  }
  if (isUsableScrapePage(pricingResult)) {
    const page = pricingResult.value.data;
    const label = competitor ? `${competitor} pricing` : 'Competitor pricing page';
    sources.push({ url: page.url, title: label, timestamp: pricingResult.value.timestamp, tool: 'firecrawl' });
    rawContent.push(`[COMPETITOR PRICING] ${page.excerpt}`);
  }
  if (socialSignalsResult.status === 'fulfilled' && 'data' in socialSignalsResult.value) {
    socialSignalsResult.value.data.slice(0, 3).forEach((r: any) => {
      sources.push({ url: r.url, title: r.title, timestamp: socialSignalsResult.value.timestamp, tool: 'serpapi' });
      rawContent.push(`[SOCIAL SIGNAL] ${r.title}: ${r.snippet}`);
    });
  }
  if (apifyTwitterResult.status === 'fulfilled' && 'data' in apifyTwitterResult.value) {
    apifyTwitterResult.value.data.slice(0, 8).forEach((t: any) => {
      sources.push({
        url: t.url,
        title: `X @${t.authorHandle ?? 'unknown'}`,
        timestamp: t.createdAt ?? apifyTwitterResult.value.timestamp,
        tool: 'apify',
      });
      rawContent.push(
        `[APIFY X] @${t.authorHandle ?? 'unknown'}: ${t.text}` +
        `${typeof t.likeCount === 'number' ? ` (likes ${t.likeCount})` : ''}`
      );
    });
  }
  if (hiringResult[0]?.status === 'fulfilled' && 'data' in hiringResult[0].value) {
    hiringResult[0].value.data.slice(0, 3).forEach((r: any) => {
      rawContent.push(`[HIRING SIGNAL] ${r.title}: ${r.snippet}`);
    });
  }

  // ── Gemini synthesis ───────────────────────────────────────────────────────
  const verticalSpecialty = vertical === 'FMCG_RETAIL'
    ? 'FMCG, Retail, and Consumer Packaged Goods. You compare brand market share, product variety & SKUs, retail shelf distribution, ingredient quality, and consumer loyalty'
    : vertical === 'FINANCE'
    ? 'Banking and Financial Services. You compare interest rates, loan portfolios, regulatory compliance, branch reach, and customer trust'
    : 'competitive intelligence. You compare product capabilities, value delivery, and market positioning';

  const systemPrompt = `You are a competitive intelligence analyst specialising in ${verticalSpecialty} with brutal honesty. You separate facts from interpretation. You never fabricate features or metrics. Use parametric corporate facts when retrieved evidence is sparse.
${priorContext ? `\nPrior conversation context:\n${priorContext}` : ''}${evidencePackBlock ? `\n\n${evidencePackBlock}` : ''}`;

  const userPrompt = `Query: "${query}"
Our product: ${product}
Competitor: ${competitorName ?? `${product} category alternatives`}
Industry Vertical: ${vertical}

Raw signals:
${rawContent.join('\n')}

Produce a JSON object:
{
  "facts": string[],
  "interpretation": string[],
  "competitorSummary": string,
  "matrix": [
    {
      "feature": string,
      "yourProduct": "strong" | "medium" | "weak" | "none",
      "competitor": "strong" | "medium" | "weak" | "none",
      "gapDirection": "advantage" | "parity" | "disadvantage"
    }
  ],
  "hiringSignals": string[],
  "recentMoves": string[],
  "openQuestions": string[], // unresolved evidence gaps; empty only if evidence resolves them
  "synthesizedAnswer": string,
  "confidenceScore": number
}

For the matrix, infer the most relevant feature dimensions from the signals above. Choose dimensions that are actually relevant to ${product}${competitorName ? ` and ${competitorName}` : ''} based on what the data shows. Do not invent competitor features without signal support.`;

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
      competitorSummary: `${competitorName ?? product} competitive data collected but AI synthesis failed.`,
      matrix: [],
      hiringSignals: [],
      recentMoves: [],
      synthesizedAnswer: 'Competitive data was gathered but synthesis failed.',
      confidenceScore: SYNTHESIS_FAILURE_CONFIDENCE,
    };
  }

  const rawScore: number = typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.6;
  const toolResults = extractToolResults([webResult, newsResult, hnResult, scrapeResult, pricingResult, socialSignalsResult, apifyTwitterResult, ...hiringResult]);
  const confScore = Number.parseFloat((rawScore * computeSignalQualityPenalty(toolResults, 8)).toFixed(2));
  const confidence: ConfidenceLevel = scoreToLevel(confScore);

  const output: CompetitiveOutput = {
    agentId: 'competitive',
    domain: 'competitive',
    artifactType: 'competitive-matrix',
    confidence,
    confidenceScore: confScore,
    facts: parsed.facts ?? [],
    interpretation: parsed.interpretation ?? [],
    openQuestions: parsed.openQuestions ?? [],
    sources,
    generatedAt: new Date().toISOString(),
    competitor: competitorName ?? 'category alternatives',
    matrix: (parsed.matrix ?? []) as CompetitorFeature[],
    competitorSummary: parsed.competitorSummary ?? '',
    hiringSignals: parsed.hiringSignals ?? [],
    recentMoves: parsed.recentMoves ?? [],
  };

  return output;
}

export const competitiveAgent: AgentConfig = {
  id: 'competitive',
  name: 'Competitive Agent',
  description: 'Scrapes competitor product pages, changelogs, and pricing to build a feature comparison matrix.',
  run,
};
