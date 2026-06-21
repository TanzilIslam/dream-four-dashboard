import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const partnerIdParam = url.searchParams.get("partner_id");

  const fromFilter = from ? sql`AND e.date >= ${from}` : sql``;
  const toFilter = to ? sql`AND e.date <= ${to}` : sql``;
  const partnerFilter =
    user.role === "admin" && partnerIdParam
      ? sql`AND e.partner_id = ${Number(partnerIdParam)}`
      : user.role !== "admin"
        ? sql`AND e.partner_id = ${user.id}`
        : sql``;

  const rows = await sql`
    SELECT
      e.id,
      e.date,
      e.amount,
      e.payment_method,
      e.description,
      ec.name AS category_name,
      a.name  AS area_name,
      u.name  AS partner_name
    FROM expenses e
    LEFT JOIN expense_categories ec ON ec.id = e.category_id
    LEFT JOIN areas a               ON a.id  = e.area_id
    LEFT JOIN users u               ON u.id  = e.partner_id
    WHERE 1=1 ${fromFilter} ${toFilter} ${partnerFilter}
    ORDER BY e.date DESC, e.created_at DESC
  `;

  const [totals] = await sql`
    SELECT COALESCE(SUM(e.amount), 0) AS grand_total
    FROM expenses e
    WHERE 1=1 ${fromFilter} ${toFilter} ${partnerFilter}
  `;

  // Category breakdown
  const byCategory = await sql`
    SELECT ec.name AS category_name, COALESCE(SUM(e.amount), 0) AS total
    FROM expenses e
    LEFT JOIN expense_categories ec ON ec.id = e.category_id
    WHERE 1=1 ${fromFilter} ${toFilter} ${partnerFilter}
    GROUP BY ec.name
    ORDER BY total DESC
  `;

  return Response.json({ rows, totals, byCategory });
}
