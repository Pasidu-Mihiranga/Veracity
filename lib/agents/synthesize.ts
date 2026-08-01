import { generateHuggingFaceText } from '@/lib/agents/gemini';
import { safeParseJson } from '@/lib/agents/json-parse';
import { buildSynthesizePrompt } from '@/lib/agents/prompts/synthesis';
import { isSynthesisFailureInterpretation } from '@/lib/agents/synthesis-fallback';
import { extractEntitiesFromQuery } from '@/lib/agents/extract-entities';
import { isSelfComparisonQuery } from '@/lib/agents/classify';
import {
  filterHistoryForQueryScope,
  gateMemoryContext,
} from '@/lib/agents/query-scope';
import { logger } from '@/lib/logger';
import type {
  AgentOutput,
  ConversationMessage,
  DecisionFrame,
  ImageAttachment,
  Recommendation,
} from '@/lib/agents/types';
import type { ResearchIntentClass } from '@/lib/agents/research-intents';

export interface SynthesisResult {
  answer: string;
  recommendations: Recommendation[];
  followUps: string[];
  assumptions: string[];
  unknowns: string[];
  evidenceLimitations: string[];
  whatWouldChangeThis: string[];
  alternativeHypotheses: string[];
  confidenceDrivers: {
    supports: string[];
    weakens: string[];
  };
  decisionFrame?: Partial<DecisionFrame>;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function isSelfHomonymEvidence(value: string): boolean {
  return /\bveracity(?:\s+ai)?\b|veracityai\.com|veracity\.resethiq\.com|\b404\b|\bpricing page\b|\bdevelopment services?\b|\bconsultancy\b|\bpublic presence\b/i.test(value);
}

/** Public same-name companies are not evidence about this running application. */
export function sanitizeOutputsForSelfEvaluation(
  query: string,
  outputs: AgentOutput[],
): AgentOutput[] {
  if (!isSelfComparisonQuery(query)) return outputs;
  return outputs.map((output) => ({
    ...output,
    facts: output.facts.filter((fact) => !isSelfHomonymEvidence(fact)),
    interpretation: output.interpretation.filter((line) => !isSelfHomonymEvidence(line)),
    sources: output.sources.filter(
      (source) => !isSelfHomonymEvidence(`${source.title} ${source.url}`),
    ),
  }));
}

function fallbackUncertainty(outputs: AgentOutput[]): Pick<
  SynthesisResult,
  'assumptions' | 'unknowns' | 'evidenceLimitations' | 'whatWouldChangeThis' | 'alternativeHypotheses' | 'confidenceDrivers'
> {
  const sourceCount = outputs.reduce((sum, output) => sum + output.sources.length, 0);
  const failedDomains = outputs
    .filter((output) => isSynthesisFailureInterpretation(output.interpretation))
    .map((output) => output.domain);
  return {
    assumptions: ['Available live signals are representative of the current market evidence.'],
    unknowns: outputs.flatMap((output) => output.openQuestions ?? []).slice(0, 4),
    evidenceLimitations: [
      ...(sourceCount === 0 ? ['No live sources were retrieved.'] : []),
      ...(failedDomains.length > 0 ? [`Analysis failed for: ${failedDomains.join(', ')}.`] : []),
    ],
    whatWouldChangeThis: ['New primary-source evidence that contradicts the retrieved findings.'],
    alternativeHypotheses: [],
    confidenceDrivers: {
      supports: sourceCount > 0 ? [`${sourceCount} retrieved source(s) across ${outputs.length} agent output(s).`] : [],
      weakens: sourceCount === 0 ? ['No retrieved sources support the conclusion.'] : [],
    },
  };
}

export function buildFallbackAnswer(outputs: AgentOutput[], query: string): string {
  if (outputs.length === 0) {
    return `I couldn't retrieve signal data for "${query}". Please check your API keys and try again.`;
  }

  const synthesisFailures = outputs.filter((o) => isSynthesisFailureInterpretation(o.interpretation));
  const errorLines = synthesisFailures
    .map((o) => o.interpretation.find((line) => line.startsWith('SYNTHESIS_ERROR:')))
    .filter((line): line is string => Boolean(line));

  if (synthesisFailures.length === outputs.length && errorLines.length > 0) {
    const uniqueErrors = [...new Set(errorLines)].slice(0, 3);
    return [
      `I collected live search signals for "${query}", but AI analysis failed for every domain.`,
      '',
      'Exception(s):',
      ...uniqueErrors.map((e) => `• ${e.replace(/^SYNTHESIS_ERROR:\s*/, '')}`),
      '',
      'Check GEMINI_API_KEY / GEMINI_MODEL. Prefer gemini-flash-latest or gemini-3.5-flash (free). gemini-2.5-flash is blocked for many new keys. Then rerun. Domain cards still show raw snippets only.',
    ].join('\n');
  }

  const cleanFacts = outputs
    .flatMap((o) => o.facts)
    .filter((f) => !f.startsWith('[') && !f.startsWith('SYNTHESIS_ERROR:'))
    .slice(0, 4);
  const domains = outputs.map((o) => o.domain.replace(/-/g, ' ')).join(', ');
  const warning =
    synthesisFailures.length > 0
      ? `\n\nWarning: AI synthesis failed for ${synthesisFailures.length}/${outputs.length} domains (${errorLines[0]?.replace(/^SYNTHESIS_ERROR:\s*/, '') ?? 'see domain cards'}).`
      : '';
  if (cleanFacts.length > 0) {
    return `Based on intelligence gathered across ${domains}:\n\n${cleanFacts.map((f) => `• ${f}`).join('\n')}${warning}`;
  }
  return `Intelligence gathered from ${outputs.length} agents covering: ${domains}. Expand the Agent Findings below for detailed insights.${warning}`;
}

export async function synthesize(
  query: string,
  outputs: AgentOutput[],
  history: ConversationMessage[],
  images: ImageAttachment[] = [],
  memoryContext?: string,
  product?: string,
  competitor?: string,
  injectedContext?: string,
  researchIntent?: ResearchIntentClass,
): Promise<SynthesisResult> {
  const heuristic = extractEntitiesFromQuery(query);
  const scopedMemory = gateMemoryContext(query, memoryContext, heuristic);
  const promptContext = [scopedMemory, injectedContext].filter(Boolean).join('\n\n') || undefined;
  const scopedHistory = filterHistoryForQueryScope(history, heuristic, 4);
  const priorSummary = scopedHistory
    .filter((m) => m.role === 'assistant')
    .map((m) => m.content.slice(0, 300))
    .join('\n');

  const scopedOutputs = sanitizeOutputsForSelfEvaluation(query, outputs);
  const outputSummaries = scopedOutputs.map((o) => ({
    domain: o.domain,
    confidence: o.confidence,
    facts: o.facts.slice(0, 4),
    interpretation: o.interpretation.slice(0, 3),
    sources: o.sources.slice(0, 4).map((s) => ({ title: s.title, url: s.url })),
  }));

  const citedTitles = scopedOutputs
    .flatMap((o) => o.sources)
    .slice(0, 16)
    .map((s) => s.title)
    .filter(Boolean);

  const prompt = buildSynthesizePrompt({
    query,
    product,
    competitor,
    memoryContext: promptContext,
    priorSummary,
    outputSummariesJson: JSON.stringify(outputSummaries, null, 2),
    citedTitlesJson: JSON.stringify(citedTitles, null, 2),
    agentCount: scopedOutputs.length,
    researchIntent,
  });

  try {
    const imageNote =
      images.length > 0
        ? `\nThe user has also attached ${images.length} image(s). Reference their visual content (text, UI elements, charts, pricing tables, etc.) directly in your answer.`
        : '';
    const raw = await generateHuggingFaceText(prompt + imageNote, {
      // The decision appendix (assumptions, unknowns, falsifiers, alternatives,
      // confidence drivers) needs enough room to finish valid JSON.
      maxNewTokens: 2200,
      temperature: 0.15,
    });
    const parsed = safeParseJson(raw);
    const fallback = fallbackUncertainty(scopedOutputs);
    const parsedDrivers = parsed.confidenceDrivers as Record<string, unknown> | undefined;
    const selfEvaluation = isSelfComparisonQuery(query);
    const recommendations = ((parsed.recommendations as Recommendation[]) ?? [])
      .filter((recommendation) =>
        !selfEvaluation
        || !/\b(fix|repair|broken|404)\b.*\b(pricing|website|page|infrastructure)\b/i.test(recommendation.title),
      )
      .map((recommendation) => {
        if (!selfEvaluation) return recommendation;
        const unsafeRationale = /\b(veracity|you lack|your current|currently|without this)\b/i.test(
          recommendation.rationale,
        ) || isSelfHomonymEvidence(recommendation.rationale);
        const evidence = recommendation.evidence.filter(
          (item) =>
            !isSelfHomonymEvidence(item)
            && !/\b(veracity|you|your|currently|current|lack|missing)\b/i.test(item),
        );
        return {
          ...recommendation,
          rationale: unsafeRationale
            ? `This is an enterprise evaluation requirement supported by competitor and market findings; Veracity AI's current implementation was not verified.`
            : recommendation.rationale,
          evidence: evidence.length > 0
            ? evidence
            : ['Current Veracity AI capability not verified; treat this as an evaluation requirement.'],
          confidence: recommendation.confidence === 'high' ? 'medium' : recommendation.confidence,
        };
      });
    const selfEvaluationAnswer = selfEvaluation
      ? [
          `The retrieved evidence does not verify Veracity AI's current capabilities against ${competitor ?? 'the named competitors'}.`,
          'Treat these as enterprise evaluation requirements, not proven product defects.',
          recommendations.length > 0
            ? `The strongest requirements supported by market evidence are: ${recommendations.slice(0, 3).map((rec) => rec.title.toLowerCase()).join('; ')}.`
            : 'A defensible assessment requires a product audit covering evidence quality, security, integrations, monitoring, and reliability.',
          'Until that audit exists, confidence should remain medium or lower.',
        ].join(' ')
      : undefined;
    return {
      answer: selfEvaluationAnswer
        ?? (parsed.answer as string)
        ?? buildFallbackAnswer(scopedOutputs, query),
      recommendations,
      followUps: (parsed.followUps as string[]) ?? [],
      assumptions: selfEvaluation
        ? [
            'Veracity AI refers to this application, not a same-name public company.',
            'Competitor and market evidence defines evaluation criteria but does not establish this application’s current capabilities.',
          ]
        : stringArray(parsed.assumptions).length > 0
        ? stringArray(parsed.assumptions)
        : fallback.assumptions,
      unknowns: stringArray(parsed.unknowns).length > 0
        ? stringArray(parsed.unknowns)
        : fallback.unknowns,
      evidenceLimitations: selfEvaluation
        ? [
            'No verified product audit or canonical public source for this application was available to the research agents.',
            ...stringArray(parsed.evidenceLimitations).filter((item) => !isSelfHomonymEvidence(item)),
          ]
        : stringArray(parsed.evidenceLimitations).length > 0
        ? stringArray(parsed.evidenceLimitations)
        : fallback.evidenceLimitations,
      whatWouldChangeThis: stringArray(parsed.whatWouldChangeThis).length > 0
        ? stringArray(parsed.whatWouldChangeThis)
        : fallback.whatWouldChangeThis,
      alternativeHypotheses: stringArray(parsed.alternativeHypotheses)
        .filter((item) => !selfEvaluation || !isSelfHomonymEvidence(item)),
      confidenceDrivers: {
        supports: stringArray(parsedDrivers?.supports).length > 0
          ? stringArray(parsedDrivers?.supports)
          : fallback.confidenceDrivers.supports,
        weakens: stringArray(parsedDrivers?.weakens).length > 0
          ? [
              ...stringArray(parsedDrivers?.weakens),
              ...(selfEvaluation ? ['This application’s current capabilities were not independently verified.'] : []),
            ]
          : [
              ...fallback.confidenceDrivers.weakens,
              ...(selfEvaluation ? ['This application’s current capabilities were not independently verified.'] : []),
            ],
      },
      decisionFrame:
        parsed.decisionFrame && typeof parsed.decisionFrame === 'object'
          ? parsed.decisionFrame as Partial<DecisionFrame>
          : undefined,
    };
  } catch (err) {
    logger.error('orchestrator.synthesis_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      answer: buildFallbackAnswer(scopedOutputs, query),
      recommendations: [],
      followUps: [],
      ...fallbackUncertainty(scopedOutputs),
    };
  }
}
