import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { acknowledgeCashRemittanceSchema } from "@/lib/schemas/cash-remittance";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const { id } = await params;

  const [remittance] = await sql`SELECT * FROM cash_remittances WHERE id = ${id}`;
  if (!remittance) return Response.json({ error: "Not found" }, { status: 404 });
  if (remittance.status === "acknowledged") {
    return Response.json({ error: "Already acknowledged" }, { status: 400 });
  }

  const parsed = acknowledgeCashRemittanceSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const [updated] = await sql`
    UPDATE cash_remittances SET
      status          = 'acknowledged',
      acknowledged_by = ${user.id},
      acknowledged_at = NOW(),
      admin_note      = ${parsed.data.admin_note || null}
    WHERE id = ${id}
    RETURNING *
  `;

  return Response.json(updated);
}
