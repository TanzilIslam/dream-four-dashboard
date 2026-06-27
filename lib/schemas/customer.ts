import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional().or(z.literal("")),
  whatsapp: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  area_id: z.number({ error: "Area is required" }).min(1, "Area is required"),
  pricing_tier_id: z.number().optional().nullable(),
  due_allowed: z.boolean().default(true),
  max_due: z.number().min(0).default(1000),
  delivery_frequency: z.enum(["daily", "alternate", "weekly"]).default("daily"),
  delivery_interval: z.number().int().min(1).default(1),
  customer_type: z
    .enum(["home", "confectionery", "hotel", "restaurant", "madrasha"])
    .optional()
    .nullable(),
  notes: z.string().optional().or(z.literal("")),
  is_active: z.boolean().default(true),
});

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  name: z.string().min(1, "Name is required"),
  area_id: z.number({ error: "Area is required" }).min(1, "Area is required"),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
