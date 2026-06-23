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
                 a.name  AS area_name,
                 p.name  AS product_name,
                 p.unit  AS product_unit,
                 u.name  AS partner_name
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
                 a.name  AS area_name,
                 p.name  AS product_name,
                 p.unit  AS product_unit
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

  // Stock availability check
  const [stockRow] = await sql`
    SELECT
      COALESCE((SELECT SUM(actual_qty) FROM purchase_requests WHERE product_id = ${d.product_id} AND status = 'purchased'), 0)
      - COALESCE((SELECT SUM(quantity) FROM orders WHERE product_id = ${d.product_id} AND status IN ('pending', 'delivered')), 0)
      + COALESCE((SELECT SUM(quantity) FROM returns WHERE product_id = ${d.product_id}), 0)
      + COALESCE((SELECT SUM(quantity) FROM stock_adjustments WHERE product_id = ${d.product_id}), 0)
      AS available
  `;
  const available = Number(stockRow.available);
  if (available < d.quantity) {
    return Response.json(
      { error: `Insufficient stock. Available: ${available}, requested: ${d.quantity}.` },
      { status: 400 }
    );
  }

  const [order] = await sql`
    INSERT INTO orders (
      partner_id, customer_id, area_id, product_id,
      quantity, unit_price, total_amount,
      paid_amount, due_amount, status, note
    ) VALUES (
      ${user.id}, ${d.customer_id}, ${customer.area_id}, ${d.product_id},
      ${d.quantity}, ${d.unit_price}, ${total_amount},
      ${paid_amount}, ${due_amount}, 'pending', ${d.note || null}
    )
    RETURNING *
  `;

  return Response.json(order, { status: 201 });
}
