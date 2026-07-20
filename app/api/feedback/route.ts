import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

type RecommendationFeedbackBody = {
  kind: 'recommendation-feedback';
  sessionId: string;
  messageId?: string | null;
  recommendationKey: string;
  title: string;
  rating: 'up' | 'down' | 'neutral';
  note?: string;
};

type RecommendationActionBody = {
  kind: 'recommendation-action';
  sessionId: string;
  messageId?: string | null;
  recommendationKey: string;
  title: string;
  action: 'accepted' | 'rejected' | 'refined' | 'copied';
  metadata?: Record<string, unknown>;
};

type VariantResultBody = {
  kind: 'variant-result';
  sessionId: string;
  messageId?: string | null;
  variantId: string;
  variantAngle?: string;
  hypothesis?: string;
  successMetric?: string;
  sentCount?: number;
  openRate?: number;
  replyRate?: number;
  clickRate?: number;
  meetingsBooked?: number;
  hypothesisConfirmed?: 'yes' | 'no' | 'unclear';
  notes?: string;
};

type FeedbackBody = RecommendationFeedbackBody | RecommendationActionBody | VariantResultBody;

export async function POST(req: NextRequest) {
  let body: FeedbackBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }

  if (!body?.kind || !body.sessionId) {
    return NextResponse.json({ ok: false, error: 'missing kind or sessionId' }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }

  try {
    if (body.kind === 'recommendation-feedback') {
      if (!body.recommendationKey || !body.title || !body.rating) {
        return NextResponse.json({ ok: false, error: 'missing required fields' }, { status: 400 });
      }
      await query(
        `INSERT INTO recommendation_feedback
          (user_id, session_id, message_id, recommendation_key, title, rating, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          user.id,
          body.sessionId,
          body.messageId ?? null,
          body.recommendationKey,
          body.title,
          body.rating,
          body.note ?? null,
        ],
      );
      return NextResponse.json({ ok: true });
    }

    if (body.kind === 'recommendation-action') {
      if (!body.recommendationKey || !body.title || !body.action) {
        return NextResponse.json({ ok: false, error: 'missing required fields' }, { status: 400 });
      }
      await query(
        `INSERT INTO recommendation_actions
          (user_id, session_id, message_id, recommendation_key, title, action, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
        [
          user.id,
          body.sessionId,
          body.messageId ?? null,
          body.recommendationKey,
          body.title,
          body.action,
          JSON.stringify(body.metadata ?? {}),
        ],
      );
      return NextResponse.json({ ok: true });
    }

    if (body.kind === 'variant-result') {
      if (!body.variantId) {
        return NextResponse.json({ ok: false, error: 'missing variantId' }, { status: 400 });
      }
      await query(
        `INSERT INTO variant_results
          (user_id, session_id, message_id, variant_id, variant_angle, hypothesis, success_metric,
           sent_count, open_rate, reply_rate, click_rate, meetings_booked, hypothesis_confirmed, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          user.id,
          body.sessionId,
          body.messageId ?? null,
          body.variantId,
          body.variantAngle ?? null,
          body.hypothesis ?? null,
          body.successMetric ?? null,
          body.sentCount ?? null,
          body.openRate ?? null,
          body.replyRate ?? null,
          body.clickRate ?? null,
          body.meetingsBooked ?? null,
          body.hypothesisConfirmed ?? null,
          body.notes ?? null,
        ],
      );
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: 'unknown kind' }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'server error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: 'sessionId required' }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }

  const [feedbackRes, actionsRes, resultsRes] = await Promise.all([
    query(
      `SELECT * FROM recommendation_feedback WHERE session_id = $1 AND user_id = $2
       ORDER BY created_at DESC LIMIT 50`,
      [sessionId, user.id],
    ),
    query(
      `SELECT * FROM recommendation_actions WHERE session_id = $1 AND user_id = $2
       ORDER BY created_at DESC LIMIT 50`,
      [sessionId, user.id],
    ),
    query(
      `SELECT * FROM variant_results WHERE session_id = $1 AND user_id = $2
       ORDER BY created_at DESC LIMIT 50`,
      [sessionId, user.id],
    ),
  ]);

  return NextResponse.json({
    ok: true,
    feedback: feedbackRes.rows,
    actions: actionsRes.rows,
    variantResults: resultsRes.rows,
  });
}
