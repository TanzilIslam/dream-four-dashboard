import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// DELETE /api/purchase-requests/[id]/payments/[paymentId]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id, paymentId } = await params;

  const [payment] = await sql`
    SELECT * FROM supplier_payments
    WHERE id = ${paymentId} AND purchase_request_id = ${id}
  `;
  if (!payment) return Response.json({ error: "Not found" }, { status: 404 });

  await sql`DELETE FROM supplier_payments WHERE id = ${paymentId}`;
  return new Response(null, { status: 204 });
}
