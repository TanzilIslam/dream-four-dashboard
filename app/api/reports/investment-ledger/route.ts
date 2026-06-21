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

  const fromFilter = from ? sql`AND pr.purchased_at >= ${from}` : sql``;
  const toFilter = to ? sql`AND pr.purchased_at <= ${to}` : sql``;
  const partnerFilter =
    user.role === "admin" && partnerIdParam
      ? sql`AND pr.partner_id = ${Number(partnerIdParam)}`
      : user.role !== "admin"
        ? sql`AND pr.partner_id = ${user.id}`
        : sql``;

  const rows = await sql`
    SELECT
      pr.id,
      pr.purchased_at,
      pr.actual_qty,
      pr.actual_price,
      pr.actual_total,
      pr.payment_method,
      pr.from_personal,
      pr.note,
      p.name  AS product_name,
      p.unit  AS product_unit,
      s.name  AS supplier_name,
      u.name  AS partner_name
    FROM purchase_requests pr
    LEFT JOIN products  p ON p.id = pr.product_id
    LEFT JOIN suppliers s ON s.id = pr.supplier_id
    LEFT JOIN users     u ON u.id = pr.partner_id
    WHERE pr.status = 'completed'
      ${fromFilter} ${toFilter} ${partnerFilter}
    ORDER BY pr.purchased_at DESC
  `;

  const [totals] = await sql`
    SELECT
      COALESCE(SUM(actual_total), 0)                                   AS grand_total,
      COALESCE(SUM(actual_total) FILTER (WHERE from_personal = true), 0) AS personal_total,
      COALESCE(SUM(actual_qty), 0)                                     AS total_qty
    FROM purchase_requests pr
    WHERE pr.status = 'completed'
      ${fromFilter} ${toFilter} ${partnerFilter}
  `;

  return Response.json({ rows, totals });
}
