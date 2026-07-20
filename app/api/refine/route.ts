import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { orchestrate } from '@/lib/agents/orchestrator';
import { buildFeedbackSummary, buildRefinementDeltas } from '@/lib/agents/refine-utils';
import type {
  ConversationMessage,
  ExecutionPlanOutput,
  FeedbackAppliedCounts,
  OrchestratorOutput,
} from '@/lib/agents/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface RefineBody {
  sessionId: string;
  messageId: string;
  focus?: string;
}

interface StoredOrchestratorOutput extends OrchestratorOutput {}

export async function POST(req: NextRequest) {
  let body: RefineBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.sessionId || !body.messageId) {
    return NextResponse.json({ ok: false, error: 'sessionId and messageId are required' }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 });
  }

  const { rows: msgRows } = await query<{
    id: string;
    content: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }>(
    `SELECT m.id, m.content, m.metadata, m.created_at
     FROM chat_messages m
     JOIN chat_sessions s ON s.id = m.session_id
     WHERE m.id = $1 AND m.session_id = $2 AND s.user_id = $3
     LIMIT 1`,
    [body.messageId, body.sessionId, user.id],
  );

  const msgRow = msgRows[0];
  if (!msgRow) {
    return NextResponse.json(
      { ok: false, error: 'Saved message not found for this session (it may not have been persisted yet). Wait for the run to save, or send a new query.' },
      { status: 404 },
    );
  }

  const metadata = (msgRow.metadata as Record<string, unknown>) ?? {};
  const orchestratorOutput = metadata.orchestratorOutput as StoredOrchestratorOutput | undefined;

  if (!orchestratorOutput?.outputs?.length) {
    return NextResponse.json(
      {
        ok: false,
        error: 'This message has no saved research outputs. Run a full intelligence query first, then use Refine.',
      },
      { status: 400 },
    );
  }

  const [feedbackRes, actionsRes, resultsRes] = await Promise.all([
    query(
      `SELECT * FROM recommendation_feedback WHERE session_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [body.sessionId],
    ),
    query(
      `SELECT * FROM recommendation_actions WHERE session_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [body.sessionId],
    ),
    query(
      `SELECT * FROM variant_results WHERE session_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [body.sessionId],
    ),
  ]);

  const feedbackSummary = buildFeedbackSummary(
    feedbackRes.rows ?? [],
    actionsRes.rows ?? [],
    resultsRes.rows ?? [],
    body.focus,
  );

  const feedbackApplied: FeedbackAppliedCounts = {
    recommendationFeedback: feedbackRes.rows?.length ?? 0,
    recommendationActions: actionsRes.rows?.length ?? 0,
    variantResults: resultsRes.rows?.length ?? 0,
  };

  const { rows: historyRows } = await query<{ role: 'user' | 'assistant'; content: string; created_at: string }>(
    `SELECT role, content, created_at
     FROM chat_messages
     WHERE session_id = $1 AND created_at <= $2::timestamptz
     ORDER BY created_at ASC
     LIMIT 80`,
    [body.sessionId, msgRow.created_at],
  );

  const history: ConversationMessage[] = historyRows.map((row) => ({
    role: row.role,
    content: row.content,
    timestamp: row.created_at,
  }));

  const refinedQuery = body.focus || orchestratorOutput.query;

  let refinedOutput: OrchestratorOutput;
  try {
    refinedOutput = await orchestrate(
      refinedQuery,
      history,
      undefined,
      [],
      undefined,
      {
        injectedContext: feedbackSummary,
        forceExecution: true,
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'refine orchestration error';
    return NextResponse.json(
      { ok: false, error: `Re-orchestration failed: ${msg}` },
      { status: 500 },
    );
  }

  const deltas = buildRefinementDeltas(orchestratorOutput.outputs ?? [], refinedOutput.outputs ?? []);

  const deltaLines = deltas.slice(0, 3).map(d => `- ${d.summary}`);
  const synthesizedAnswer = deltaLines.length > 0
    ? `${refinedOutput.synthesizedAnswer}\n\nFeedback-driven updates:\n${deltaLines.join('\n')}`
    : refinedOutput.synthesizedAnswer;

  const enrichedOutput: OrchestratorOutput = {
    ...refinedOutput,
    synthesizedAnswer,
    refinement: {
      refinedFromMessageId: body.messageId,
      focus: body.focus,
      feedbackApplied,
      deltas,
      feedbackSummary,
    },
  };

  const newPlan = enrichedOutput.outputs.find(o => o.artifactType === 'execution-plan') as ExecutionPlanOutput | undefined;
  if (!newPlan) {
    const execRun = refinedOutput.agentRuns.find(r => r.agentId === 'execution-engine');
    const why =
      execRun?.status === 'failed' && execRun.error
        ? `Execution step failed: ${execRun.error}`
        : 'The refined run completed without an execution-plan artifact (execution may have been skipped or errored).';
    return NextResponse.json({ ok: false, error: why }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    executionPlan: newPlan,
    orchestratorOutput: enrichedOutput,
    feedbackApplied,
    changes: deltas,
  });
}
