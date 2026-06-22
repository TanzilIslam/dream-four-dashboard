import { z } from "zod";

export const createOrderSchema = z
  .object({
    customer_id: z.number({ error: "Customer is required" }).min(1, "Customer is required"),
    product_id: z.number({ error: "Product is required" }).min(1, "Product is required"),
    quantity: z.number().int().min(1, "Quantity must be at least 1"),
    unit_price: z.number().min(0, "Price must be non-negative"),
    paid_amount: z.number().min(0, "Paid amount must be non-negative").default(0),
    note: z.string().optional().or(z.literal("")),
  })
  .refine((d) => d.paid_amount <= d.unit_price * d.quantity, {
    message: "Paid amount cannot exceed order total",
    path: ["paid_amount"],
  });

export const deliverOrderSchema = z.object({
  delivered_at: z.string().optional(),
});

export const payOrderSchema = z.object({
  paid_amount: z.number().min(0, "Amount must be non-negative"),
  payment_method: z.string().optional().or(z.literal("")),
  promised_payment_date: z.string().optional().or(z.literal("")),
  note: z.string().optional().or(z.literal("")),
});

export const cancelOrderSchema = z.object({
  cancellation_reason: z.string().optional().or(z.literal("")),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type DeliverOrderInput = z.infer<typeof deliverOrderSchema>;
export type PayOrderInput = z.infer<typeof payOrderSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
