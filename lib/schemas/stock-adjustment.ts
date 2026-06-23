import { z } from "zod";

export const createStockAdjustmentSchema = z.object({
  product_id: z.number().int().min(1, "Product is required"),
  quantity: z
    .number()
    .int()
    .refine((n) => n !== 0, "Quantity must not be zero"),
  reason: z.string().min(1, "Reason is required"),
  date: z.string().min(1, "Date is required"),
  note: z.string().optional(),
});

export type CreateStockAdjustmentInput = z.infer<typeof createStockAdjustmentSchema>;
