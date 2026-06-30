import { NextRequest, NextResponse } from "next/server";
import { streamText, type CoreMessage } from "ai";
import { requireUser } from "@/lib/auth/session";
import { getActiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/prisma";
import { resolveModel } from "@/lib/ai/llm";
import { checkBudget, recordTokenUsage } from "@/lib/ai/cost";
import { audit } from "@/lib/audit/logger";
import { AppError, toAppError } from "@/lib/errors";
import { z } from "zod";

/**
 * Chat API — streaming endpoint compatible with @ai-sdk/react useChat().
 *
 * The useChat() hook sends:
 *   POST /api/chat
 *   { messages: [{role, content, id}], agentId, conversationId? }
 *
 * We take the LAST user message as the current input, save it to the DB,
 * build conversation history, stream the LLM response, and meter usage.
 */

const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system", "tool"]),
      content: z.string(),
      id: z.string().optional(),
    })
  ).min(1, "At least one message is required"),
  agentId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const orgId = await getActiveOrgId();
    if (!orgId) throw new AppError("NO_ACTIVE_ORG");

    const body = await req.json();
    const input = chatRequestSchema.parse(body);

    // Extract the latest user message
    const lastUserMsg = [...input.messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) {
      throw new AppError("VALIDATION", "No user message found");
    }
    const userMessageText = lastUserMsg.content;

    // 1. Fetch the agent + verify it belongs to this org
    const agent = await prisma.agent.findFirst({
      where: { id: input.agentId, organizationId: orgId, status: "ACTIVE" },
      include: { modelConfig: true },
    });
    if (!agent) throw new AppError("NOT_FOUND", "Agent not found");
    if (!agent.modelConfig) throw new AppError("INTERNAL", "Agent has no model config");

    // 2. Resolve or create the conversation
    let conversation = input.conversationId
      ? await prisma.conversation.findFirst({
          where: { id: input.conversationId, organizationId: orgId },
        })
      : null;

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          organizationId: orgId,
          agentId: agent.id,
          userId: session.user.id,
          title: userMessageText.slice(0, 80),
        },
      });
    }

    // 3. Save the user's message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: userMessageText,
      },
    });

    // 4. Build conversation history (last 20 messages, excluding the one we just saved)
    const history = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        role: { in: ["USER", "ASSISTANT", "SYSTEM"] },
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    const messages: CoreMessage[] = history.map((m) => {
      const role = m.role.toLowerCase();
      if (role === "user") return { role: "user" as const, content: m.content };
      if (role === "system") return { role: "system" as const, content: m.content };
      return { role: "assistant" as const, content: m.content };
    });

    // 5. Budget check — throws if org exceeded quota
    await checkBudget(orgId);

    // 6. Resolve the LLM model
    const model = resolveModel(
      agent.modelConfig.provider as "google" | "openai" | "anthropic" | "groq",
      agent.modelConfig.modelName
    );
    if (!model) {
      throw new AppError(
        "INTERNAL",
        `Provider ${agent.modelConfig.provider} not configured. Set the API key in .env.local`
      );
    }

    // 7. Stream the response
    // Use onFinish callback for metering — this runs AFTER the stream completes
    // but doesn't consume it (unlike result.text which would conflict with
    // toDataStreamResponse()).
    const conversationId = conversation.id;
    const agentModelConfig = agent.modelConfig;
    const userId = session.user.id;

    const result = streamText({
      model,
      messages,
      system: agent.systemPrompt ?? undefined,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      onFinish: async ({ text: fullText, usage }) => {
        try {
          const inputTokens = usage?.promptTokens ?? 0;
          const outputTokens = usage?.completionTokens ?? 0;

          const costUsd =
            (inputTokens / 1000) * agentModelConfig.inputCostPer1K +
            (outputTokens / 1000) * agentModelConfig.outputCostPer1K;

          await recordTokenUsage({
            organizationId: orgId,
            userId,
            conversationId,
            modelConfigId: agentModelConfig.id,
            inputTokens,
            outputTokens,
            costUsd,
          });

          await prisma.message.create({
            data: {
              conversationId,
              role: "ASSISTANT",
              content: fullText,
              modelConfigId: agentModelConfig.id,
              tokenCount: inputTokens + outputTokens,
            },
          });

          await prisma.conversation.update({
            where: { id: conversationId },
            data: {
              tokenCount: { increment: inputTokens + outputTokens },
              estimatedCostUsd: { increment: costUsd },
            },
          });
        } catch (err) {
          console.error("[CHAT METERING FAILED]", err);
        }
      },
    });

    // 8. Audit log
    await audit({
      organizationId: orgId,
      userId: session.user.id,
      action: "CREATE",
      resourceType: "message",
      resourceId: conversation.id,
      metadata: { agentId: agent.id, conversationId: conversation.id },
    });

    // 9. Return the stream — useChat() expects a data-stream response
    return result.toDataStreamResponse();
  } catch (err) {
    const error = toAppError(err);
    return NextResponse.json(error.toJSON(), { status: error.statusCode });
  }
}
