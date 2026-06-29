import { z } from "zod";

export const createKnowledgeBaseSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  embeddingModel: z
    .enum(["text-embedding-3-small", "text-embedding-004"])
    .default("text-embedding-004"),
});

export type CreateKnowledgeBaseInput = z.infer<typeof createKnowledgeBaseSchema>;

export const uploadDocumentSchema = z.object({
  knowledgeBaseId: z.string().uuid(),
  title: z.string().min(1).max(200),
  sourceUrl: z.string().url().optional(),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
