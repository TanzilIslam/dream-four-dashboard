import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// GET /api/analytics/overview
// Admin: full business overview. Partner: their own daily summary.
export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const { searchParams } = new URL(request.url);
  const rawProductId = searchParams.get("product_id");
  const pid: number | null = rawProductId ? parseInt(rawProductId, 10) : null;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (user.role === "admin") {
    // ── KPI cards: today vs yesterday ────────────────────────────
    const [todayKpi] = await sql`
      SELECT
        COALESCE(SUM(o.quantity) FILTER (WHERE DATE(o.delivered_at AT TIME ZONE 'UTC') = ${today}), 0)       AS eggs_sold,
        COALESCE(SUM(o.paid_amount) FILTER (WHERE DATE(o.delivered_at AT TIME ZONE 'UTC') = ${today}), 0)    AS cash_in,
        COALESCE(SUM(o.due_amount) FILTER (WHERE DATE(o.delivered_at AT TIME ZONE 'UTC') = ${today}), 0)     AS new_due,
        COALESCE((SELECT SUM(amount) FROM expenses WHERE date = ${today} AND (${pid}::integer IS NULL OR product_id = ${pid}::integer)), 0) AS expenses
      FROM orders o
      WHERE o.status IN ('delivered', 'paid')
        AND (${pid}::integer IS NULL OR o.product_id = ${pid}::integer)
    `;

    const [ydayKpi] = await sql`
      SELECT
        COALESCE(SUM(o.quantity) FILTER (WHERE DATE(o.delivered_at AT TIME ZONE 'UTC') = ${yesterday}), 0)   AS eggs_sold,
        COALESCE(SUM(o.paid_amount) FILTER (WHERE DATE(o.delivered_at AT TIME ZONE 'UTC') = ${yesterday}), 0) AS cash_in,
        COALESCE(SUM(o.due_amount) FILTER (WHERE DATE(o.delivered_at AT TIME ZONE 'UTC') = ${yesterday}), 0)  AS new_due,
        COALESCE((SELECT SUM(amount) FROM expenses WHERE date = ${yesterday} AND (${pid}::integer IS NULL OR product_id = ${pid}::integer)), 0) AS expenses
      FROM orders o
      WHERE o.status IN ('delivered', 'paid')
        AND (${pid}::integer IS NULL OR o.product_id = ${pid}::integer)
    `;

    // ── KPI cards: all time ───────────────────────────────────────
    const [allTimeKpi] = await sql`
      SELECT
        COALESCE(SUM(o.quantity), 0)    AS eggs_sold,
        COALESCE(SUM(o.paid_amount), 0) AS cash_in,
        COALESCE(SUM(o.due_amount), 0)  AS new_due,
        COALESCE((SELECT SUM(amount) FROM expenses WHERE (${pid}::integer IS NULL OR product_id = ${pid}::integer)), 0) AS expenses
      FROM orders o
      WHERE o.status IN ('delivered', 'paid')
        AND (${pid}::integer IS NULL OR o.product_id = ${pid}::integer)
    `;

    // Add net_profit to each KPI row
    const withProfit = (row: Record<string, string>) => ({
      ...row,
      net_profit: String(Number(row.cash_in) - Number(row.expenses)),
    });

    // ── Stock per product ─────────────────────────────────────────
    const stock = await sql`
      SELECT
        p.id,
        p.name,
        p.unit,
        p.low_stock_threshold,
        COALESCE(purchased.qty, 0)  AS purchased_qty,
        COALESCE(delivered.qty, 0)  AS delivered_qty,
        COALESCE(reserved.qty, 0)   AS reserved_qty,
        COALESCE(returned.qty, 0)   AS returned_qty,
        COALESCE(adjusted.qty, 0)   AS adjusted_qty,
        COALESCE(purchased.qty, 0)
          - COALESCE(reserved.qty, 0)
          - COALESCE(delivered.qty, 0)
          + COALESCE(returned.qty, 0)
          + COALESCE(adjusted.qty, 0) AS available_qty
      FROM products p
      LEFT JOIN (
        SELECT product_id, SUM(actual_qty) AS qty
        FROM purchase_requests WHERE status = 'purchased'
        GROUP BY product_id
      ) purchased ON purchased.product_id = p.id
      LEFT JOIN (
        SELECT product_id, SUM(quantity) AS qty
        FROM orders WHERE status IN ('delivered', 'paid')
        GROUP BY product_id
      ) delivered ON delivered.product_id = p.id
      LEFT JOIN (
        SELECT product_id, SUM(quantity) AS qty
        FROM orders WHERE status = 'pending'
        GROUP BY product_id
      ) reserved ON reserved.product_id = p.id
      LEFT JOIN (
        SELECT product_id, SUM(quantity) AS qty
        FROM returns GROUP BY product_id
      ) returned ON returned.product_id = p.id
      LEFT JOIN (
        SELECT product_id, COALESCE(SUM(quantity), 0) AS qty
        FROM stock_adjustments
        GROUP BY product_id
      ) adjusted ON adjusted.product_id = p.id
      WHERE p.is_active = true
      ORDER BY p.name ASC
    `;

    // ── Partner performance table (today) ─────────────────────────
    const partners = await sql`
      SELECT
        u.id,
        u.name,
        COALESCE(SUM(o.quantity)    FILTER (WHERE DATE(o.delivered_at AT TIME ZONE 'UTC') = ${today}), 0)  AS eggs_delivered,
        COALESCE(SUM(o.paid_amount) FILTER (WHERE DATE(o.delivered_at AT TIME ZONE 'UTC') = ${today}), 0)  AS cash_collected,
        COALESCE(SUM(e.amount)      FILTER (WHERE e.date = ${today}), 0)                                   AS expenses,
        MIN(al.punched_at) FILTER (WHERE al.activity = 'punch_in' AND DATE(al.punched_at AT TIME ZONE 'UTC') = ${today}) AS punch_in_at
      FROM users u
      LEFT JOIN orders o  ON o.partner_id = u.id AND o.status IN ('delivered','paid')
      LEFT JOIN expenses e ON e.partner_id = u.id
      LEFT JOIN attendance_logs al ON al.partner_id = u.id
      WHERE u.role = 'partner'
      GROUP BY u.id, u.name
      ORDER BY u.name ASC
    `;

    // ── Pending actions ───────────────────────────────────────────
    const [pending] = await sql`
      SELECT
        (SELECT COUNT(*) FROM purchase_requests WHERE status = 'pending')   AS purchase_requests,
        (SELECT COUNT(*) FROM cash_remittances  WHERE status = 'pending')   AS remittances,
        (SELECT COUNT(*) FROM daily_reports     WHERE status = 'submitted') AS reports
    `;

    // ── Asset stock ───────────────────────────────────────────────
    const assets = await sql`
      SELECT
        pa.id                                                                  AS asset_id,
        pa.product_id,
        pa.name                                                                AS asset_name,
        COALESCE(SUM(oa.quantity), 0)::int                                     AS sent,
        COALESCE(SUM(oar.quantity), 0)::int                                    AS returned_by_customers,
        COALESCE((SELECT SUM(sar.quantity) FROM supplier_asset_returns sar WHERE sar.asset_id = pa.id), 0)::int AS returned_to_suppliers,
        (
          COALESCE(SUM(oa.quantity), 0)
          - COALESCE(SUM(oar.quantity), 0)
          - COALESCE((SELECT SUM(sar.quantity) FROM supplier_asset_returns sar WHERE sar.asset_id = pa.id), 0)
        )::int AS unreturned
      FROM product_assets pa
      LEFT JOIN order_assets oa  ON oa.asset_id = pa.id
      LEFT JOIN order_asset_returns oar ON oar.asset_id = pa.id
      GROUP BY pa.id, pa.product_id, pa.name
      ORDER BY pa.name ASC
    `;

    // ── Outstanding dues ──────────────────────────────────────────
    const [duesSummary] = await sql`
      SELECT
        COUNT(DISTINCT o.customer_id)  AS debtor_count,
        COALESCE(SUM(o.due_amount), 0) AS total_due
      FROM orders o
      WHERE o.due_amount > 0 AND o.status NOT IN ('cancelled','paid')
    `;

    const topDebtors = await sql`
      SELECT c.name, SUM(o.due_amount) AS total_due
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE o.due_amount > 0 AND o.status NOT IN ('cancelled','paid')
      GROUP BY c.id, c.name
      ORDER BY total_due DESC
      LIMIT 5
    `;

    return Response.json({
      kpi: {
        today: withProfit(todayKpi),
        yesterday: withProfit(ydayKpi),
        allTime: withProfit(allTimeKpi),
      },
      stock,
      assets,
      partners,
      pending,
      dues: { summary: duesSummary, topDebtors },
    });
  }

  // ── Partner daily summary ─────────────────────────────────────
  const [myStats] = await sql`
    SELECT
      COALESCE(SUM(o.quantity)    FILTER (WHERE DATE(o.delivered_at AT TIME ZONE 'UTC') = ${today}), 0) AS eggs_delivered,
      COALESCE(SUM(o.paid_amount) FILTER (WHERE DATE(o.delivered_at AT TIME ZONE 'UTC') = ${today}), 0) AS cash_collected,
      COALESCE(SUM(o.due_amount)  FILTER (WHERE DATE(o.delivered_at AT TIME ZONE 'UTC') = ${today}), 0) AS due_added,
      (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE partner_id = ${user.id} AND date = ${today}) AS expenses,
      (SELECT COUNT(*) FROM tasks WHERE assigned_to = ${user.id} AND status = 'pending')                AS pending_tasks,
      (SELECT COUNT(*) FROM tasks WHERE assigned_to = ${user.id} AND status = 'completed'
        AND DATE(completed_at AT TIME ZONE 'UTC') = ${today})                                           AS completed_tasks
    FROM orders o
    WHERE o.partner_id = ${user.id} AND o.status IN ('delivered','paid')
  `;

  // ── Partner all-time summary ──────────────────────────────────
  const [myAllTimeStats] = await sql`
    SELECT
      COALESCE(SUM(o.quantity), 0)    AS eggs_delivered,
      COALESCE(SUM(o.paid_amount), 0) AS cash_collected,
      COALESCE(SUM(o.due_amount), 0)  AS due_added,
      (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE partner_id = ${user.id}) AS expenses,
      (SELECT COUNT(*) FROM tasks WHERE assigned_to = ${user.id} AND status = 'pending')   AS pending_tasks,
      (SELECT COUNT(*) FROM tasks WHERE assigned_to = ${user.id} AND status = 'completed') AS completed_tasks
    FROM orders o
    WHERE o.partner_id = ${user.id} AND o.status IN ('delivered','paid')
  `;

  return Response.json({ stats: myStats, allTimeStats: myAllTimeStats });
}
