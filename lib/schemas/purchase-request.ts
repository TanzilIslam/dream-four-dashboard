import { z } from "zod";

export const createPurchaseRequestSchema = z.object({
  supplier_id: z.number({ error: "Supplier is required" }).min(1, "Supplier is required"),
  product_id: z.number({ error: "Product is required" }).min(1, "Product is required"),
  requested_qty: z.number().int().min(1, "Quantity must be at least 1"),
  estimated_price: z.number().min(0).optional().nullable(),
  note: z.string().optional().or(z.literal("")),
});

export const approvePurchaseRequestSchema = z.object({
  admin_note: z.string().optional().or(z.literal("")),
});

export const markPurchasedSchema = z.object({
  actual_qty: z.number().int().min(1, "Actual quantity must be at least 1"),
  actual_price: z.number().min(0, "Actual price must be non-negative"),
  purchased_at: z.string().min(1, "Purchase date is required"),
  payment_method: z.string().optional().or(z.literal("")),
  from_personal: z.boolean().default(false),
  admin_note: z.string().optional().or(z.literal("")),
});

export const rejectPurchaseRequestSchema = z.object({
  admin_note: z.string().optional().or(z.literal("")),
});

export type CreatePurchaseRequestInput = z.infer<typeof createPurchaseRequestSchema>;
export type ApprovePurchaseRequestInput = z.infer<typeof approvePurchaseRequestSchema>;
export type MarkPurchasedInput = z.infer<typeof markPurchasedSchema>;
export type RejectPurchaseRequestInput = z.infer<typeof rejectPurchaseRequestSchema>;
