import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "all";
  const partnerIdParam = url.searchParams.get("partner_id");

  const statusFilter = status !== "all" ? sql`AND pl.status = ${status}` : sql``;
  const partnerFilter =
    user.role === "admin" && partnerIdParam
      ? sql`AND pl.partner_id = ${Number(partnerIdParam)}`
      : user.role !== "admin"
        ? sql`AND pl.partner_id = ${user.id}`
        : sql``;

  const rows = await sql`
    SELECT
      pl.*,
      u.name AS partner_name,
      COALESCE(
        (SELECT SUM(lr.amount) FROM loan_repayments lr WHERE lr.loan_id = pl.id), 0
      ) AS repaid_amount,
      (SELECT JSON_AGG(lr ORDER BY lr.repaid_at DESC)
       FROM loan_repayments lr WHERE lr.loan_id = pl.id) AS repayments
    FROM partner_loans pl
    LEFT JOIN users u ON u.id = pl.partner_id
    WHERE 1=1 ${statusFilter} ${partnerFilter}
    ORDER BY pl.created_at DESC
  `;

  const [totals] = await sql`
    SELECT
      COALESCE(SUM(pl.amount), 0) AS total_loaned,
      COALESCE(SUM(
        (SELECT SUM(lr.amount) FROM loan_repayments lr WHERE lr.loan_id = pl.id)
      ), 0) AS total_repaid
    FROM partner_loans pl
    WHERE 1=1 ${statusFilter} ${partnerFilter}
  `;

  return Response.json({ rows, totals });
}
