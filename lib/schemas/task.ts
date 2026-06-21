import { z } from "zod";

export const createTaskSchema = z.object({
  assigned_to: z.number({ error: "Assignee is required" }).min(1),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().or(z.literal("")),
  due_date: z.string().optional().or(z.literal("")),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  type: z.enum(["one_time", "daily"]).default("one_time"),
});

export const completeTaskSchema = z.object({
  note: z.string().optional().or(z.literal("")),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type CompleteTaskInput = z.infer<typeof completeTaskSchema>;
