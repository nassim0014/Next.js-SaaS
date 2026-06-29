import { NextRequest, NextResponse } from "next/server";
import { streamText, type CoreMessage } from "ai";
import { requireUser } from "@/lib/auth/session";
import { getActiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/prisma";
import { resolveModel } from "@/lib/ai/llm";
import { checkBudget, recordTokenUsage } from "@/lib/ai/cost";
import { audit } from "@/lib/audit/logger";
import { AppError, toAppError } from "@/lib/errors";
import { sendChatMessageSchema } from "@/lib/validators/agent";

export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const orgId = await getActiveOrgId();
    if (!orgId) throw new AppError("NO_ACTIVE_ORG");

    const body = await req.json();
    const input = sendChatMessageSchema.parse(body);

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
          title: input.message.slice(0, 80),
        },
      });
    }

    // 3. Save the user's message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: input.message,
      },
    });

    // 4. Build conversation history (last 20 messages).
    // Skip TOOL messages — they have a different content shape and are
    // reconstructed by the SDK from the assistant's prior tool_calls.
    const history = await prisma.message.findMany({
      where: { conversationId: conversation.id, role: { in: ["USER", "ASSISTANT", "SYSTEM"] } },
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
    const model = resolveModel(agent.modelConfig.provider as "google" | "openai" | "anthropic" | "groq", agent.modelConfig.modelName);
    if (!model) {
      throw new AppError(
        "INTERNAL",
        `Provider ${agent.modelConfig.provider} not configured. Set the API key in .env.local`
      );
    }

    // 7. Stream the response
    const result = streamText({
      model,
      messages,
      system: agent.systemPrompt ?? undefined,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
    });

    // 8. Meter usage on completion (async, fire-and-forget)
    result.usage
      .then(async (usage) => {
        if (!usage) return;

        const inputTokens = "promptTokens" in usage ? usage.promptTokens : (usage as { inputTokens?: number }).inputTokens ?? 0;
        const outputTokens = "completionTokens" in usage ? usage.completionTokens : (usage as { outputTokens?: number }).outputTokens ?? 0;

        const costUsd =
          (inputTokens / 1000) * agent.modelConfig!.inputCostPer1K +
          (outputTokens / 1000) * agent.modelConfig!.outputCostPer1K;

        await recordTokenUsage({
          organizationId: orgId,
          userId: session.user.id,
          conversationId: conversation!.id,
          modelConfigId: agent.modelConfig!.id,
          inputTokens,
          outputTokens,
          costUsd,
        });

        // Save the assistant's message
        const text = await result.text;
        await prisma.message.create({
          data: {
            conversationId: conversation!.id,
            role: "ASSISTANT",
            content: text,
            modelConfigId: agent.modelConfig!.id,
            tokenCount: inputTokens + outputTokens,
          },
        });

        // Update conversation cost
        await prisma.conversation.update({
          where: { id: conversation!.id },
          data: {
            tokenCount: { increment: inputTokens + outputTokens },
            estimatedCostUsd: { increment: costUsd },
          },
        });
      })
      .catch((err) => console.error("[CHAT METERING FAILED]", err));

    // 9. Audit log
    await audit({
      organizationId: orgId,
      userId: session.user.id,
      action: "CREATE",
      resourceType: "message",
      resourceId: conversation.id,
      metadata: { agentId: agent.id, conversationId: conversation.id },
    });

    // 10. Return the stream
    return result.toDataStreamResponse();
  } catch (err) {
    const error = toAppError(err);
    return NextResponse.json(error.toJSON(), { status: error.statusCode });
  }
}
