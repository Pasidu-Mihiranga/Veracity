-- Evidence ledger.
--
-- Everything the product claims must be traceable to something a collector
-- actually retrieved. Before this migration the chain stopped at a source URL:
-- `source_snapshots` recorded that a page was fetched and hashed, but nothing
-- recorded *which words* supported a claim, and no numeric value in any chart
-- had an origin outside model output.
--
-- The five tables below close that gap:
--
--   evidence_spans      exact excerpt + offsets inside a snapshot
--   metric_observations a number, its unit, its period, and the span proving it
--   change_events       normalized before/after between two snapshots
--   claims              a statement bound to supporting and contradicting spans
--   chart_specs         a validated, reproducible chart definition
--
-- Rule enforced by the schema: a metric observation cannot exist without an
-- evidence span, and an evidence span cannot exist without a snapshot. That is
-- what makes "reproduce this number from its sources" a query rather than a
-- hope.

-- ── Evidence spans ──────────────────────────────────────────────────────────
-- An exact excerpt inside a stored snapshot. Offsets are into the snapshot's
-- normalized content so the excerpt can be re-located and re-verified later.

CREATE TABLE IF NOT EXISTS evidence_spans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES source_snapshots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  project_id uuid REFERENCES market_projects(id) ON DELETE SET NULL,

  -- The verbatim text. Never paraphrased — this is what the user is shown when
  -- they ask "prove it".
  excerpt text NOT NULL,
  start_offset integer,
  end_offset integer,

  -- What kind of extraction produced this span: 'price', 'feature', 'release',
  -- 'positioning', 'quote', 'metric', 'other'.
  extraction_type text NOT NULL DEFAULT 'other',

  -- Whether the span was confirmed to describe the intended entity, so an
  -- excerpt about a similarly-named company cannot silently support a claim.
  entity_match text NOT NULL DEFAULT 'unverified'
    CHECK (entity_match IN ('confirmed', 'probable', 'unverified', 'mismatch')),

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT evidence_spans_offsets_ordered
    CHECK (start_offset IS NULL OR end_offset IS NULL OR end_offset >= start_offset),
  CONSTRAINT evidence_spans_excerpt_present
    CHECK (length(trim(excerpt)) > 0)
);

CREATE INDEX IF NOT EXISTS evidence_spans_snapshot_idx ON evidence_spans(snapshot_id);
CREATE INDEX IF NOT EXISTS evidence_spans_project_idx ON evidence_spans(project_id, created_at DESC);

-- ── Metric observations ─────────────────────────────────────────────────────
-- One measured value. The NOT NULL foreign key to evidence_spans is the whole
-- point: a number with no excerpt behind it cannot be stored at all.

