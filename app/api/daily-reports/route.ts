import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// GET /api/daily-reports?date=YYYY-MM-DD&partner_id=N
export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const partnerIdParam = url.searchParams.get("partner_id");

  if (user.role === "admin") {
    // Return all partners' reports for the date
    const reports = await sql`
      SELECT dr.*, u.name AS partner_name
      FROM daily_reports dr
      JOIN users u ON u.id = dr.partner_id
      WHERE dr.report_date = ${date}
      ORDER BY u.name ASC
    `;
    return Response.json(reports);
  }

  // Partner — get or generate their own report for date
  const targetId = partnerIdParam && user.role === "admin" ? Number(partnerIdParam) : user.id;
  const date_ = date;

  let [report] = await sql`
    SELECT * FROM daily_reports WHERE partner_id = ${targetId} AND report_date = ${date_}
  `;

  if (!report) {
    // Auto-generate from day's activity
    const [agg] = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN o.status IN ('delivered','paid') THEN o.quantity ELSE 0 END), 0) AS eggs_delivered,
        COALESCE(SUM(o.paid_amount), 0)                                                          AS cash_collected,
        COALESCE(SUM(o.due_amount),  0)                                                          AS due_added,
        COALESCE(SUM(CASE WHEN o.status IN ('delivered','paid') THEN 0 ELSE 0 END), 0)          AS eggs_returned
      FROM orders o
      WHERE o.partner_id = ${targetId}
        AND DATE(o.delivered_at AT TIME ZONE 'UTC') = ${date_}
    `;

    const [expAgg] = await sql`
      SELECT COALESCE(SUM(amount), 0) AS total_expenses
      FROM expenses
      WHERE partner_id = ${targetId} AND date = ${date_}
    `;

    const [retAgg] = await sql`
      SELECT COALESCE(SUM(quantity), 0) AS eggs_returned
      FROM returns
      WHERE partner_id = ${targetId} AND returned_at = ${date_}
    `;

    [report] = await sql`
      INSERT INTO daily_reports (
        partner_id, report_date, status,
        eggs_delivered, cash_collected, due_added, eggs_returned, total_expenses
      ) VALUES (
        ${targetId}, ${date_}, 'draft',
        ${agg.eggs_delivered}, ${agg.cash_collected}, ${agg.due_added},
        ${retAgg.eggs_returned}, ${expAgg.total_expenses}
      )
      ON CONFLICT (partner_id, report_date) DO UPDATE SET
        eggs_delivered  = EXCLUDED.eggs_delivered,
        cash_collected  = EXCLUDED.cash_collected,
        due_added       = EXCLUDED.due_added,
        eggs_returned   = EXCLUDED.eggs_returned,
        total_expenses  = EXCLUDED.total_expenses
      RETURNING *
    `;
  }

  return Response.json(report);
}
