import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createCashRemittanceSchema } from "@/lib/schemas/cash-remittance";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const url = new URL(request.url);
  const status = url.searchParams.get("status"); // pending | acknowledged | all

  const statusFilter = status && status !== "all" ? sql`AND cr.status = ${status}` : sql``;

  const remittances =
    user.role === "admin"
      ? await sql`
          SELECT cr.*,
                 u.name  AS partner_name,
                 a.name  AS acknowledged_by_name
          FROM cash_remittances cr
          LEFT JOIN users u ON u.id = cr.partner_id
          LEFT JOIN users a ON a.id = cr.acknowledged_by
          WHERE 1=1 ${statusFilter}
          ORDER BY cr.submitted_at DESC
        `
      : await sql`
          SELECT cr.*
          FROM cash_remittances cr
          WHERE cr.partner_id = ${user.id} ${statusFilter}
          ORDER BY cr.submitted_at DESC
        `;

  return Response.json(remittances);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;

  const parsed = createCashRemittanceSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;
  const [remittance] = await sql`
    INSERT INTO cash_remittances (partner_id, amount, payment_method, note, status)
    VALUES (${user.id}, ${d.amount}, ${d.payment_method || null}, ${d.note || null}, 'pending')
    RETURNING *
  `;

  return Response.json(remittance, { status: 201 });
}
