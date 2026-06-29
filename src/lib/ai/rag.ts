import { prisma } from "@/lib/prisma";
import { generateEmbeddings } from "./embeddings";

/**
 * RAG retrieval — find the most relevant chunks from a KnowledgeBase
 * for a given query, using pgvector cosine similarity.
 *
 * Pipeline: query → embed → pgvector search → return top-k chunks.
 */

export type RetrievedChunk = {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  similarity: number;
  metadata: Record<string, unknown> | null;
};

/**
 * Retrieve the top-k most similar chunks from a KnowledgeBase.
 *
 * @param knowledgeBaseId  The KB to search
 * @param query            The user's query
 * @param topK             Number of chunks to return (default: 5)
 * @param minSimilarity    Cosine similarity threshold (default: 0.7)
 */
export async function retrieveRelevantChunks(
  knowledgeBaseId: string,
  query: string,
  topK = 5,
  minSimilarity = 0.7
): Promise<RetrievedChunk[]> {
  const [queryEmbedding] = await generateEmbeddings([query]);

  // pgvector cosine similarity: `<=>` operator (smaller = more similar)
  const results = await prisma.$queryRaw<RetrievedChunk[]>`
    SELECT
      e.id,
      e.document_id AS "documentId",
      e.content,
      e.chunk_index AS "chunkIndex",
      e.metadata,
      1 - (e.embedding <=> ${queryEmbedding}::vector) AS similarity
    FROM embeddings e
    JOIN documents d ON d.id = e.document_id
    WHERE d.knowledge_base_id = ${knowledgeBaseId}
      AND d.status = 'READY'
      AND 1 - (e.embedding <=> ${queryEmbedding}::vector) > ${minSimilarity}
    ORDER BY e.embedding <=> ${queryEmbedding}::vector
    LIMIT ${topK};
  `;

  return results;
}

/**
 * Build a context string from retrieved chunks, formatted for the LLM.
 *
 * @example
 *   const chunks = await retrieveRelevantChunks(kbId, userQuery);
 *   const context = formatContextForPrompt(chunks);
 *   const prompt = `Context:\n${context}\n\nQuestion: ${userQuery}`;
 */
export function formatContextForPrompt(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "No relevant context found.";
  return chunks
    .map((chunk, i) => `--- Source ${i + 1} (similarity: ${chunk.similarity.toFixed(2)}) ---\n${chunk.content}`)
    .join("\n\n");
}

/**
 * Chunk a long document into ~500-token pieces for embedding.
 * Simple character-based chunking with overlap. For production, consider
 * recursive text splitters or layout-aware chunking (e.g., unstructured.io).
 */
export function chunkDocument(text: string, chunkSize = 2000, overlap = 200): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    chunks.push(text.slice(i, end));
    i += chunkSize - overlap;
  }
  return chunks;
}
