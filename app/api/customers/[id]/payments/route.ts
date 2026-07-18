import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const customerId = Number(id);

  const payments = await sql`
    SELECT
      py.id,
      py.amount,
      py.paid_at,
      py.payment_method,
      p.name AS product_name
    FROM payments py
    JOIN orders o ON o.id = py.order_id
    JOIN products p ON p.id = o.product_id
    WHERE py.customer_id = ${customerId}
    ORDER BY py.paid_at DESC
  `;

  const orders = await sql`
    SELECT
      o.id,
      o.delivered_at,
      o.quantity,
      o.unit_price,
      o.total_amount,
      o.paid_amount,
      o.due_amount,
      p.name AS product_name
    FROM orders o
    JOIN products p ON p.id = o.product_id
    WHERE o.customer_id = ${customerId}
      AND o.status IN ('delivered', 'paid')
    ORDER BY o.delivered_at DESC, o.ordered_at DESC
  `;

  return Response.json({ payments, orders });
}
