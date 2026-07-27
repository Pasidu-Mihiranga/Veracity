import { generateHuggingFaceText } from '@/lib/agents/gemini';
import { safeParseJson } from '@/lib/agents/json-parse';
import { buildSynthesizePrompt } from '@/lib/agents/prompts/synthesis';
import { isSynthesisFailureInterpretation } from '@/lib/agents/synthesis-fallback';
import { logger } from '@/lib/logger';
import type {
  AgentOutput,
  ConversationMessage,
  ImageAttachment,
  Recommendation,
} from '@/lib/agents/types';

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
): Promise<{ answer: string; recommendations: Recommendation[]; followUps: string[] }> {
  const priorSummary = history
    .slice(-4)
    .filter((m) => m.role === 'assistant')
    .map((m) => m.content.slice(0, 300))
    .join('\n');

  const outputSummaries = outputs.map((o) => ({
    domain: o.domain,
    confidence: o.confidence,
    facts: o.facts.slice(0, 4),
    interpretation: o.interpretation.slice(0, 3),
    sources: o.sources.slice(0, 4).map((s) => ({ title: s.title, url: s.url })),
  }));

  const citedTitles = outputs
    .flatMap((o) => o.sources)
    .slice(0, 16)
    .map((s) => s.title)
    .filter(Boolean);

  const prompt = buildSynthesizePrompt({
    query,
    product,
    competitor,
    memoryContext,
    priorSummary,
    outputSummariesJson: JSON.stringify(outputSummaries, null, 2),
    citedTitlesJson: JSON.stringify(citedTitles, null, 2),
    agentCount: outputs.length,
  });

  try {
    const imageNote =
      images.length > 0
        ? `\nThe user has also attached ${images.length} image(s). Reference their visual content (text, UI elements, charts, pricing tables, etc.) directly in your answer.`
        : '';
    const raw = await generateHuggingFaceText(prompt + imageNote, {
      maxNewTokens: 768,
      temperature: 0.15,
    });
    const parsed = safeParseJson(raw);
    return {
      answer: (parsed.answer as string) || buildFallbackAnswer(outputs, query),
      recommendations: (parsed.recommendations as Recommendation[]) ?? [],
      followUps: (parsed.followUps as string[]) ?? [],
    };
  } catch (err) {
    logger.error('orchestrator.synthesis_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      answer: buildFallbackAnswer(outputs, query),
      recommendations: [],
      followUps: [],
    };
  }
}
