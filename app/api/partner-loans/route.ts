import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const url = new URL(request.url);
  const status = url.searchParams.get("status"); // outstanding | settled | all

  const statusFilter =
    status && status !== "all"
      ? sql`AND pl.status = ${status}`
      : sql`AND pl.status = 'outstanding'`;

  const loans =
    user.role === "admin"
      ? await sql`
          SELECT pl.*,
                 u.name  AS partner_name,
                 COALESCE(
                   (SELECT SUM(lr.amount) FROM loan_repayments lr WHERE lr.loan_id = pl.id),
                   0
                 ) AS repaid_amount
          FROM partner_loans pl
          LEFT JOIN users u ON u.id = pl.partner_id
          WHERE 1=1 ${statusFilter}
          ORDER BY pl.created_at DESC
        `
      : await sql`
          SELECT pl.*,
                 COALESCE(
                   (SELECT SUM(lr.amount) FROM loan_repayments lr WHERE lr.loan_id = pl.id),
                   0
                 ) AS repaid_amount
          FROM partner_loans pl
          WHERE pl.partner_id = ${user.id} ${statusFilter}
          ORDER BY pl.created_at DESC
        `;

  return Response.json(loans);
}
