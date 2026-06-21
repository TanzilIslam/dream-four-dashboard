import { z } from "zod";

export const ACTIVITIES = [
  "punch_in",
  "farm_out",
  "farm_in",
  "delivery_out",
  "delivery_in",
  "punch_out",
] as const;

export type Activity = (typeof ACTIVITIES)[number];

export const punchSchema = z.object({
  activity: z.enum(ACTIVITIES, { error: "Invalid activity" }),
  punched_at: z.string().min(1, "Time is required"),
  note: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
});

export type PunchInput = z.infer<typeof punchSchema>;
