-- Local PostgreSQL schema for Veracity Growth Intelligence Assistant
-- Apply with: psql -U postgres -d veracity -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Users (replaces Supabase auth.users) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text,
  google_id     text UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Signal cache ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signal_cache (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key  text NOT NULL,
  tool       text NOT NULL,
  result     jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cache_key, tool)
);

CREATE INDEX IF NOT EXISTS signal_cache_lookup
  ON signal_cache (cache_key, tool, created_at DESC);

-- ── Legacy conversations blob ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE,
  messages   jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Chat sessions / messages ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      text NOT NULL DEFAULT 'New Query',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user', 'assistant')),
  content    text NOT NULL,
  metadata   jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS chat_sessions_updated_at_idx ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx ON chat_messages(session_id);

-- ── User memory ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_memory (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  role        text,
  company     text,
  products    text[] NOT NULL DEFAULT '{}',
  competitors text[] NOT NULL DEFAULT '{}',
  interests   text[] NOT NULL DEFAULT '{}',
  facts       jsonb NOT NULL DEFAULT '[]',
  raw_summary text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Embeddings (pgvector) ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS chat_embeddings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_id uuid REFERENCES chat_messages(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user', 'assistant')),
  content    text NOT NULL,
  embedding  vector(768) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_embeddings_session_id_idx ON chat_embeddings(session_id);
CREATE INDEX IF NOT EXISTS chat_embeddings_embedding_hnsw_idx
  ON chat_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- ── Feedback loop ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id         uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_id         uuid REFERENCES chat_messages(id) ON DELETE CASCADE,
  recommendation_key text NOT NULL,
  title              text NOT NULL,
  rating             text NOT NULL CHECK (rating IN ('up', 'down', 'neutral')),
  note               text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recommendation_actions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id         uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_id         uuid REFERENCES chat_messages(id) ON DELETE CASCADE,
  recommendation_key text NOT NULL,
  title              text NOT NULL,
  action             text NOT NULL CHECK (action IN ('accepted', 'rejected', 'refined', 'copied')),
  metadata           jsonb NOT NULL DEFAULT '{}',
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS variant_results (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id           uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_id           uuid REFERENCES chat_messages(id) ON DELETE CASCADE,
  variant_id           text NOT NULL,
  variant_angle        text,
  hypothesis           text,
  success_metric       text,
  sent_count           integer,
  open_rate            numeric(5, 2),
  reply_rate           numeric(5, 2),
  click_rate           numeric(5, 2),
  meetings_booked      integer,
  hypothesis_confirmed text CHECK (hypothesis_confirmed IN ('yes', 'no', 'unclear')),
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recommendation_feedback_session_idx ON recommendation_feedback(session_id);
CREATE INDEX IF NOT EXISTS recommendation_actions_session_idx ON recommendation_actions(session_id);
CREATE INDEX IF NOT EXISTS variant_results_session_idx ON variant_results(session_id);
