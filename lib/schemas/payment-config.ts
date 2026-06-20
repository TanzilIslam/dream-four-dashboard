import { z } from "zod";

export const paymentConfigSchema = z.object({
  due_allowed: z.boolean().default(true),
  max_due_per_customer: z.coerce.number().min(0).default(1000),
  late_punch_threshold: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (e.g. 09:30)"),
  low_stock_default: z.coerce.number().int().min(0).default(100),
});

export type PaymentConfigInput = z.infer<typeof paymentConfigSchema>;
