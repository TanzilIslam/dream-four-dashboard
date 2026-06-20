import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { expenseCategorySchema } from "@/lib/schemas/expense-category";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const parsed = expenseCategorySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;
  const [category] = await sql`
    UPDATE expense_categories SET name = ${d.name}, icon = ${d.icon || null}
    WHERE id = ${id}
    RETURNING *
  `;

  if (!category) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(category);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await sql`DELETE FROM expense_categories WHERE id = ${id}`;
  return Response.json({ ok: true });
}
