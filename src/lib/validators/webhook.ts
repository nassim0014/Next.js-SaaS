import { z } from "zod";

export const createWebhookEndpointSchema = z.object({
  url: z.string().url("Must be a valid HTTPS URL").refine(
    (url) => url.startsWith("https://"),
    "Webhook URL must use HTTPS"
  ),
  events: z
    .array(z.string())
    .min(1, "Select at least one event")
    .max(50, "Too many events"),
});

export const updateWebhookEndpointSchema = createWebhookEndpointSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateWebhookEndpointInput = z.infer<typeof createWebhookEndpointSchema>;
export type UpdateWebhookEndpointInput = z.infer<typeof updateWebhookEndpointSchema>;

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  expiresAt: z.string().datetime().optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
