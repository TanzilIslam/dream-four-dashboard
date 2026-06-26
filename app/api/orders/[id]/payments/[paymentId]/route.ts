import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

async function getOrder(id: number) {
  const [order] = await sql`SELECT * FROM orders WHERE id = ${id}`;
  return order ?? null;
}

function canAccess(user: { id: number; role: string }, order: Record<string, unknown>) {
  return user.role === "admin" || order.partner_id === user.id;
}

// DELETE /api/orders/[id]/payments/[paymentId]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const { id, paymentId } = await params;
  const order = await getOrder(Number(id));
  if (!order) return Response.json({ error: "Not found" }, { status: 404 });
  if (!canAccess(user, order)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const [payment] = await sql`
    SELECT * FROM payments WHERE id = ${paymentId} AND order_id = ${id}
  `;
  if (!payment) return Response.json({ error: "Payment not found" }, { status: 404 });

  await sql`DELETE FROM payments WHERE id = ${paymentId}`;

  const newPaid = Math.max(0, Number(order.paid_amount) - Number(payment.amount));
  const newDue = Math.max(0, Number(order.total_amount) - newPaid);

  // Revert status if order was "paid" but now has outstanding balance
  let newStatus = order.status;
  if (order.status === "paid" && newDue > 0) {
    newStatus = order.delivered_at ? "delivered" : "pending";
  }

  await sql`
    UPDATE orders SET
      paid_amount = ${newPaid},
      due_amount  = ${newDue},
      status      = ${newStatus}
    WHERE id = ${id}
  `;

  return new Response(null, { status: 204 });
}
