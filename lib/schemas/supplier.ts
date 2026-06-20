import { z } from "zod";

const optionalText = z.string().optional().or(z.literal(""));

export const supplierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contact_person: optionalText,
  phone: optionalText,
  whatsapp: optionalText,
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: optionalText,
  area: optionalText,
  bank_name: optionalText,
  bank_account: optionalText,
  bkash: optionalText,
  nagad: optionalText,
  default_price: z.coerce.number().min(0).optional().nullable(),
  notes: optionalText,
  is_active: z.boolean().default(true),
});

export type SupplierInput = z.infer<typeof supplierSchema>;
