-- TASK-2.2 follow-up: upgrade ivfflat → HNSW for chat_embeddings
-- Run after 002_chat_embeddings.sql when upgrading an existing project.

create extension if not exists vector;

drop index if exists chat_embeddings_embedding_idx;

create index if not exists chat_embeddings_embedding_hnsw_idx
  on chat_embeddings
  using hnsw (embedding vector_cosine_ops);

create or replace function match_chat_embeddings(
  p_session_id uuid,
  p_query_embedding vector(768),
  p_match_count int default 5
)
returns table (
  id uuid,
  message_id uuid,
  role text,
  content text,
  similarity float,
  created_at timestamptz
)
language sql stable
as $$
  select
    e.id,
    e.message_id,
    e.role,
    e.content,
    1 - (e.embedding <=> p_query_embedding) as similarity,
    e.created_at
  from chat_embeddings e
  where e.session_id = p_session_id
  order by e.embedding <=> p_query_embedding
  limit p_match_count;
$$;
