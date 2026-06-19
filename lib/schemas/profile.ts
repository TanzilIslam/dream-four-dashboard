import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
});

export type ProfileInput = z.infer<typeof profileSchema>;
