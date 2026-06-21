import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { createLoanRepaymentSchema } from "@/lib/schemas/partner-loan";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const [loan] = await sql`SELECT * FROM partner_loans WHERE id = ${id}`;
  if (!loan) return Response.json({ error: "Loan not found" }, { status: 404 });
  if (loan.status === "settled") {
    return Response.json({ error: "Loan is already settled" }, { status: 400 });
  }

  const parsed = createLoanRepaymentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;
  const [repayment] = await sql`
    INSERT INTO loan_repayments (loan_id, amount, method, note)
    VALUES (${id}, ${d.amount}, ${d.method || null}, ${d.note || null})
    RETURNING *
  `;

  // Check if fully repaid
  const [{ total_repaid }] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS total_repaid
    FROM loan_repayments
    WHERE loan_id = ${id}
  `;

  if (Number(total_repaid) >= Number(loan.amount)) {
    await sql`UPDATE partner_loans SET status = 'settled' WHERE id = ${id}`;
  }

  return Response.json(repayment, { status: 201 });
}
