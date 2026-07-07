import { z } from "zod";

export const createPurchaseSchema = z.object({
  supplier_id: z.number({ error: "Supplier is required" }).min(1, "Supplier is required"),
  product_id: z.number({ error: "Product is required" }).min(1, "Product is required"),
  actual_qty: z.number().int().min(1, "Quantity must be at least 1"),
  actual_price: z.number().min(0, "Price must be non-negative"),
  unit: z.string().optional().or(z.literal("")),
  unit_transport_cost: z.number().min(0).default(0),
  unit_label_cost: z.number().min(0).default(0),
  unit_other_cost: z.number().min(0).default(0),
  purchased_at: z.string().min(1, "Purchase date is required"),
  payment_method: z.string().optional().or(z.literal("")),
  from_personal: z.boolean().default(false),
  note: z.string().optional().or(z.literal("")),
  remarks: z.string().optional().or(z.literal("")),
  assets: z
    .array(z.object({ asset_id: z.number().int().positive(), quantity: z.number().int().min(1) }))
    .optional()
    .default([]),
});

export const addSupplierPaymentSchema = z.object({
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  paid_at: z.string().min(1, "Payment date is required"),
  payment_method: z.string().optional().or(z.literal("")),
  from_personal: z.boolean().default(false),
  note: z.string().optional().or(z.literal("")),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type AddSupplierPaymentInput = z.infer<typeof addSupplierPaymentSchema>;
