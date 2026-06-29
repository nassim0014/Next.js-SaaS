-- ─────────────────────────────────────────────────────────────────────────────
-- 0004_vector_index.sql
--
-- HNSW index on the embeddings table for fast cosine similarity search.
-- HNSW is faster than IVFFlat for most use cases and requires no training.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS embeddings_hnsw_idx
  ON embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Also index the document_id FK for fast joins
CREATE INDEX IF NOT EXISTS embeddings_document_id_idx
  ON embeddings (document_id);
