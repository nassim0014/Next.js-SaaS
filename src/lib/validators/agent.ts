import { z } from "zod";

/**
 * Zod validators — the single source of truth for input shapes.
 *
 * Re-use these everywhere: client forms, server actions, API routes.
 * Never redefine validation inline.
 */

export const createAgentSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  systemPrompt: z.string().max(10_000).optional(),
  modelConfigId: z.string().uuid(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(100_000).default(4096),
  knowledgeBaseId: z.string().uuid().optional(),
});

export const updateAgentSchema = createAgentSchema.partial();

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;

export const sendChatMessageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  agentId: z.string().uuid(),
  message: z.string().min(1).max(32_000),
});

export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>;
