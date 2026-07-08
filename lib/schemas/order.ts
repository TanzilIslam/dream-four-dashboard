import { z } from "zod";

export const createOrderSchema = z
  .object({
    customer_id: z.number({ error: "Customer is required" }).min(1, "Customer is required"),
    product_id: z.number({ error: "Product is required" }).min(1, "Product is required"),
    quantity: z.number().int().min(1, "Quantity must be at least 1"),
    unit: z.string().optional().or(z.literal("")),
    unit_price: z.number().min(0, "Price must be non-negative"),
    unit_cost: z.number().min(0, "Cost must be non-negative").default(0),
    unit_label_cost: z.number().min(0, "Label cost must be non-negative").default(0),
    unit_other_cost: z.number().min(0, "Other cost must be non-negative").default(0),
    unit_transport_cost: z.number().min(0, "Transport cost must be non-negative").default(0),
    paid_amount: z.number().min(0, "Paid amount must be non-negative").default(0),
    ordered_at: z.string().min(1, "Date is required"),
    note: z.string().optional().or(z.literal("")),
    assets: z
      .array(z.object({ asset_id: z.number().int().positive(), quantity: z.number().int().min(1) }))
      .optional()
      .default([]),
  })
  .refine((d) => d.paid_amount <= d.unit_price * d.quantity, {
    message: "Paid amount cannot exceed order total",
    path: ["paid_amount"],
  });

export const editOrderSchema = z.object({
  product_id: z.number({ error: "Product is required" }).min(1, "Product is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unit: z.string().optional().or(z.literal("")),
  unit_price: z.number().min(0, "Price must be non-negative"),
  unit_cost: z.number().min(0, "Cost must be non-negative").default(0),
  unit_label_cost: z.number().min(0, "Label cost must be non-negative").default(0),
  unit_other_cost: z.number().min(0, "Other cost must be non-negative").default(0),
  unit_transport_cost: z.number().min(0, "Transport cost must be non-negative").default(0),
  ordered_at: z.string().min(1, "Date is required"),
  note: z.string().optional().or(z.literal("")),
  assets: z
    .array(z.object({ asset_id: z.number().int().positive(), quantity: z.number().int().min(1) }))
    .optional()
    .default([]),
});

export const deliverOrderSchema = z.object({
  delivered_at: z.string().optional(),
});

export const payOrderSchema = z.object({
  paid_amount: z.number().min(0, "Amount must be non-negative"),
  payment_method: z.string().optional().or(z.literal("")),
  paid_at: z.string().optional().or(z.literal("")),
  note: z.string().optional().or(z.literal("")),
  asset_returns: z
    .array(
      z.object({
        asset_id: z.number().int().positive(),
        quantity: z.number().int().min(1),
        returned_at: z.string().min(1),
      })
    )
    .optional()
    .default([]),
});

export const cancelOrderSchema = z.object({
  cancellation_reason: z.string().optional().or(z.literal("")),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type EditOrderInput = z.infer<typeof editOrderSchema>;
export type DeliverOrderInput = z.infer<typeof deliverOrderSchema>;
export type PayOrderInput = z.infer<typeof payOrderSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
