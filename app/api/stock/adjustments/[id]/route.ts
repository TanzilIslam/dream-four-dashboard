import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const [deleted] = await sql`
    DELETE FROM stock_adjustments WHERE id = ${id} RETURNING id
  `;

  if (!deleted) {
    return Response.json({ error: "Adjustment not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
