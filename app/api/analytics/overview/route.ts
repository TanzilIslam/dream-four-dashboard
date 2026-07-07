import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getAssetStock, getProductStock } from "@/lib/data/stock";

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
    const stock = await getProductStock();

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
        (SELECT 0)   AS purchase_requests,
        (SELECT COUNT(*) FROM cash_remittances  WHERE status = 'pending')   AS remittances,
        (SELECT COUNT(*) FROM daily_reports     WHERE status = 'submitted') AS reports
    `;

    // ── Asset stock ───────────────────────────────────────────────
    const assets = await getAssetStock();

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
