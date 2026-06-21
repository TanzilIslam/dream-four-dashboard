import { z } from "zod";

export const areaSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().or(z.literal("")),
  is_active: z.boolean().default(true),
});

export const assignMemberSchema = z.object({
  user_id: z.coerce.number().int().positive("Select a partner"),
});

export type AreaInput = z.infer<typeof areaSchema>;
export type AssignMemberInput = z.infer<typeof assignMemberSchema>;
