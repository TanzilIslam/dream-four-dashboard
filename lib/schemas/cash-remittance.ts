import { z } from "zod";

export const createCashRemittanceSchema = z.object({
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  payment_method: z.string().optional().or(z.literal("")),
  note: z.string().optional().or(z.literal("")),
});

export const acknowledgeCashRemittanceSchema = z.object({
  admin_note: z.string().optional().or(z.literal("")),
});

export type CreateCashRemittanceInput = z.infer<typeof createCashRemittanceSchema>;
export type AcknowledgeCashRemittanceInput = z.infer<typeof acknowledgeCashRemittanceSchema>;
