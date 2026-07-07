import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  deliverOrderSchema,
  payOrderSchema,
  cancelOrderSchema,
  editOrderSchema,
} from "@/lib/schemas/order";

async function getOrder(id: number) {
  const [order] = await sql`SELECT * FROM orders WHERE id = ${id}`;
  return order ?? null;
}

function canAccess(user: { id: number; role: string }, order: Record<string, unknown>) {
  return user.role === "admin" || order.partner_id === user.id;
}

const FULL_SELECT = sql`
  SELECT o.*,
         c.name  AS customer_name,
         c.phone AS customer_phone,
         a.name  AS area_name,
         p.name  AS product_name,
         p.unit  AS product_unit,
         u.name  AS partner_name,
         GREATEST(0,
           COALESCE((SELECT SUM(oa.quantity) FROM order_assets oa WHERE oa.order_id = o.id), 0)
           - COALESCE((SELECT SUM(oar.quantity) FROM order_asset_returns oar WHERE oar.order_id = o.id), 0)
         )::int AS unreturned_assets,
         (SELECT MAX(py.paid_at) FROM payments py WHERE py.order_id = o.id) AS last_payment_date,
         COALESCE((SELECT SUM(py.amount) FROM payments py WHERE py.order_id = o.id), 0)::numeric AS due_collection
  FROM orders o
  LEFT JOIN customers c ON c.id = o.customer_id
  LEFT JOIN areas a     ON a.id = o.area_id
  LEFT JOIN products p  ON p.id = o.product_id
  LEFT JOIN users u     ON u.id = o.partner_id
`;

// PATCH /api/orders/[id]
// body: { action: "deliver" | "pay" | "cancel" | "edit", ...fields }
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

  if (action === "edit") {
    if (!["pending", "delivered"].includes(order.status)) {
      return Response.json(
        { error: "Only pending or delivered orders can be edited" },
        { status: 400 }
      );
    }
    const parsed = editOrderSchema.safeParse(rest);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const d = parsed.data;
    const total_amount = d.unit_price * d.quantity;
    const due_amount = Math.max(0, total_amount - Number(order.paid_amount));
    const collection = Number(order.paid_amount);
    const total_cost = (d.unit_cost + d.unit_label_cost + d.unit_other_cost) * d.quantity;
    const net_value = total_amount - total_cost;

    await sql`
      UPDATE orders SET
        product_id      = ${d.product_id},
        quantity         = ${d.quantity},
        unit             = ${d.unit || null},
        unit_price       = ${d.unit_price},
        total_amount     = ${total_amount},
        due_amount       = ${due_amount},
        unit_cost        = ${d.unit_cost},
        unit_label_cost  = ${d.unit_label_cost},
        unit_other_cost  = ${d.unit_other_cost},
        ordered_at       = ${d.ordered_at}::TIMESTAMPTZ,
        note             = ${d.note || null},
        collection       = ${collection},
        total_cost       = ${total_cost},
        net_value        = ${net_value}
      WHERE id = ${id}
    `;

    // Handle asset updates: delete old + insert new
    await sql`DELETE FROM order_assets WHERE order_id = ${id}`;
    if (d.assets && d.assets.length > 0) {
      for (const a of d.assets) {
        await sql`
          INSERT INTO order_assets (order_id, asset_id, quantity)
          VALUES (${id}, ${a.asset_id}, ${a.quantity})
        `;
      }
    }

    const [updated] = await sql`${FULL_SELECT} WHERE o.id = ${id}`;
    return Response.json(updated);
  }

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
        delivered_at = COALESCE(${parsed.data.delivered_at ?? null} :: TIMESTAMPTZ, NOW())
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

    await sql`
      UPDATE orders SET
        paid_amount           = ${newPaid},
        due_amount            = ${newDue},
        payment_method        = ${d.payment_method || null},
        promised_payment_date = ${d.promised_payment_date || null} :: DATE,
        status                = ${newStatus},
        note                  = ${d.note || order.note}
      WHERE id = ${id}
    `;

    // Record payment
    await sql`
      INSERT INTO payments (partner_id, customer_id, order_id, amount, payment_method, promised_payment_date, note)
      VALUES (${order.partner_id}, ${order.customer_id}, ${order.id}, ${d.paid_amount},
              ${d.payment_method || null}, ${d.promised_payment_date || null} :: DATE, ${d.note || null})
    `;

    if (d.asset_returns && d.asset_returns.length > 0) {
      for (const ar of d.asset_returns) {
        await sql`
          INSERT INTO order_asset_returns (order_id, asset_id, quantity, returned_at, created_by)
          VALUES (${id}, ${ar.asset_id}, ${ar.quantity}, ${ar.returned_at}, ${user.id})
        `;
      }
    }

    const [updated] = await sql`${FULL_SELECT} WHERE o.id = ${id}`;

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
