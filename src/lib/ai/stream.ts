import { streamText, type ModelMessage } from "ai";
import { prisma } from "@/lib/prisma";
import { resolveModel, type ProviderName } from "./llm";
import { recordTokenUsage, checkBudget } from "./cost";

export type StreamChatOptions = {
  organizationId: string;
  userId: string;
  conversationId: string;
  provider: ProviderName;
  modelName: string;
  messages: ModelMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  modelConfigId: string;
};

/**
 * Stream a chat completion through the Vercel AI SDK, while:
 *   1. Enforcing per-org token budget (throws if exceeded)
 *   2. Metering token usage on completion (writes TokenUsage row)
 *   3. Updating Conversation.tokenCount + estimatedCostUsd
 *
 * This is the ONLY entry point for LLM calls in the app.
 * Never call provider SDKs directly — you'll bypass cost tracking.
 */
export async function streamChat(options: StreamChatOptions) {
  const model = resolveModel(options.provider, options.modelName);
  if (!model) {
    throw new Error(`Provider ${options.provider} not configured. Set the API key in .env.local`);
  }

  // 1. Budget check — throws if org is over quota
  await checkBudget(options.organizationId);

  // 2. Stream the response
  const result = streamText({
    model,
    messages: options.messages,
    system: options.systemPrompt,
    temperature: options.temperature ?? 0.7,
    maxOutputTokens: options.maxTokens ?? 4096,
  });

  // 3. Meter usage on completion (fire-and-forget — don't block the stream)
  // `result.usage` is a `PromiseLike`, not a real `Promise` (no `.catch`),
  // so route it through `Promise.resolve` first to get one back.
  Promise.resolve(result.usage)
    .then(async (usage) => {
      if (!usage) return;

      const modelConfig = await prisma.modelConfig.findUnique({
        where: { id: options.modelConfigId },
      });
      if (!modelConfig) return;

      const inputTokens = usage.inputTokens ?? 0;
      const outputTokens = usage.outputTokens ?? 0;
      const cachedTokens = usage.inputTokenDetails.cacheReadTokens ?? 0;

      const costUsd =
        (inputTokens / 1000) * modelConfig.inputCostPer1K +
        (outputTokens / 1000) * modelConfig.outputCostPer1K +
        cachedTokens * 0; // Cached tokens are usually free

      await recordTokenUsage({
        organizationId: options.organizationId,
        userId: options.userId,
        conversationId: options.conversationId,
        modelConfigId: options.modelConfigId,
        inputTokens,
        outputTokens,
        cachedTokens,
        costUsd,
      });

      // Update conversation cost
      await prisma.conversation.update({
        where: { id: options.conversationId },
        data: {
          tokenCount: { increment: inputTokens + outputTokens },
          estimatedCostUsd: { increment: costUsd },
          updatedAt: new Date(),
        },
      });
    })
    .catch((err) => {
      // Don't crash the stream — log and continue
      console.error("Failed to meter token usage:", err);
    });

  return result;
}
