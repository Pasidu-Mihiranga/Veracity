-- Phase 5: material watchlist events, cadence controls, and alert egress.

ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS cadence text NOT NULL DEFAULT 'weekly';
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS max_competitors integer NOT NULL DEFAULT 6;
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS weekly_alert_budget integer NOT NULL DEFAULT 12;
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS alert_channels text[] NOT NULL DEFAULT ARRAY['in_app']::text[];
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS last_sweep_summary jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE watchlists DROP CONSTRAINT IF EXISTS watchlists_cadence_check;
ALTER TABLE watchlists ADD CONSTRAINT watchlists_cadence_check
  CHECK (cadence IN ('daily', 'twice_weekly', 'weekly', 'monthly'));
ALTER TABLE watchlists DROP CONSTRAINT IF EXISTS watchlists_max_competitors_check;
ALTER TABLE watchlists ADD CONSTRAINT watchlists_max_competitors_check
  CHECK (max_competitors BETWEEN 1 AND 12);
ALTER TABLE watchlists DROP CONSTRAINT IF EXISTS watchlists_weekly_alert_budget_check;
ALTER TABLE watchlists ADD CONSTRAINT watchlists_weekly_alert_budget_check
  CHECK (weekly_alert_budget BETWEEN 1 AND 50);

ALTER TABLE competitive_events DROP CONSTRAINT IF EXISTS competitive_events_category_check;
ALTER TABLE competitive_events ADD CONSTRAINT competitive_events_category_check
  CHECK (category IN (
    'pricing', 'launch', 'feature', 'hiring', 'leadership', 'security',
    'docs', 'sentiment', 'funding', 'acquisition', 'news', 'other'
  ));
ALTER TABLE competitive_events ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'low';
ALTER TABLE competitive_events ADD COLUMN IF NOT EXISTS materiality_score real NOT NULL DEFAULT 0;
ALTER TABLE competitive_events DROP CONSTRAINT IF EXISTS competitive_events_severity_check;
ALTER TABLE competitive_events ADD CONSTRAINT competitive_events_severity_check
  CHECK (severity IN ('high', 'medium', 'low'));
ALTER TABLE competitive_events DROP CONSTRAINT IF EXISTS competitive_events_materiality_check;
ALTER TABLE competitive_events ADD CONSTRAINT competitive_events_materiality_check
  CHECK (materiality_score BETWEEN 0 AND 1);

CREATE TABLE IF NOT EXISTS alert_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alert_id uuid NOT NULL REFERENCES alert_events(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'slack')),
  status text NOT NULL CHECK (status IN ('sent', 'skipped', 'failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alert_id, channel)
);

CREATE INDEX IF NOT EXISTS alert_deliveries_user_created_idx
  ON alert_deliveries(user_id, created_at DESC);

