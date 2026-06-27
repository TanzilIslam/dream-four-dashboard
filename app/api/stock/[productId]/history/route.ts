import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// GET /api/stock/[productId]/history
// Returns all purchased purchase_requests for a product, oldest first,
// with supplier details, per-batch pricing, and stock level before each purchase.
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
      u.name  AS partner_name,

      -- Stock level immediately before this purchase:
      -- purchases before this row
      COALESCE((
        SELECT SUM(pr2.actual_qty)
        FROM purchase_requests pr2
        WHERE pr2.product_id = ${productId}
          AND pr2.status = 'purchased'
          AND (
            pr2.purchased_at < pr.purchased_at
            OR (pr2.purchased_at = pr.purchased_at AND pr2.id < pr.id)
          )
      ), 0)
      -- minus delivered/paid orders before this date
      - COALESCE((
        SELECT SUM(o.quantity)
        FROM orders o
        WHERE o.product_id = ${productId}
          AND o.status IN ('delivered', 'paid')
          AND o.delivered_at < pr.purchased_at
      ), 0)
      -- plus product returns before this date
      + COALESCE((
        SELECT SUM(r.quantity)
        FROM returns r
        WHERE r.product_id = ${productId}
          AND r.returned_at < pr.purchased_at
      ), 0)
      -- plus stock adjustments before this date
      + COALESCE((
        SELECT SUM(sa.quantity)
        FROM stock_adjustments sa
        WHERE sa.product_id = ${productId}
          AND sa.date < pr.purchased_at
      ), 0)
      AS stock_before

    FROM purchase_requests pr
    LEFT JOIN suppliers s ON s.id = pr.supplier_id
    LEFT JOIN users    u ON u.id = pr.partner_id
    WHERE pr.product_id = ${productId}
      AND pr.status = 'purchased'
    ORDER BY pr.purchased_at ASC, pr.id ASC
  `;

  const total_qty = rows.reduce((sum, r) => sum + Number(r.actual_qty ?? 0), 0);
  const total_amount = rows.reduce((sum, r) => sum + Number(r.actual_total ?? 0), 0);

  return Response.json({ rows, total_qty, total_amount });
}
