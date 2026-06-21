import { z } from "zod";

export const createLoanRepaymentSchema = z.object({
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  method: z.string().optional().or(z.literal("")),
  note: z.string().optional().or(z.literal("")),
});

export type CreateLoanRepaymentInput = z.infer<typeof createLoanRepaymentSchema>;
