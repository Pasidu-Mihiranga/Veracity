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
  const orchestratorOutput = meta.orchestratorOutput as ChatMessage['orchestratorOutput'];
  // Restore Phase 3B/4 fields onto orchestratorOutput when stored at metadata root
  if (orchestratorOutput) {
    if (!orchestratorOutput.missionPlan && meta.missionPlan) {
      orchestratorOutput.missionPlan = meta.missionPlan as NonNullable<
        ChatMessage['orchestratorOutput']
      >['missionPlan'];
    }
    if (!orchestratorOutput.quality && meta.quality) {
      orchestratorOutput.quality = meta.quality as NonNullable<
        ChatMessage['orchestratorOutput']
      >['quality'];
    }
    if (!orchestratorOutput.evidenceCoverage && meta.evidenceCoverage) {
      orchestratorOutput.evidenceCoverage = meta.evidenceCoverage as NonNullable<
        ChatMessage['orchestratorOutput']
      >['evidenceCoverage'];
    }
    if (!orchestratorOutput.selectionMeta && meta.selectionMeta) {
      orchestratorOutput.selectionMeta = meta.selectionMeta as NonNullable<
        ChatMessage['orchestratorOutput']
      >['selectionMeta'];
    }
  }
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
    orchestratorOutput,
    orchestrationLog: meta.orchestrationLog as string[] | undefined,
    missionSummary: (meta.missionSummary as ChatMessage['missionSummary'])
      ?? (meta.missionPlan
        ? { steps: (meta.missionPlan as { steps?: unknown[] }).steps, agentCount: (meta.missionPlan as { steps?: unknown[] }).steps?.length }
        : undefined),
  };
}

export function toImageAttachments(images: AttachedImage[]): ImageAttachment[] {
  return images.map((img) => ({ data: img.data, mimeType: img.mimeType }));
}
