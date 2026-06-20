import { z } from "zod";

export const pricingTierSchema = z.object({
  product_id: z.coerce.number().int().positive("Product is required"),
  name: z.string().min(1, "Tier name is required"),
  unit_price: z.coerce.number().min(0, "Unit price is required"),
  min_qty: z.coerce.number().int().min(1).default(1),
});

export type PricingTierInput = z.infer<typeof pricingTierSchema>;
