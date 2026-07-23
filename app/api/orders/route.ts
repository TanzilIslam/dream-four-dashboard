import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createOrderSchema } from "@/lib/schemas/order";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const url = new URL(request.url);
  const status = url.searchParams.get("status"); // pending | delivered | paid | cancelled | all

  const statusFilter =
    status && status !== "all"
      ? sql`AND o.status = ${status}`
      : sql`AND o.status NOT IN ('cancelled')`;

  const orders =
    user.role === "admin"
      ? await sql`
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
          WHERE 1=1 ${statusFilter}
          ORDER BY o.ordered_at DESC
        `
      : await sql`
          SELECT o.*,
                 c.name  AS customer_name,
                 c.phone AS customer_phone,
                 a.name  AS area_name,
                 p.name  AS product_name,
                 p.unit  AS product_unit,
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
          WHERE o.partner_id = ${user.id} ${statusFilter}
          ORDER BY o.ordered_at DESC
        `;

  return Response.json(orders);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;

  const parsed = createOrderSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;
  const total_amount = d.unit_price * d.quantity;
  const paid_amount = d.paid_amount ?? 0;
  const due_amount = total_amount - paid_amount;
  const collection = paid_amount;
  const total_cost =
    (d.unit_cost + d.unit_transport_cost + d.unit_label_cost + d.unit_other_cost) * d.quantity;
  const net_value = total_amount - total_cost;

  // Fetch customer to get area_id and check due limit
  const [customer] = await sql`SELECT * FROM customers WHERE id = ${d.customer_id}`;
  if (!customer) {
    return Response.json({ error: "Customer not found" }, { status: 404 });
  }

  // Due limit check (only applies if this order carries a balance)
  if (due_amount > 0) {
    if (!customer.due_allowed) {
      return Response.json(
        { error: "This customer is not allowed to carry a balance. Collect full payment upfront." },
        { status: 400 }
      );
    }
    const [dueRow] = await sql`
      SELECT COALESCE(SUM(due_amount), 0) AS current_due
      FROM orders
      WHERE customer_id = ${d.customer_id} AND status NOT IN ('cancelled', 'paid')
    `;
    const currentDue = Number(dueRow.current_due);
    const maxDue = Number(customer.max_due);
    if (currentDue + due_amount > maxDue) {
      return Response.json(
        {
          error: `Due limit exceeded. Current outstanding: ৳${currentDue.toFixed(2)}, new due: ৳${due_amount.toFixed(2)}, total would be: ৳${(currentDue + due_amount).toFixed(2)}, limit: ৳${maxDue.toFixed(2)}.`,
        },
        { status: 400 }
      );
    }
  }

  const [order] = await sql`
    INSERT INTO orders (
      partner_id, customer_id, area_id, product_id,
      quantity, unit, unit_price, total_amount,
      paid_amount, due_amount, status, note,
      unit_cost, unit_transport_cost, unit_label_cost, unit_other_cost,
      collection, total_cost, net_value, ordered_at
    ) VALUES (
      ${user.id}, ${d.customer_id}, ${customer.area_id}, ${d.product_id},
      ${d.quantity}, ${d.unit || null}, ${d.unit_price}, ${total_amount},
      ${paid_amount}, ${due_amount}, 'pending', ${d.note || null},
      ${d.unit_cost}, ${d.unit_transport_cost}, ${d.unit_label_cost}, ${d.unit_other_cost},
      ${collection}, ${total_cost}, ${net_value}, ${d.ordered_at}::TIMESTAMPTZ
    )
    RETURNING *
  `;

  if (paid_amount > 0) {
    await sql`
      INSERT INTO payments (partner_id, customer_id, order_id, amount, paid_at)
      VALUES (${user.id}, ${d.customer_id}, ${order.id}, ${paid_amount}, ${d.ordered_at}::TIMESTAMPTZ)
    `;
  }

  if (d.assets && d.assets.length > 0) {
    for (const a of d.assets) {
      await sql`
        INSERT INTO order_assets (order_id, asset_id, quantity)
        VALUES (${order.id}, ${a.asset_id}, ${a.quantity})
      `;
    }
  }

  return Response.json(order, { status: 201 });
}
