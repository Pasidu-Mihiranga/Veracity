import { createClient } from '@/lib/supabase-server';
import { writeAuditLog, listAuditLogs } from '@/lib/audit';
import { featureFlags } from '@/lib/feature-flags';

export async function GET(req: Request) {
  if (!featureFlags.auditLogs) {
    return new Response(JSON.stringify({ logs: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 });
  }

  const limit = Number(new URL(req.url).searchParams.get('limit') ?? 10);
  const logs = await listAuditLogs(user.id, limit);
  return new Response(JSON.stringify({ logs }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(req: Request) {
  if (!featureFlags.auditLogs) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 });
  }

  let body: {
    action?: string;
    resourceType?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  if (!body.action?.trim() || !body.resourceType?.trim()) {
    return new Response(JSON.stringify({ error: 'action and resourceType required' }), { status: 400 });
  }

  await writeAuditLog({
    userId: user.id,
    action: body.action,
    resourceType: body.resourceType,
    resourceId: body.resourceId,
    metadata: body.metadata,
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
