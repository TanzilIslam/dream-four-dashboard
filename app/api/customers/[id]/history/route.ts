import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const customerId = Number(id);

  // All orders for this customer with product info
  const orders = await sql`
    SELECT
      o.id,
      o.ordered_at,
      o.delivered_at,
      o.status,
      o.quantity,
      o.unit_price,
      o.total_amount,
      o.paid_amount,
      o.due_amount,
      o.note,
      p.id   AS product_id,
      p.name AS product_name,
      p.unit AS product_unit
    FROM orders o
    JOIN products p ON p.id = o.product_id
    WHERE o.customer_id = ${customerId}
    ORDER BY o.ordered_at DESC
  `;

  // All payments for all orders of this customer
  const payments = await sql`
    SELECT
      py.id,
      py.order_id,
      py.amount,
      py.payment_method,
      py.paid_at,
      py.note
    FROM payments py
    JOIN orders o ON o.id = py.order_id
    WHERE o.customer_id = ${customerId}
    ORDER BY py.paid_at DESC
  `;

  // Group by product
  const productMap: Record<
    number,
    {
      product_id: number;
      product_name: string;
      product_unit: string;
      total_orders: number;
      total_qty: number;
      total_amount: number;
      total_paid: number;
      total_due: number;
      orders: typeof orders;
    }
  > = {};

  for (const o of orders) {
    const pid = o.product_id as number;
    if (!productMap[pid]) {
      productMap[pid] = {
        product_id: pid,
        product_name: o.product_name as string,
        product_unit: o.product_unit as string,
        total_orders: 0,
        total_qty: 0,
        total_amount: 0,
        total_paid: 0,
        total_due: 0,
        orders: [],
      };
    }
    const g = productMap[pid];
    g.total_orders += 1;
    g.total_qty += Number(o.quantity);
    g.total_amount += Number(o.total_amount);
    g.total_paid += Number(o.paid_amount);
    if (o.status === "delivered" || o.status === "paid") {
      g.total_due += Number(o.due_amount);
    }
    g.orders.push(o);
  }

  // Attach payments to their orders
  const paymentsByOrder: Record<number, typeof payments> = {};
  for (const p of payments) {
    const oid = p.order_id as number;
    if (!paymentsByOrder[oid]) paymentsByOrder[oid] = [];
    paymentsByOrder[oid].push(p);
  }

  const products = Object.values(productMap).map((g) => ({
    ...g,
    orders: g.orders.map((o) => ({
      ...o,
      payments: paymentsByOrder[o.id as number] ?? [],
    })),
  }));

  return Response.json({ products });
}
