import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  upsertDecision,
  listDecisions,
  setDecisionOutcome,
  type DecisionOutcome,
} from '@/lib/decisions';
import { featureFlags } from '@/lib/feature-flags';
import { requireWorkspaceAccess, resolveTenantFromCookies } from '@/lib/workspace';

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
      id?: string;
      outcome?: DecisionOutcome;
      note?: string;
      sessionId?: string;
      title?: string;
      rationale?: string;
      decision?: string; // 'accepted' | 'rejected' | 'accepted_modified'
      reason?: string;
      confidence?: number;
      sourceRecommendationKey?: string;
      evidenceUrls?: string[];
    };
    let workspaceId: string | null = null;
    if (featureFlags.workspaces) {
      const tenant = await resolveTenantFromCookies(user.id, user.email ?? '');
      workspaceId = tenant.workspaceId;
      if (workspaceId) {
        await requireWorkspaceAccess(user.id, workspaceId, 'session.write');
      }
    }

    if (body.id && body.outcome) {
      const allowed: DecisionOutcome[] = [
        'pending',
        'validated',
        'invalidated',
        'adopted_after_reject',
      ];
      if (!allowed.includes(body.outcome)) {
        return NextResponse.json({ ok: false, error: 'Invalid decision outcome' }, { status: 400 });
      }
      const record = await setDecisionOutcome({
        id: body.id,
        userId: user.id,
        outcome: body.outcome,
        note: body.note,
      });
      if (!record) {
        return NextResponse.json({ ok: false, error: 'Decision not found' }, { status: 404 });
      }
      await refreshBoardPackAfterDecision(user.id, workspaceId);
      return NextResponse.json({ ok: true, decision: record });
    }

    if (!body.title?.trim() || !body.decision?.trim()) {
      return NextResponse.json({ ok: false, error: 'Missing title or decision action' }, { status: 400 });
    }

    const record = await upsertDecision({
      userId: user.id,
      workspaceId,
      sessionId: body.sessionId,
      title: body.title,
      rationale: body.rationale,
      decision: body.decision,
      reason: body.reason,
      confidence: body.confidence ?? 0.8,
      sourceRecommendationKey: body.sourceRecommendationKey,
      evidenceUrls: body.evidenceUrls,
    });
    await refreshBoardPackAfterDecision(user.id, workspaceId);

    return NextResponse.json({ ok: true, decision: record });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}

async function refreshBoardPackAfterDecision(
  userId: string,
  workspaceId: string | null,
): Promise<void> {
  if (!featureFlags.continuousIntelligence) return;
  try {
    const { refreshContinuousBoardPack } = await import(
      '@/lib/continuous-intelligence/board-refresh'
    );
    await refreshContinuousBoardPack({
      userId,
      workspaceId,
      refreshReason: 'decision-update',
    });
  } catch {
    // Decision writes remain authoritative; scheduled refresh repairs the projection.
  }
}
