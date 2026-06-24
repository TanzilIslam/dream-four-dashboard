import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createExpenseSchema } from "@/lib/schemas/expense";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const { id } = await params;

  const [existing] = await sql`SELECT * FROM expenses WHERE id = ${id}`;
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  if (user.role !== "admin" && existing.partner_id !== user.id)
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createExpenseSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const d = parsed.data;
  const [updated] = await sql`
    UPDATE expenses SET
      category_id    = ${d.category_id},
      area_id        = ${d.area_id ?? null},
      product_id     = ${d.product_id ?? null},
      amount         = ${d.amount},
      payment_method = ${d.payment_method || null},
      description    = ${d.description || null},
      date           = ${d.date}
    WHERE id = ${id}
    RETURNING *
  `;

  return Response.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const { id } = await params;

  const [existing] = await sql`SELECT * FROM expenses WHERE id = ${id}`;
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  if (user.role !== "admin" && existing.partner_id !== user.id)
    return Response.json({ error: "Forbidden" }, { status: 403 });

  await sql`DELETE FROM expenses WHERE id = ${id}`;
  return new Response(null, { status: 204 });
}
