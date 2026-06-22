import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({ max_due: z.coerce.number().min(0) });

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid max_due value" }, { status: 400 });
  }

  const { max_due } = parsed.data;
  await sql`UPDATE customers SET max_due = ${max_due}`;

  return Response.json({ ok: true });
}
