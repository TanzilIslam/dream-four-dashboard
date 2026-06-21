import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const url = new URL(request.url);
  const partnerIdParam = url.searchParams.get("partner_id");

  const partnerFilter =
    user.role === "admin" && partnerIdParam
      ? sql`AND o.partner_id = ${Number(partnerIdParam)}`
      : user.role !== "admin"
        ? sql`AND o.partner_id = ${user.id}`
        : sql``;

  const rows = await sql`
    SELECT
      c.id                                   AS customer_id,
      c.name                                 AS customer_name,
      c.phone                                AS customer_phone,
      a.name                                 AS area_name,
      u.name                                 AS partner_name,
      SUM(o.due_amount)                      AS total_due,
      COUNT(o.id)                            AS order_count,
      MIN(o.ordered_at)                      AS oldest_order_at,
      MAX(o.promised_payment_date)           AS latest_promise,
      CURRENT_DATE - MIN(o.ordered_at)::date AS days_overdue
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    LEFT JOIN areas a ON a.id = c.area_id
    LEFT JOIN users u ON u.id = o.partner_id
    WHERE o.due_amount > 0
      AND o.status NOT IN ('cancelled')
      ${partnerFilter}
    GROUP BY c.id, c.name, c.phone, a.name, u.name
    HAVING SUM(o.due_amount) > 0
    ORDER BY total_due DESC
  `;

  const [totals] = await sql`
    SELECT
      COUNT(DISTINCT o.customer_id)  AS debtor_count,
      COALESCE(SUM(o.due_amount), 0) AS grand_total
    FROM orders o
    WHERE o.due_amount > 0 AND o.status NOT IN ('cancelled')
    ${partnerFilter}
  `;

  return Response.json({ rows, totals });
}
