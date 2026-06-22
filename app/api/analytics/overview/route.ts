import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// GET /api/analytics/overview
// Admin: full business overview. Partner: their own daily summary.
export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (user.role === "admin") {
    // ── KPI cards: today vs yesterday ────────────────────────────
    const [todayKpi] = await sql`
      SELECT
        COALESCE(SUM(o.quantity) FILTER (WHERE DATE(o.delivered_at AT TIME ZONE 'UTC') = ${today}), 0)       AS eggs_sold,
        COALESCE(SUM(o.paid_amount) FILTER (WHERE DATE(o.delivered_at AT TIME ZONE 'UTC') = ${today}), 0)    AS cash_in,
        COALESCE(SUM(o.due_amount) FILTER (WHERE DATE(o.delivered_at AT TIME ZONE 'UTC') = ${today}), 0)     AS new_due,
        COALESCE((SELECT SUM(amount) FROM expenses WHERE date = ${today}), 0)                                AS expenses
      FROM orders o
      WHERE o.status IN ('delivered', 'paid')
    `;

    const [ydayKpi] = await sql`
      SELECT
        COALESCE(SUM(o.quantity) FILTER (WHERE DATE(o.delivered_at AT TIME ZONE 'UTC') = ${yesterday}), 0)   AS eggs_sold,
        COALESCE(SUM(o.paid_amount) FILTER (WHERE DATE(o.delivered_at AT TIME ZONE 'UTC') = ${yesterday}), 0) AS cash_in,
        COALESCE(SUM(o.due_amount) FILTER (WHERE DATE(o.delivered_at AT TIME ZONE 'UTC') = ${yesterday}), 0)  AS new_due,
        COALESCE((SELECT SUM(amount) FROM expenses WHERE date = ${yesterday}), 0)                             AS expenses
      FROM orders o
      WHERE o.status IN ('delivered', 'paid')
    `;

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
        COALESCE(returned.qty, 0)   AS returned_qty
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
      kpi: { today: todayKpi, yesterday: ydayKpi },
      stock,
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

  return Response.json({ stats: myStats });
}
