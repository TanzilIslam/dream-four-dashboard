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

  const [{ total_repaid_so_far }] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS total_repaid_so_far
    FROM loan_repayments WHERE loan_id = ${id}
  `;
  const outstanding = Number(loan.amount) - Number(total_repaid_so_far);
  if (d.amount > outstanding) {
    return Response.json(
      {
        error: `Repayment of ৳${d.amount.toFixed(2)} exceeds outstanding balance of ৳${outstanding.toFixed(2)}`,
      },
      { status: 400 }
    );
  }

  const [repayment] = await sql`
    INSERT INTO loan_repayments (loan_id, amount, method, note)
    VALUES (${id}, ${d.amount}, ${d.method || null}, ${d.note || null})
    RETURNING *
  `;

  // Check if fully repaid (use pre-validated outstanding value)
  if (d.amount >= outstanding) {
    await sql`UPDATE partner_loans SET status = 'settled' WHERE id = ${id}`;
  }

  return Response.json(repayment, { status: 201 });
}
