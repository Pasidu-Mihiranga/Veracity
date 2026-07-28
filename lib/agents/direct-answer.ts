import { isUnclearOrGibberishPrompt } from '@/lib/agents/classify';
import { extractEntitiesFromQuery } from '@/lib/agents/extract-entities';
import { generateHuggingFaceText } from '@/lib/agents/gemini';
import { DIRECT_ANSWER_SYSTEM_PROMPT } from '@/lib/agents/prompts/synthesis';
import {
  filterHistoryForQueryScope,
  gateMemoryContext,
  isGenericContinuePrompt,
} from '@/lib/agents/query-scope';
import type { ConversationMessage } from '@/lib/agents/types';

export async function generateDirectAnswer(
  query: string,
  history: ConversationMessage[],
  memoryContext?: string,
): Promise<string> {
  if (isUnclearOrGibberishPrompt(query)) {
    return `I couldn't understand your input ("${query}"). It appears to be a typo or unrecognized prompt.\n\nPlease enter a specific question about your product, competitors, or market strategy (for example: "Compare Notion and Linear pricing" or "What features should Vector Agents build?").`;
  }

  if (isGenericContinuePrompt(query)) {
    return `Tell me which product or competitor you want to analyze — for example: "Compare Clay and Apollo pricing", "Is Notion winning against Linear?", or "Market trends for AI SDR tools."`;
  }

  const heuristic = extractEntitiesFromQuery(query);
  const scopedMemory = gateMemoryContext(query, memoryContext, heuristic);
  const scopedHistory = filterHistoryForQueryScope(history, heuristic, 4);

  const priorContext = scopedHistory
    .map((m) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content.slice(0, 300)}`)
    .join('\n');

  const userPrompt = `${scopedMemory ? `${scopedMemory}\n\n` : ''}${priorContext ? `Conversation history (same topic only):\n${priorContext}\n\n` : ''}User question: "${query}"`;
  const combinedPrompt = `${DIRECT_ANSWER_SYSTEM_PROMPT}\n\n${userPrompt}`;

  try {
    const text = await generateHuggingFaceText(combinedPrompt, {
      maxNewTokens: 256,
      temperature: 0.2,
    });
    return text.trim();
  } catch {
    return `Hello! I am Veracity AI, your executive growth intelligence platform. Ask me any question to analyze competitors, compare positioning, audit pricing, or forecast market trends.`;
  }
}
