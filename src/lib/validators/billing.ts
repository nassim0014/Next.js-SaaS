import { z } from "zod";

export const checkoutSchema = z.object({
  planSlug: z.enum(["starter", "pro", "enterprise"]),
  billingPeriod: z.enum(["monthly", "yearly"]),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const changePlanSchema = z.object({
  planSlug: z.enum(["free", "starter", "pro", "enterprise"]),
});

export type ChangePlanInput = z.infer<typeof changePlanSchema>;
