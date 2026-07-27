export interface ChatSession {
  id: string;
  title: string;
  folder_name?: string | null;
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

export async function createSession(title: string, folderName?: string | null): Promise<ChatSession | null> {
  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ title, folderName }),
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

export async function updateSessionFolder(sessionId: string, folderName: string | null): Promise<void> {
  await fetch(`/api/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ folderName }),
  });
}

export async function listFolders(): Promise<string[]> {
  const res = await fetch('/api/folders', { credentials: 'include' });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.folders ?? []) as string[];
}

export async function createFolder(name: string): Promise<string | null> {
  const res = await fetch('/api/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return (json.folder as string) ?? name;
}

export async function deleteFolder(name: string): Promise<void> {
  await fetch(`/api/folders?name=${encodeURIComponent(name)}`, {
    method: 'DELETE',
    credentials: 'include',
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
