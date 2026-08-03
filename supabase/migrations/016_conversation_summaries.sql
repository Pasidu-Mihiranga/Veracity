-- Rolling conversation summaries.
--
-- `partitionTurns` already decides which turns stay verbatim and which should
-- fold into a summary, and `buildTurnContext` already accepts a summary. But
-- nothing generated or stored one, so the older half of a long conversation was
-- simply dropped: a project with sixty turns behaved as though it had ten.
--
-- One row per session, replaced as the conversation grows. History of the
-- summary itself is not kept — the transcript is the history, and versioning a
-- derived artefact would mean storing many near-identical paragraphs to answer
-- a question nobody asks.

CREATE TABLE IF NOT EXISTS conversation_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,

  -- The last message folded in. Everything after it is still shown verbatim, so
  -- this is what stops a turn being summarised and repeated at the same time.
  through_message_id uuid REFERENCES chat_messages(id) ON DELETE SET NULL,
  -- How many turns this covers. Used to decide when regenerating is worthwhile
  -- rather than re-summarising on every single message.
  turns_covered integer NOT NULL DEFAULT 0,

  summary text NOT NULL,
  open_questions text[] NOT NULL DEFAULT '{}',
  assumptions text[] NOT NULL DEFAULT '{}',

  -- Claim and evidence ids the summary refers to, preserved verbatim. A
  -- summarised claim that loses its ids becomes an unsourced assertion, which
  -- is exactly what the ledger exists to prevent.
  cited_ids text[] NOT NULL DEFAULT '{}',

  -- Which assembly rules produced this. If the context contract changes, an old
  -- summary can be identified and regenerated rather than silently mixed with
  -- text built under different rules.
  context_version text NOT NULL DEFAULT 'ctx-v1',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT conversation_summaries_body_present
    CHECK (length(trim(summary)) > 0)
);

-- One summary per session. The upsert path depends on this.
CREATE UNIQUE INDEX IF NOT EXISTS conversation_summaries_session_idx
  ON conversation_summaries(session_id);

CREATE INDEX IF NOT EXISTS conversation_summaries_user_idx
  ON conversation_summaries(user_id, updated_at DESC);
