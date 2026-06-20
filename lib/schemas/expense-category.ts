import { z } from "zod";

export const expenseCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  icon: z.string().optional().or(z.literal("")),
});

export type ExpenseCategoryInput = z.infer<typeof expenseCategorySchema>;
