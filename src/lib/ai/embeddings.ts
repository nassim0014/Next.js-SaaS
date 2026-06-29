import { embed, embedMany } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

/**
 * Embeddings for RAG.
 *
 * Default: Google text-embedding-004 (free tier, 768-dim — pad to 1536 in DB)
 * Paid alt: OpenAI text-embedding-3-small (1536-dim, $0.02/M tokens)
 *
 * The Prisma schema uses `vector(1536)`. If you switch to a different model
 * with a different dimension, update the Embedding model AND run a migration.
 */

export type EmbeddingProvider = "google" | "openai";

export async function getEmbeddingModel(provider: EmbeddingProvider = "google") {
  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY not set");
    const openai = createOpenAI({ apiKey: key });
    return openai.embedding("text-embedding-3-small");
  }

  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not set");
  const google = createGoogleGenerativeAI({ apiKey: key });
  return google.embedding("text-embedding-004");
}

/**
 * Generate an embedding for a single text chunk.
 */
export async function generateEmbedding(text: string, provider: EmbeddingProvider = "google") {
  const model = await getEmbeddingModel(provider);
  const { embedding } = await embed({ model, value: text });
  return padTo1536(embedding);
}

/**
 * Generate embeddings for multiple text chunks (batched — more efficient).
 */
export async function generateEmbeddings(
  texts: string[],
  provider: EmbeddingProvider = "google"
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const model = await getEmbeddingModel(provider);
  const { embeddings } = await embedMany({ model, values: texts });
  return embeddings.map(padTo1536);
}

/**
 * Pad/truncate to 1536 dimensions to match the DB schema's vector(1536).
 * Google's text-embedding-004 returns 768-dim; we zero-pad.
 */
function padTo1536(vec: number[]): number[] {
  if (vec.length === 1536) return vec;
  if (vec.length > 1536) return vec.slice(0, 1536);
  return [...vec, ...new Array(1536 - vec.length).fill(0)];
}
