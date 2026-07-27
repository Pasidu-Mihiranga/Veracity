import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { upsertDecision, listDecisions } from '@/lib/decisions';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ decisions: [] });
  }

  try {
    const decisions = await listDecisions(user.id, 20);
    return NextResponse.json({ decisions });
  } catch (err) {
    return NextResponse.json({ decisions: [], error: err instanceof Error ? err.message : String(err) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
    }

    const body = await req.json() as {
      sessionId?: string;
      title: string;
      rationale?: string;
      decision: string; // 'accepted' | 'rejected' | 'accepted_modified'
      reason?: string;
      confidence?: number;
      sourceRecommendationKey?: string;
      evidenceUrls?: string[];
    };

    if (!body.title?.trim() || !body.decision?.trim()) {
      return NextResponse.json({ ok: false, error: 'Missing title or decision action' }, { status: 400 });
    }

    const record = await upsertDecision({
      userId: user.id,
      sessionId: body.sessionId,
      title: body.title,
      rationale: body.rationale,
      decision: body.decision,
      reason: body.reason,
      confidence: body.confidence ?? 0.8,
      sourceRecommendationKey: body.sourceRecommendationKey,
      evidenceUrls: body.evidenceUrls,
    });

    return NextResponse.json({ ok: true, decision: record });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
