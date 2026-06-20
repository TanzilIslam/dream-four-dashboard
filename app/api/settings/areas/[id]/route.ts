import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { areaSchema } from "@/lib/schemas/area";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const parsed = areaSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;
  const [area] = await sql`
    UPDATE areas SET name = ${d.name}, description = ${d.description || null}, is_active = ${d.is_active}
    WHERE id = ${id}
    RETURNING *
  `;

  if (!area) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(area);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await sql`UPDATE areas SET is_active = false WHERE id = ${id}`;
  return Response.json({ ok: true });
}
