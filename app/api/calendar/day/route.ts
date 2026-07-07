import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const date = url.searchParams.get("date"); // YYYY-MM-DD
  const productId = url.searchParams.get("product_id"); // number or "all"

  if (!date) return Response.json({ error: "date required" }, { status: 400 });

  const productFilter =
    productId && productId !== "all" ? sql`AND pr.product_id = ${productId}` : sql``;

  const productFilterO =
    productId && productId !== "all" ? sql`AND o.product_id = ${productId}` : sql``;

  const productFilterStock =
    productId && productId !== "all" ? sql`AND p.id = ${productId}` : sql``;

  // ── Tab 1: Stock summary per product ──────────────────────────
  const stock = await sql`
    SELECT
      p.id          AS product_id,
      p.name        AS product_name,
      p.unit,

      -- Opening: everything strictly before this date
      COALESCE((
        SELECT SUM(pr2.actual_qty)
        FROM purchase_requests pr2
        WHERE pr2.product_id = p.id
          AND pr2.status = 'purchased'
          AND pr2.purchased_at < ${date}::date
      ), 0)
      - COALESCE((
        SELECT SUM(o2.quantity)
        FROM orders o2
        WHERE o2.product_id = p.id
          AND o2.status IN ('delivered', 'paid')
          AND o2.delivered_at::date < ${date}::date
      ), 0)
      + COALESCE((
        SELECT SUM(r2.quantity)
        FROM returns r2
        WHERE r2.product_id = p.id
          AND r2.returned_at < ${date}::date
      ), 0)
      + COALESCE((
        SELECT SUM(sa2.quantity)
        FROM stock_adjustments sa2
        WHERE sa2.product_id = p.id
          AND sa2.date < ${date}::date
      ), 0)
      AS opening_stock,

      -- Stock In: purchases on this date
      COALESCE((
        SELECT SUM(pr3.actual_qty)
        FROM purchase_requests pr3
        WHERE pr3.product_id = p.id
          AND pr3.status = 'purchased'
          AND pr3.purchased_at = ${date}::date
      ), 0) AS stock_in,

      -- Stock Out: deliveries on this date
      COALESCE((
        SELECT SUM(o3.quantity)
        FROM orders o3
        WHERE o3.product_id = p.id
          AND o3.status IN ('delivered', 'paid')
          AND o3.delivered_at::date = ${date}::date
      ), 0) AS stock_out,

      -- Returns: customer returns on this date
      COALESCE((
        SELECT SUM(r3.quantity)
        FROM returns r3
        WHERE r3.product_id = p.id
          AND r3.returned_at = ${date}::date
      ), 0) AS returns_in,

      -- Adjustments on this date
      COALESCE((
        SELECT SUM(sa3.quantity)
        FROM stock_adjustments sa3
        WHERE sa3.product_id = p.id
          AND sa3.date = ${date}::date
      ), 0) AS adjustments

    FROM products p
    WHERE p.is_active = true ${productFilterStock}
    ORDER BY p.name
  `;

  // ── Tab 2: Purchases / Suppliers ──────────────────────────────
  const purchases = await sql`
    SELECT
      pr.id,
      pr.actual_qty,
      pr.actual_price,
      pr.actual_total,
      pr.note,
      s.name   AS supplier_name,
      p.name   AS product_name,
      p.unit   AS product_unit,
      COALESCE((
        SELECT SUM(sp.amount)
        FROM supplier_payments sp
        WHERE sp.purchase_request_id = pr.id
      ), 0)::numeric AS paid,
      GREATEST(0, pr.actual_total - COALESCE((
        SELECT SUM(sp2.amount)
        FROM supplier_payments sp2
        WHERE sp2.purchase_request_id = pr.id
      ), 0))::numeric AS due
    FROM purchase_requests pr
    LEFT JOIN suppliers s ON s.id = pr.supplier_id
    LEFT JOIN products  p ON p.id = pr.product_id
    WHERE pr.status = 'purchased'
      AND pr.purchased_at = ${date}::date
      ${productFilter}
    ORDER BY pr.id
  `;

  // ── Tab 3: Orders / Customers ─────────────────────────────────
  const orders = await sql`
    SELECT
      o.id,
      o.quantity,
      o.unit_price,
      o.total_amount,
      o.paid_amount,
      o.due_amount,
      o.status,
      c.name  AS customer_name,
      p.name  AS product_name,
      p.unit  AS product_unit,
      a.name  AS area_name
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN products  p ON p.id = o.product_id
    LEFT JOIN areas     a ON a.id = o.area_id
    WHERE o.ordered_at::date = ${date}::date
      AND o.status != 'cancelled'
      ${productFilterO}
    ORDER BY o.id
  `;

  // ── Tab 4: Collections (payments received on this date) ───────
  const collections = await sql`
    SELECT
      py.id,
      py.amount,
      py.payment_method,
      py.note,
      py.order_id,
      c.name   AS customer_name,
      c.phone  AS customer_phone,
      p.name   AS product_name,
      o.quantity,
      o.total_amount,
      o.unit_price
    FROM payments py
    JOIN orders o    ON o.id = py.order_id
    JOIN customers c ON c.id = py.customer_id
    LEFT JOIN products p ON p.id = o.product_id
    WHERE py.paid_at::date = ${date}::date
      ${productFilterO}
    ORDER BY py.id
  `;

  return Response.json({ stock, purchases, orders, collections });
}
