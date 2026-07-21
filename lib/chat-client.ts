import type { ImageAttachment } from '@/lib/agents/types';
import type { AttachedImage, ChatMessage } from '@/types/chat-ui';
import type { StoredMessage } from '@/lib/conversations';

export async function recallContextForSession(sessionId: string, query: string): Promise<string> {
  try {
    const res = await fetch('/api/recall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, query }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    return (data?.context as string) ?? '';
  } catch {
    return '';
  }
}

export function indexMessageInBackground(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
) {
  if (!content?.trim()) return;
  fetch('/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, role, content }),
  }).catch(() => {});
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function hydrateMessage(m: StoredMessage, idx: number): ChatMessage {
  const meta = m.metadata ?? {};
  return {
    id: idx,
    persistedId: m.id,
    role: m.role,
    type: (meta.type as ChatMessage['type']) ?? (m.role === 'assistant' ? 'intelligence' : undefined),
    content: m.content,
    images: meta.images as AttachedImage[] | undefined,
    sources: meta.sources as ChatMessage['sources'],
    suggestions: meta.suggestions as string[] | undefined,
    recommendations: meta.recommendations as ChatMessage['recommendations'],
    agentRuns: meta.agentRuns as ChatMessage['agentRuns'],
    orchestratorOutput: meta.orchestratorOutput as ChatMessage['orchestratorOutput'],
  };
}

export function toImageAttachments(images: AttachedImage[]): ImageAttachment[] {
  return images.map((img) => ({ data: img.data, mimeType: img.mimeType }));
}
