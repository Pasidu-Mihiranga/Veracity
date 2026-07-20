export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface StoredMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function createSession(title: string): Promise<ChatSession | null> {
  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    console.error('createSession:', res.status);
    return null;
  }
  const json = await res.json();
  return (json.session as ChatSession) ?? null;
}

export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
  await fetch(`/api/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ title }),
  });
}

export async function listSessions(): Promise<ChatSession[]> {
  const res = await fetch('/api/sessions', { credentials: 'include' });
  if (!res.ok) {
    console.error('listSessions:', res.status);
    return [];
  }
  const json = await res.json();
  return (json.sessions ?? []) as ChatSession[];
}

export async function deleteSession(sessionId: string): Promise<void> {
  await fetch(`/api/sessions/${sessionId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
}

export async function saveMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata: Record<string, unknown> = {},
): Promise<string | null> {
  const res = await fetch(`/api/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ role, content, metadata }),
  });
  if (!res.ok) {
    console.error('saveMessage:', res.status);
    return null;
  }
  const json = await res.json();
  return (json.id as string | undefined) ?? null;
}

export async function loadMessages(sessionId: string): Promise<StoredMessage[]> {
  const res = await fetch(`/api/sessions/${sessionId}/messages`, { credentials: 'include' });
  if (!res.ok) {
    console.error('loadMessages:', res.status);
    return [];
  }
  const json = await res.json();
  return (json.messages ?? []) as StoredMessage[];
}
