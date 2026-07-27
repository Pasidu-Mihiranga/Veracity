import { isUnclearOrGibberishPrompt } from '@/lib/agents/classify';
import { generateHuggingFaceText } from '@/lib/agents/gemini';
import { DIRECT_ANSWER_SYSTEM_PROMPT } from '@/lib/agents/prompts/synthesis';
import type { ConversationMessage } from '@/lib/agents/types';

export async function generateDirectAnswer(
  query: string,
  history: ConversationMessage[],
  memoryContext?: string,
): Promise<string> {
  if (isUnclearOrGibberishPrompt(query)) {
    return `I couldn't understand your input ("${query}"). It appears to be a typo or unrecognized prompt.\n\nPlease enter a specific question about your product, competitors, or market strategy (for example: "Compare Notion and Linear pricing" or "What features should Vector Agents build?").`;
  }

  const priorContext = history
    .slice(-4)
    .map((m) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content.slice(0, 300)}`)
    .join('\n');

  const userPrompt = `${memoryContext ? `${memoryContext}\n\n` : ''}${priorContext ? `Conversation history:\n${priorContext}\n\n` : ''}User question: "${query}"`;
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
