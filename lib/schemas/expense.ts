import { z } from "zod";

export const createExpenseSchema = z.object({
  category_id: z.number({ error: "Category is required" }).min(1, "Category is required"),
  area_id: z.number().optional().nullable(),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  payment_method: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  date: z.string().min(1, "Date is required"),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
