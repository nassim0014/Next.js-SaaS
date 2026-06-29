/**
 * Available LLM models + their pricing.
 *
 * This is mirrored in the Prisma `ModelConfig` table (seeded by `prisma/seed.ts`).
 * Update BOTH this file and the seed when adding models.
 *
 * Pricing as of 2026-01. Verify on provider docs before going to production.
 */

export type ModelDefinition = {
  provider: "google" | "openai" | "anthropic" | "groq";
  modelName: string;
  displayName: string;
  contextWindow: number;
  inputCostPer1K: number; // USD
  outputCostPer1K: number; // USD
  capabilities: string[];
  isFreeTier?: boolean; // True if available on a free tier
};

export const AVAILABLE_MODELS: ModelDefinition[] = [
  // ── Free tier ⭐ ──────────────────────────────────────────────
  {
    provider: "google",
    modelName: "gemini-2.0-flash",
    displayName: "Gemini 2.0 Flash",
    contextWindow: 1_048_576,
    inputCostPer1K: 0,
    outputCostPer1K: 0,
    capabilities: ["chat", "vision", "json", "tools"],
    isFreeTier: true,
  },
  {
    provider: "groq",
    modelName: "llama-3.3-70b-versatile",
    displayName: "Llama 3.3 70B (Groq)",
    contextWindow: 128_000,
    inputCostPer1K: 0.00059,
    outputCostPer1K: 0.00079,
    capabilities: ["chat", "json", "tools"],
    isFreeTier: true,
  },
  // ── Paid (OpenAI) ─────────────────────────────────────────────
  {
    provider: "openai",
    modelName: "gpt-4o",
    displayName: "GPT-4o",
    contextWindow: 128_000,
    inputCostPer1K: 0.0025,
    outputCostPer1K: 0.01,
    capabilities: ["chat", "vision", "json", "tools", "audio"],
  },
  {
    provider: "openai",
    modelName: "gpt-4o-mini",
    displayName: "GPT-4o mini",
    contextWindow: 128_000,
    inputCostPer1K: 0.00015,
    outputCostPer1K: 0.0006,
    capabilities: ["chat", "vision", "json", "tools"],
  },
  // ── Paid (Anthropic) ──────────────────────────────────────────
  {
    provider: "anthropic",
    modelName: "claude-3-5-sonnet-latest",
    displayName: "Claude 3.5 Sonnet",
    contextWindow: 200_000,
    inputCostPer1K: 0.003,
    outputCostPer1K: 0.015,
    capabilities: ["chat", "vision", "json", "tools"],
  },
  {
    provider: "anthropic",
    modelName: "claude-3-5-haiku-latest",
    displayName: "Claude 3.5 Haiku",
    contextWindow: 200_000,
    inputCostPer1K: 0.0008,
    outputCostPer1K: 0.004,
    capabilities: ["chat", "json", "tools"],
  },
];

/**
 * Get the list of models that are currently usable (API key configured).
 */
export function getAvailableModelDefinitions(): ModelDefinition[] {
  return AVAILABLE_MODELS.filter((m) => {
    if (m.provider === "google") return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (m.provider === "openai") return !!process.env.OPENAI_API_KEY;
    if (m.provider === "anthropic") return !!process.env.ANTHROPIC_API_KEY;
    if (m.provider === "groq") return !!process.env.GROQ_API_KEY;
    return false;
  });
}
