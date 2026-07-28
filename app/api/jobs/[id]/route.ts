import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getResearchJobForUser } from '@/lib/research-jobs';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Not authenticated' }, 401);
  const { id } = await ctx.params;
  try {
    const job = await getResearchJobForUser(id, user.id);
    if (!job) return json({ error: 'Job not found' }, 404);
    return json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      metrics: job.metrics,
      mission_summary: job.mission_summary,
      cancel_requested: job.cancel_requested,
      error: job.error,
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === '42P01') {
      return json({ error: 'Job store unavailable', warning: 'research_jobs table missing' }, 404);
    }
    throw err;
  }
}
