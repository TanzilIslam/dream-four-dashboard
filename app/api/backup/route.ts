import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const ALLOWED_TABLES: Record<string, ReturnType<typeof sql>> = {
  customers: sql`SELECT * FROM customers ORDER BY id`,
  orders: sql`SELECT * FROM orders ORDER BY id`,
  payments: sql`SELECT * FROM payments ORDER BY id`,
  purchase_requests: sql`SELECT * FROM purchase_requests ORDER BY id`,
  supplier_payments: sql`SELECT * FROM supplier_payments ORDER BY id`,
  expenses: sql`SELECT * FROM expenses ORDER BY id`,
  returns: sql`SELECT * FROM returns ORDER BY id`,
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
  stock_adjustments: sql`SELECT * FROM stock_adjustments ORDER BY id`,
  areas: sql`SELECT * FROM areas ORDER BY id`,
  suppliers: sql`SELECT * FROM suppliers ORDER BY id`,
  products: sql`SELECT * FROM products ORDER BY id`,
  product_assets: sql`SELECT * FROM product_assets ORDER BY id`,
  order_assets: sql`SELECT * FROM order_assets ORDER BY id`,
  order_asset_returns: sql`SELECT * FROM order_asset_returns ORDER BY id`,
  purchase_request_assets: sql`SELECT * FROM purchase_request_assets ORDER BY id`,
  supplier_asset_returns: sql`SELECT * FROM supplier_asset_returns ORDER BY id`,
  expense_categories: sql`SELECT * FROM expense_categories ORDER BY id`,
  pricing_tiers: sql`SELECT * FROM pricing_tiers ORDER BY id`,
  partner_loans: sql`SELECT * FROM partner_loans ORDER BY id`,
  loan_repayments: sql`SELECT * FROM loan_repayments ORDER BY id`,
  cash_remittances: sql`SELECT * FROM cash_remittances ORDER BY id`,
  users: sql`SELECT id, name, phone, role, created_at FROM users ORDER BY id`,
  user_areas: sql`SELECT * FROM user_areas ORDER BY user_id, area_id`,
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
