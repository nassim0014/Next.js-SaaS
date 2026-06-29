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

type ProviderFactory = () => LanguageModelV1 | null;

const PROVIDERS: Record<ProviderName, ProviderFactory> = {
  google: () => {
    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!key) return null;
    const google = createGoogleGenerativeAI({ apiKey: key });
    return google("gemini-2.0-flash"); // Default free model
  },
  openai: () => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return null;
    const openai = createOpenAI({ apiKey: key });
    return openai("gpt-4o");
  },
  anthropic: () => {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return null;
    const anthropic = createAnthropic({ apiKey: key });
    return anthropic("claude-3-5-sonnet-latest");
  },
  groq: () => {
    // Groq is OpenAI-compatible — use createOpenAI with Groq's base URL
    const key = process.env.GROQ_API_KEY;
    if (!key) return null;
    const groq = createOpenAI({
      apiKey: key,
      baseURL: "https://api.groq.com/openai/v1",
    });
    return groq("llama-3.3-70b-versatile");
  },
};

/**
 * Resolve a provider + model name to a LanguageModelV1 instance.
 * Returns null if the provider has no API key configured.
 */
export function resolveModel(
  provider: ProviderName,
  _modelName?: string
): LanguageModelV1 | null {
  const factory = PROVIDERS[provider];
  if (!factory) return null;
  return factory();
}

/**
 * Get the list of currently-available providers (those with API keys set).
 */
export function getAvailableProviders(): ProviderName[] {
  return (Object.keys(PROVIDERS) as ProviderName[]).filter((p) => PROVIDERS[p]() !== null);
}

/**
 * Default provider — Google Gemini (free) → Groq (free) → OpenAI → Anthropic.
 * Returns the first available provider in priority order.
 */
export function getDefaultProvider(): ProviderName | null {
  const priority: ProviderName[] = ["google", "groq", "openai", "anthropic"];
  return priority.find((p) => PROVIDERS[p]() !== null) ?? null;
}
