-- TASK-2.2: Native pgvector for chat_embeddings
-- Enables <=> cosine distance in PostgreSQL and HNSW index for recall.

CREATE EXTENSION IF NOT EXISTS vector;

-- Convert jsonb embedding arrays → vector(768) when needed.
-- Note: ALTER ... USING cannot contain a subquery; jsonb array text casts to vector.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'chat_embeddings'
      AND column_name = 'embedding'
      AND data_type = 'jsonb'
  ) THEN
    ALTER TABLE chat_embeddings
      ALTER COLUMN embedding TYPE vector(768)
      USING (embedding::text::vector(768));
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'chat_embeddings'
      AND column_name = 'embedding'
  ) THEN
    -- Already a vector (or other) column — ensure type is vector(768).
    BEGIN
      ALTER TABLE chat_embeddings
        ALTER COLUMN embedding TYPE vector(768)
        USING embedding::vector(768);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'chat_embeddings.embedding already compatible: %', SQLERRM;
    END;
  END IF;
END $$;

-- Prefer HNSW for low-latency cosine search (plan target).
DROP INDEX IF EXISTS chat_embeddings_embedding_idx;
CREATE INDEX IF NOT EXISTS chat_embeddings_embedding_hnsw_idx
  ON chat_embeddings
  USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION match_chat_embeddings(
  p_session_id uuid,
  p_query_embedding vector(768),
  p_match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  message_id uuid,
  role text,
  content text,
  similarity float,
  created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    e.id,
    e.message_id,
    e.role,
    e.content,
    1 - (e.embedding <=> p_query_embedding) AS similarity,
    e.created_at
  FROM chat_embeddings e
  WHERE e.session_id = p_session_id
  ORDER BY e.embedding <=> p_query_embedding
  LIMIT p_match_count;
$$;
