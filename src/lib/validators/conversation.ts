import { z } from "zod";

export const conversationListSchema = z.object({
  status: z.enum(["ACTIVE", "ARCHIVED", "DELETED"]).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

export type ConversationListInput = z.infer<typeof conversationListSchema>;
