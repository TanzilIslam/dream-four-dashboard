import { z } from "zod";

export const bulkPaymentSchema = z.object({
  amount: z
    .number({ error: "Amount is required" })
    .positive("Amount must be greater than 0")
    .refine((v) => Number.isFinite(v), "Amount must be a valid number"),
  paid_at: z.string().min(1, "Date is required"),
});

export type BulkPaymentInput = z.infer<typeof bulkPaymentSchema>;
