import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// GET /api/stock/[productId]/history
// Returns all purchased purchase_requests for a product, oldest first,
// with supplier details and per-batch pricing.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { productId } = await params;

  const rows = await sql`
    SELECT
      pr.id,
      pr.purchased_at,
      pr.actual_qty,
      pr.actual_price,
      pr.actual_total,
      pr.note,
      pr.admin_note,
      s.name  AS supplier_name,
      u.name  AS partner_name
    FROM purchase_requests pr
    LEFT JOIN suppliers s ON s.id = pr.supplier_id
    LEFT JOIN users    u ON u.id = pr.partner_id
    WHERE pr.product_id = ${productId}
      AND pr.status = 'purchased'
    ORDER BY pr.purchased_at ASC, pr.id ASC
  `;

  const total_qty    = rows.reduce((sum, r) => sum + Number(r.actual_qty ?? 0), 0);
  const total_amount = rows.reduce((sum, r) => sum + Number(r.actual_total ?? 0), 0);

  return Response.json({ rows, total_qty, total_amount });
}