CREATE TABLE IF NOT EXISTS metric_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES market_projects(id) ON DELETE SET NULL,
  entity_id uuid REFERENCES canonical_entities(id) ON DELETE SET NULL,

  evidence_span_id uuid NOT NULL REFERENCES evidence_spans(id) ON DELETE CASCADE,

  -- Stable identifier, e.g. 'plan_price', 'release_count', 'headcount'.
  metric_key text NOT NULL,
  value numeric NOT NULL,
  unit text NOT NULL,

  -- The interval the value describes, not when it was collected.
  period_start timestamptz,
  period_end timestamptz,

  -- How the value was obtained: 'extracted' (read from the page), 'counted'
  -- (computed from records), 'reported' (stated by the source).
  method text NOT NULL DEFAULT 'extracted',

  -- True when the source itself presents the figure as approximate. Estimated
  -- values must be visibly labelled and never presented as measured.
  is_estimated boolean NOT NULL DEFAULT false,

  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT metric_observations_period_ordered
    CHECK (period_start IS NULL OR period_end IS NULL OR period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS metric_observations_series_idx
  ON metric_observations(project_id, metric_key, period_start);
CREATE INDEX IF NOT EXISTS metric_observations_entity_idx
  ON metric_observations(entity_id, metric_key, observed_at DESC);

-- ── Change events ───────────────────────────────────────────────────────────
-- A normalized difference between two snapshots of the same source.
--
-- Distinct from `project_research_events`, which records source *coverage*
-- changes (a source appeared or stopped responding). These record that the
-- world changed: a price moved, a feature shipped, positioning was rewritten.

CREATE TABLE IF NOT EXISTS change_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES market_projects(id) ON DELETE SET NULL,
  entity_id uuid REFERENCES canonical_entities(id) ON DELETE SET NULL,

  event_type text NOT NULL CHECK (event_type IN (
    'pricing_changed',
    'feature_launched',
    'feature_removed',
    'positioning_changed',
    'segment_changed',
    'integration_announced',
    'hiring_signal',
    'funding_or_filing',
    'review_theme',
    'documentation_changed'
  )),

  before_value text,
  after_value text,

  -- When the change happened in the world, versus when we noticed it. They are
  -- different, and conflating them makes a timeline wrong.
  effective_at timestamptz,
  observed_at timestamptz NOT NULL DEFAULT now(),

  from_snapshot_id uuid REFERENCES source_snapshots(id) ON DELETE SET NULL,
  to_snapshot_id uuid REFERENCES source_snapshots(id) ON DELETE SET NULL,
  evidence_span_id uuid REFERENCES evidence_spans(id) ON DELETE SET NULL,

  -- Deterministic score, explained in a human-readable string. Explicitly not
  -- model confidence: materiality answers "does this matter to this project's
  -- current decision", which a model score does not.
  materiality numeric NOT NULL DEFAULT 0
    CHECK (materiality >= 0 AND materiality <= 1),
  materiality_reason text NOT NULL DEFAULT '',

  confidence text NOT NULL DEFAULT 'low'
    CHECK (confidence IN ('high', 'medium', 'low')),

  -- Stable hash of (entity, type, normalized before/after). The unique index
  -- below is what keeps a re-run from reporting the same change twice.
  dedupe_key text NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS change_events_dedupe_idx
  ON change_events(project_id, dedupe_key);
CREATE INDEX IF NOT EXISTS change_events_timeline_idx
  ON change_events(project_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS change_events_material_idx
  ON change_events(project_id, materiality DESC, observed_at DESC);

-- ── Claims ──────────────────────────────────────────────────────────────────
-- A statement the product makes, with its supporting and contradicting spans
-- held separately. Contradiction is first-class: when sources disagree the
-- brief must show both and lower certainty rather than silently picking one.

CREATE TABLE IF NOT EXISTS claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES market_projects(id) ON DELETE SET NULL,
  session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE,

  statement text NOT NULL,

  -- 'fact' must be supported by evidence. 'interpretation' is analyst
  -- synthesis. 'assumption' is explicitly unproven. Keeping them in one table
  -- with a discriminator stops interpretation from drifting into the fact list.
  claim_type text NOT NULL DEFAULT 'fact'
    CHECK (claim_type IN ('fact', 'interpretation', 'assumption')),

  confidence text NOT NULL DEFAULT 'low'
    CHECK (confidence IN ('high', 'medium', 'low')),

  supporting_span_ids uuid[] NOT NULL DEFAULT '{}',
  contradicting_span_ids uuid[] NOT NULL DEFAULT '{}',

  -- Oldest supporting evidence, so a stale claim can be surfaced as stale.
  freshest_evidence_at timestamptz,

  agent_id text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT claims_statement_present CHECK (length(trim(statement)) > 0)
);

CREATE INDEX IF NOT EXISTS claims_project_idx ON claims(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS claims_session_idx ON claims(session_id, created_at DESC);

-- ── Chart specs ─────────────────────────────────────────────────────────────
-- A rendered chart, stored as a validated spec rather than as loose component
-- props, so the exact rows and methodology behind a picture remain reproducible
-- after the fact.

CREATE TABLE IF NOT EXISTS chart_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES market_projects(id) ON DELETE SET NULL,
  session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE,

  -- Validated against the Zod ChartSpec schema in lib/intelligence/types.ts
  -- before it is written. The application, not the database, owns that shape.
  spec jsonb NOT NULL,

  -- Duplicated out of the JSON so charts can be filtered by trust class
  -- without deserialising every row.
  data_class text NOT NULL
    CHECK (data_class IN ('measured', 'derived', 'synthetic')),

  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chart_specs_project_idx ON chart_specs(project_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS chart_specs_session_idx ON chart_specs(session_id, generated_at DESC);

-- ── Snapshot content ────────────────────────────────────────────────────────
-- Evidence spans carry offsets into normalized content, so the content has to
-- be retained rather than discarded after extraction.

ALTER TABLE source_snapshots
  ADD COLUMN IF NOT EXISTS normalized_content text;

ALTER TABLE source_snapshots
  ADD COLUMN IF NOT EXISTS retrieval_status text NOT NULL DEFAULT 'ok';

ALTER TABLE source_snapshots
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES market_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS source_snapshots_project_idx
  ON source_snapshots(project_id, observed_at DESC);
