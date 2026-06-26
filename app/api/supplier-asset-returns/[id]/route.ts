import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// DELETE /api/supplier-asset-returns/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const [row] = await sql`SELECT id FROM supplier_asset_returns WHERE id = ${id}`;
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  await sql`DELETE FROM supplier_asset_returns WHERE id = ${id}`;
  return new Response(null, { status: 204 });
}
