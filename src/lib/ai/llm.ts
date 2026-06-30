import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModelV1 } from "ai";

export type ProviderName = "google" | "openai" | "anthropic" | "groq";

/**
 * ⭐ Free-tier-first provider registry.
 *
 * Default provider: Google Gemini (free tier — 15 RPM, 1500 req/day)
 * Fallback:        Groq (free tier — 30 RPM, 1000 req/day)
 *
 * To use paid providers (OpenAI, Anthropic), set the corresponding API key
 * in .env.local. The registry will pick up paid models automatically.
 *
 * Add new ModelConfig rows in `prisma/seed.ts` to expose them in the UI.
 */

/** Map provider name → environment variable that holds the API key. */
const PROVIDER_ENV_KEYS: Record<ProviderName, string> = {
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  groq: "GROQ_API_KEY",
};

/** Default model per provider (used when modelName is not specified). */
const DEFAULT_MODELS: Record<ProviderName, string> = {
  google: "gemini-2.0-flash",
  openai: "gpt-4o",
  anthropic: "claude-3-5-sonnet-latest",
  groq: "llama-3.3-70b-versatile",
};

/**
 * Resolve a provider + model name to a LanguageModelV1 instance.
 * Returns null if the provider has no API key configured.
 *
 * @param provider — one of "google" | "openai" | "anthropic" | "groq"
 * @param modelName — optional model name override (e.g. "gpt-4o-mini").
 *   If not provided, uses the provider's default model.
 */
export function resolveModel(
  provider: ProviderName,
  modelName?: string
): LanguageModelV1 | null {
  const key = process.env[PROVIDER_ENV_KEYS[provider]];
  if (!key) return null;

  switch (provider) {
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey: key });
      return google(modelName ?? "gemini-2.0-flash");
    }
    case "openai": {
      const openai = createOpenAI({ apiKey: key });
      return openai(modelName ?? "gpt-4o");
    }
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey: key });
      return anthropic(modelName ?? "claude-3-5-sonnet-latest");
    }
    case "groq": {
      const groq = createOpenAI({
        apiKey: key,
        baseURL: "https://api.groq.com/openai/v1",
      });
      return groq(modelName ?? "llama-3.3-70b-versatile");
    }
    default:
      return null;
  }
}

/**
 * Get the list of currently-available providers (those with API keys set).
 */
export function getAvailableProviders(): ProviderName[] {
  return (Object.keys(PROVIDER_ENV_KEYS) as ProviderName[]).filter(
    (p) => process.env[PROVIDER_ENV_KEYS[p]] !== undefined
  );
}

/**
 * Default provider — Google Gemini (free) → Groq (free) → OpenAI → Anthropic.
 * Returns the first available provider in priority order.
 */
export function getDefaultProvider(): ProviderName | null {
  const priority: ProviderName[] = ["google", "groq", "openai", "anthropic"];
  return priority.find((p) => process.env[PROVIDER_ENV_KEYS[p]] !== undefined) ?? null;
}
