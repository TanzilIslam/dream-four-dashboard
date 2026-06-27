import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const ALLOWED_TABLES: Record<string, ReturnType<typeof sql>> = {
  customers: sql`SELECT * FROM customers ORDER BY id`,
  orders: sql`SELECT * FROM orders ORDER BY id`,
  purchase_requests: sql`SELECT * FROM purchase_requests ORDER BY id`,
  expenses: sql`SELECT * FROM expenses ORDER BY id`,
  stock: sql`
    SELECT p.name, p.unit,
           COALESCE(SUM(pr.actual_qty) FILTER (WHERE pr.status = 'purchased'), 0) AS purchased_qty,
           COALESCE(SUM(o.quantity) FILTER (WHERE o.status IN ('pending','delivered')), 0) AS reserved_qty,
           COALESCE(SUM(o.quantity) FILTER (WHERE o.status = 'delivered'), 0) AS delivered_qty,
           COALESCE(SUM(r.quantity), 0) AS returned_qty,
           COALESCE(SUM(sa.quantity), 0) AS adjusted_qty
    FROM products p
    LEFT JOIN purchase_requests pr ON pr.product_id = p.id
    LEFT JOIN orders o ON o.product_id = p.id
    LEFT JOIN returns r ON r.product_id = p.id
    LEFT JOIN stock_adjustments sa ON sa.product_id = p.id
    GROUP BY p.id, p.name, p.unit
    ORDER BY p.name
  `,
  areas: sql`SELECT * FROM areas ORDER BY id`,
  suppliers: sql`SELECT * FROM suppliers ORDER BY id`,
  products: sql`SELECT * FROM products ORDER BY id`,
};

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const table = new URL(request.url).searchParams.get("table") ?? "";
  const query = ALLOWED_TABLES[table];
  if (!query) {
    return Response.json({ error: "Unknown table" }, { status: 400 });
  }

  const rows = await query;
  return Response.json(rows);
}
