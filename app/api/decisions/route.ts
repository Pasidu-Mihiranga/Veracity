import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { featureFlags } from '@/lib/feature-flags';
import {
  listDecisions,
  setDecisionOutcome,
  upsertDecision,
  type DecisionOutcome,
} from '@/lib/decisions';

export async function GET() {
  if (!featureFlags.decisionMemory) {
    return NextResponse.json({ decisions: [] });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const decisions = await listDecisions(user.id);
  return NextResponse.json({ decisions });
}

export async function POST(req: Request) {
  if (!featureFlags.decisionMemory) {
    return NextResponse.json({ error: 'Decision memory disabled' }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    title?: string;
    rationale?: string;
    decision?: string;
    reason?: string;
    confidence?: number;
    sessionId?: string;
    sourceRecommendationKey?: string;
    evidenceUrls?: string[];
    id?: string;
    outcome?: DecisionOutcome;
    outcomeNote?: string;
  };

  if (body.id && body.outcome) {
    const row = await setDecisionOutcome({
      id: body.id,
      userId: user.id,
      outcome: body.outcome,
      note: body.outcomeNote,
    });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ decision: row });
  }

  if (!body.title?.trim() || !body.decision) {
    return NextResponse.json({ error: 'title and decision required' }, { status: 400 });
  }

  const decision = await upsertDecision({
    userId: user.id,
    sessionId: body.sessionId,
    title: body.title.trim(),
    rationale: body.rationale,
    decision: body.decision,
    reason: body.reason,
    confidence: body.confidence,
    sourceRecommendationKey: body.sourceRecommendationKey,
    evidenceUrls: body.evidenceUrls,
  });
  return NextResponse.json({ decision });
}
