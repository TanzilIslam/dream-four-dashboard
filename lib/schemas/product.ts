import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  unit: z.string().min(1, "Unit is required"),
  default_price: z.coerce.number().min(0).optional().nullable(),
  low_stock_threshold: z.coerce.number().int().min(0).default(100),
  is_active: z.boolean().default(true),
});

export type ProductInput = z.infer<typeof productSchema>;
