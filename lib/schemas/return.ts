import { z } from "zod";

export const createReturnSchema = z.object({
  order_id: z.number({ error: "Order is required" }).min(1, "Order is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  reason: z.string().optional().or(z.literal("")),
  returned_at: z.string().min(1, "Date is required"),
  note: z.string().optional().or(z.literal("")),
});

export type CreateReturnInput = z.infer<typeof createReturnSchema>;
