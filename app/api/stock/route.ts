import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const stock = await sql`
    SELECT
      p.id,
      p.name,
      p.unit,
      p.low_stock_threshold,
      COALESCE(purchased.qty, 0)                                          AS purchased_qty,
      COALESCE(reserved.qty, 0)                                           AS reserved_qty,
      COALESCE(delivered.qty, 0)                                          AS delivered_qty,
      COALESCE(returned.qty, 0)                                           AS returned_qty,
      COALESCE(purchased.qty, 0)
        - COALESCE(reserved.qty, 0)
        - COALESCE(delivered.qty, 0)
        + COALESCE(returned.qty, 0)                                       AS available_qty
    FROM products p
    LEFT JOIN (
      SELECT product_id, SUM(actual_qty) AS qty
      FROM purchase_requests
      WHERE status = 'purchased'
      GROUP BY product_id
    ) purchased ON purchased.product_id = p.id
    LEFT JOIN (
      SELECT product_id, SUM(quantity) AS qty
      FROM orders
      WHERE status = 'pending'
      GROUP BY product_id
    ) reserved ON reserved.product_id = p.id
    LEFT JOIN (
      SELECT product_id, SUM(quantity) AS qty
      FROM orders
      WHERE status IN ('delivered', 'paid')
      GROUP BY product_id
    ) delivered ON delivered.product_id = p.id
    LEFT JOIN (
      SELECT product_id, SUM(quantity) AS qty
      FROM returns
      GROUP BY product_id
    ) returned ON returned.product_id = p.id
    WHERE p.is_active = true
    ORDER BY p.name ASC
  `;

  return Response.json(stock);
}
