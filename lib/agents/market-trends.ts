import { searchWeb, searchNews, searchTrends } from '../tools/serpapi';
import { searchHN, getTechSentiment } from '../tools/hn-algolia';
import { searchReddit } from '../tools/reddit';
import { scrapeTwitterX } from '../tools/apify-twitter';
import { planQueries } from '../tools/query-planner';
import { generateHuggingFaceJson } from './gemini';
import type {
  AgentConfig,
  AgentContext,
  AgentOutput,
  MarketTrendsOutput,
  TrendDataPoint,
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

function isSocialUrl(url: string): boolean {
  return /(?:^|\/\/)(?:www\.)?(x\.com|twitter\.com|linkedin\.com|instagram\.com)\//i.test(url);
}

async function run(ctx: AgentContext): Promise<AgentOutput> {
  const { query, product, competitor, priorContext, evidencePackBlock} = ctx;

  // ── Smart query planning — generates 3 query variants per intent ─────────
  const queryBundle = planQueries({
    product,
    competitor,
    domain: 'market-trends',
    query,
    category: query.toLowerCase().includes('ai') ? 'AI/ML' : 'SaaS',
  });

  // ── Parallel data fetch ────────────────────────────────────────────────────
  const category = competitor
    ? `${product} vs ${competitor}`
    : product;

  const trendKeywords = [product, competitor].filter(Boolean) as string[];

  // Use query bundle: broad + targeted + hypothesis queries in parallel
  const [webResult, newsResult, trendsResult, hnResult, redditResult, webTargetedResult, webHypothesisResult, socialPulseResult, apifyTwitterResult] = await Promise.allSettled([
    searchWeb(queryBundle.broad),
    searchNews(`${product}${competitor ? ` ${competitor}` : ''} market growth revenue funding`),
    searchTrends(trendKeywords),
    getTechSentiment(product),
    searchReddit(queryBundle.hypothesis),
    searchWeb(queryBundle.targeted),
    searchWeb(queryBundle.hypothesis),
    searchWeb(`${product}${competitor ? ` ${competitor}` : ''} site:x.com OR site:twitter.com OR site:instagram.com OR site:linkedin.com trend launch feedback`),
    // Search terms carry product/competitor; do not pass company names as twitterHandles
    // (they are not @handles and waste Apify or return empty).
    scrapeTwitterX([queryBundle.targeted, queryBundle.hypothesis], {
      maxItems: 80,
      sort: 'Latest',
      language: 'en',
    }),
  ]);

  // ── Collect sources ────────────────────────────────────────────────────────
  const sources: AgentSource[] = [];
  const rawContent: string[] = [];

  if (webResult.status === 'fulfilled') {
    webResult.value.data.slice(0, 3).forEach(r => {
      sources.push({ url: r.url, title: r.title, timestamp: webResult.value.timestamp, tool: 'serpapi' });
      rawContent.push(`[WEB BROAD] ${r.title}: ${r.snippet}`);
    });
  }
  if (webTargetedResult.status === 'fulfilled') {
    webTargetedResult.value.data.slice(0, 2).forEach(r => {
      sources.push({ url: r.url, title: r.title, timestamp: webTargetedResult.value.timestamp, tool: 'serpapi' });
      rawContent.push(`[WEB TARGETED] ${r.title}: ${r.snippet}`);
    });
  }
  if (webHypothesisResult.status === 'fulfilled') {
    webHypothesisResult.value.data.slice(0, 2).forEach(r => {
      sources.push({ url: r.url, title: r.title, timestamp: webHypothesisResult.value.timestamp, tool: 'serpapi' });
      rawContent.push(`[WEB HYPOTHESIS] ${r.title}: ${r.snippet}`);
    });
  }
  if (socialPulseResult.status === 'fulfilled') {
    socialPulseResult.value.data.slice(0, 3).forEach(r => {
      sources.push({ url: r.url, title: r.title, timestamp: socialPulseResult.value.timestamp, tool: 'serpapi' });
      rawContent.push(`[SOCIAL PULSE] ${r.title}: ${r.snippet}`);
    });
  }
  if (newsResult.status === 'fulfilled') {
    newsResult.value.data.slice(0, 4).forEach(r => {
      sources.push({ url: r.url, title: r.title, timestamp: newsResult.value.timestamp, tool: 'serpapi' });
      rawContent.push(`[NEWS] ${r.title}: ${r.snippet}`);
    });
  }
  if (trendsResult.status === 'fulfilled') {
    const pts = trendsResult.value.data;
    sources.push({ url: trendsResult.value.sourceUrl ?? '', title: 'Google Trends', timestamp: trendsResult.value.timestamp, tool: 'serpapi' });
    const summary = pts.slice(0, 10).map(p => `${p.keyword}@${p.date}=${p.value}`).join(', ');
    rawContent.push(`[TRENDS] ${summary}`);
  }
  if (hnResult.status === 'fulfilled') {
    const { hnResult: hn, summary } = hnResult.value;
    hn.data.slice(0, 3).forEach(p => {
      sources.push({ url: p.url, title: p.title, timestamp: p.created, tool: 'hn' });
    });
    rawContent.push(`[HN SENTIMENT] ${summary}`);
  }
  if (redditResult.status === 'fulfilled') {
    redditResult.value.data.slice(0, 3).forEach(p => {
      sources.push({ url: p.url, title: p.title, timestamp: p.created, tool: 'reddit' });
      rawContent.push(`[REDDIT] ${p.title}: ${p.snippet}`);
    });
  }
  if (apifyTwitterResult.status === 'fulfilled') {
    apifyTwitterResult.value.data.slice(0, 8).forEach(t => {
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

  // If the first pass yields no social links, do strict per-domain backfill.
  const hasSocialSources = sources.some(s => isSocialUrl(s.url));
  const socialBackfillResults = hasSocialSources
    ? []
    : await Promise.allSettled([
        searchWeb(`site:x.com "${product}"${competitor ? ` OR "${competitor}"` : ''} launch OR feedback OR pricing`),
        searchWeb(`site:twitter.com "${product}"${competitor ? ` OR "${competitor}"` : ''} launch OR feedback OR pricing`),
        searchWeb(`site:linkedin.com "${product}"${competitor ? ` OR "${competitor}"` : ''} announcement OR hiring OR product update`),
        searchWeb(`site:instagram.com "${product}"${competitor ? ` OR "${competitor}"` : ''} product OR campaign`),
      ]);

  for (const result of socialBackfillResults) {
    if (result.status === 'fulfilled') {
      result.value.data
        .filter(r => isSocialUrl(r.url))
        .slice(0, 2)
        .forEach(r => {
          sources.push({ url: r.url, title: r.title, timestamp: result.value.timestamp, tool: 'serpapi' });
          rawContent.push(`[SOCIAL BACKFILL] ${r.title}: ${r.snippet}`);
        });
    }
  }

  // ── Gemini synthesis ───────────────────────────────────────────────────────
  const systemPrompt = `You are a senior market intelligence analyst. Your job is to analyse raw signals and produce structured, grounded market trend insights.

Rules:
- Separate FACTS (verifiable from sources) from INTERPRETATION (analyst view).
- Never hallucinate. Only state what the signals support.
- Be specific: name trends and directions. Do NOT invent precise scores like "100/100", exact average HN scores, or market % unless the raw signals contain that number.
- If quantifying engagement, say "estimated" or "directional" and keep magnitudes coarse.
- Output valid JSON matching the schema exactly.
${priorContext ? `\nPrior conversation context:\n${priorContext}` : ''}${evidencePackBlock ? `\n\n${evidencePackBlock}` : ''}`;

  const userPrompt = `Query: "${query}"
Product: ${product}
${competitor ? `Competitor: ${competitor}` : ''}

Raw signals collected:
${rawContent.join('\n')}

Produce a JSON object with this exact shape:
{
  "facts": string[],          // 4-6 verifiable claims directly from the signals
  "interpretation": string[], // 3-4 analyst insights derived from the facts
  "trends": [
    {
      "keyword": string,
      "direction": "up" | "down" | "flat",
      "changePercent": number,
      "signal": string,
      "source": string
    }
  ],
  "categoryOutlook": "accelerating" | "consolidating" | "maturing" | "emerging",
  "keySignals": string[],     // top 3 leading indicators
  "timeHorizon": string,
  "openQuestions": string[],  // unresolved evidence gaps; empty only if evidence resolves them
  "synthesizedAnswer": string, // 2-3 sentence plain-English summary
  "confidenceScore": number    // 0.0 - 1.0
}`;

  let parsed: any = {};
  try {
    parsed = await generateHuggingFaceJson<any>(systemPrompt, userPrompt, {
      maxNewTokens: 1400,
      temperature: 0.2,
    });
  } catch (err) {
    // This agent previously invented a fact ("Market growth signals collected
    // across web, news, and technical channels."), claimed the synthesis had
    // succeeded ("Synthesis synthesized from live search and market signals."),
    // asserted an 'emerging' outlook, and reported 0.5 confidence — all on a
    // path where synthesis had just thrown. It was the only one of the six
    // research agents not converted to the shared honest handler.
    //
    // Facts now come solely from raw signals the tools actually returned; when
    // there were none, `facts` stays empty. Judgment fields stay undefined so
    // the artifact renders an explicit unavailable state.
    parsed = {
      facts: factsFromRawSignals(rawContent, 3),
      interpretation: synthesisFailureInterpretation(err),
      trends: [],
      categoryOutlook: undefined,
      keySignals: [],
      timeHorizon: undefined,
      synthesizedAnswer: 'Market trend data was collected but synthesis failed.',
      confidenceScore: SYNTHESIS_FAILURE_CONFIDENCE,
    };
  }

  const rawScore: number = typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.6;
  // Penalise the Gemini-reported score by the aggregate signal quality of the
  // tool calls that fed it — a synthesis with 3 failed tools shouldn't get the
  // same confidence as one with all tools succeeding.
  const toolResults = extractToolResults([
    webResult,
    newsResult,
    trendsResult,
    hnResult,
    redditResult,
    webTargetedResult,
    webHypothesisResult,
    socialPulseResult,
    apifyTwitterResult,
    ...socialBackfillResults,
  ]);
  const signalPenalty = computeSignalQualityPenalty(toolResults, 8 + socialBackfillResults.length);
  const confScore = Number.parseFloat((rawScore * signalPenalty).toFixed(2));
  const confidence: ConfidenceLevel = scoreToLevel(confScore);

  const output: MarketTrendsOutput = {
    agentId: 'market-trends',
    domain: 'market-trends',
    artifactType: 'trend-chart',
    confidence,
    confidenceScore: confScore,
    facts: parsed.facts ?? [],
    interpretation: parsed.interpretation ?? [],
    openQuestions: parsed.openQuestions ?? [],
    sources,
    generatedAt: new Date().toISOString(),
    trends: (parsed.trends ?? []) as TrendDataPoint[],
    // No `?? 'emerging'` / `?? '6-12 months'` defaults: an absent judgment must
    // stay absent rather than becoming a plausible-looking assessment.
    categoryOutlook: parsed.categoryOutlook,
    keySignals: parsed.keySignals ?? [],
    timeHorizon: parsed.timeHorizon,
  };

  return output;
}

export const marketTrendsAgent: AgentConfig = {
  id: 'market-trends',
  name: 'Trend Sensor',
  description: 'Detects market direction via job postings, funding signals, search trends, and news.',
  run,
};
