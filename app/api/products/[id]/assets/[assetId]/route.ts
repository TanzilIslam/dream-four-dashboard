import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// DELETE /api/products/[id]/assets/[assetId]
// Soft-deletes (deactivates) the asset so historical data is preserved
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id, assetId } = await params;
  const [asset] = await sql`
    SELECT * FROM product_assets WHERE id = ${assetId} AND product_id = ${id}
  `;
  if (!asset) return Response.json({ error: "Not found" }, { status: 404 });

  await sql`UPDATE product_assets SET is_active = false WHERE id = ${assetId}`;
  return new Response(null, { status: 204 });
}
