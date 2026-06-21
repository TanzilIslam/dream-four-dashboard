import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { deliverOrderSchema, payOrderSchema, cancelOrderSchema } from "@/lib/schemas/order";

async function getOrder(id: number) {
  const [order] = await sql`SELECT * FROM orders WHERE id = ${id}`;
  return order ?? null;
}

function canAccess(user: { id: number; role: string }, order: Record<string, unknown>) {
  return user.role === "admin" || order.partner_id === user.id;
}

// PATCH /api/orders/[id]
// body: { action: "deliver" | "pay" | "cancel", ...fields }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const { id } = await params;
  const order = await getOrder(Number(id));
  if (!order) return Response.json({ error: "Not found" }, { status: 404 });
  if (!canAccess(user, order)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { action, ...rest } = body as { action: string } & Record<string, unknown>;

  if (action === "deliver") {
    if (order.status !== "pending") {
      return Response.json({ error: "Only pending orders can be delivered" }, { status: 400 });
    }
    const parsed = deliverOrderSchema.safeParse(rest);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const [updated] = await sql`
      UPDATE orders SET
        status       = 'delivered',
        delivered_at = ${parsed.data.delivered_at ?? null} :: TIMESTAMPTZ
      WHERE id = ${id}
      RETURNING *
    `;
    return Response.json(updated);
  }

  if (action === "pay") {
    if (!["pending", "delivered"].includes(order.status)) {
      return Response.json(
        { error: "Order cannot be paid in its current status" },
        { status: 400 }
      );
    }
    const parsed = payOrderSchema.safeParse(rest);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const d = parsed.data;
    const newPaid = Number(order.paid_amount) + d.paid_amount;
    const newDue = Math.max(0, Number(order.total_amount) - newPaid);
    const newStatus = newDue === 0 ? "paid" : order.status;

    const [updated] = await sql`
      UPDATE orders SET
        paid_amount           = ${newPaid},
        due_amount            = ${newDue},
        payment_method        = ${d.payment_method || null},
        promised_payment_date = ${d.promised_payment_date || null} :: DATE,
        status                = ${newStatus},
        note                  = ${d.note || order.note}
      WHERE id = ${id}
      RETURNING *
    `;

    // Record payment
    await sql`
      INSERT INTO payments (partner_id, customer_id, order_id, amount, payment_method, promised_payment_date, note)
      VALUES (${order.partner_id}, ${order.customer_id}, ${order.id}, ${d.paid_amount},
              ${d.payment_method || null}, ${d.promised_payment_date || null} :: DATE, ${d.note || null})
    `;

    return Response.json(updated);
  }

  if (action === "cancel") {
    if (order.status === "paid") {
      return Response.json({ error: "Paid orders cannot be cancelled" }, { status: 400 });
    }
    const parsed = cancelOrderSchema.safeParse(rest);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const [updated] = await sql`
      UPDATE orders SET
        status               = 'cancelled',
        cancellation_reason  = ${parsed.data.cancellation_reason || null}
      WHERE id = ${id}
      RETURNING *
    `;
    return Response.json(updated);
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
