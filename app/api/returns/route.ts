import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createReturnSchema } from "@/lib/schemas/return";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order_id");

  const returns =
    user.role === "admin"
      ? await sql`
          SELECT r.*,
                 o.id        AS order_ref,
                 c.name      AS customer_name,
                 p.name      AS product_name,
                 p.unit      AS product_unit,
                 u.name      AS partner_name
          FROM returns r
          LEFT JOIN orders o    ON o.id = r.order_id
          LEFT JOIN customers c ON c.id = r.customer_id
          LEFT JOIN products p  ON p.id = r.product_id
          LEFT JOIN users u     ON u.id = r.partner_id
          ${orderId ? sql`WHERE r.order_id = ${orderId}` : sql``}
          ORDER BY r.created_at DESC
        `
      : await sql`
          SELECT r.*,
                 c.name      AS customer_name,
                 p.name      AS product_name,
                 p.unit      AS product_unit
          FROM returns r
          LEFT JOIN customers c ON c.id = r.customer_id
          LEFT JOIN products p  ON p.id = r.product_id
          WHERE r.partner_id = ${user.id}
          ${orderId ? sql`AND r.order_id = ${orderId}` : sql``}
          ORDER BY r.created_at DESC
        `;

  return Response.json(returns);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;

  const parsed = createReturnSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;

  // Fetch order to get customer_id, product_id, and validate ownership
  const [order] = await sql`SELECT * FROM orders WHERE id = ${d.order_id}`;
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  if (user.role !== "admin" && order.partner_id !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!["delivered", "paid"].includes(order.status)) {
    return Response.json(
      { error: "Can only return items from delivered or paid orders" },
      { status: 400 }
    );
  }
  if (d.quantity > order.quantity) {
    return Response.json(
      { error: `Cannot return more than ordered quantity (${order.quantity})` },
      { status: 400 }
    );
  }

  const [ret] = await sql`
    INSERT INTO returns (
      partner_id, order_id, customer_id, product_id,
      quantity, reason, returned_at, note
    ) VALUES (
      ${user.id}, ${d.order_id}, ${order.customer_id}, ${order.product_id},
      ${d.quantity}, ${d.reason || null}, ${d.returned_at}, ${d.note || null}
    )
    RETURNING *
  `;

  return Response.json(ret, { status: 201 });
}
