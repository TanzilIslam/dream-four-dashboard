import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

async function getOrder(id: number) {
  const [order] = await sql`SELECT * FROM orders WHERE id = ${id}`;
  return order ?? null;
}

function canAccess(user: { id: number; role: string }, order: Record<string, unknown>) {
  return user.role === "admin" || order.partner_id === user.id;
}

// GET /api/orders/[id]/payments
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const { id } = await params;
  const order = await getOrder(Number(id));
  if (!order) return Response.json({ error: "Not found" }, { status: 404 });
  if (!canAccess(user, order)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const payments = await sql`
    SELECT p.*, u.name AS recorded_by_name
    FROM payments p
    LEFT JOIN users u ON u.id = p.partner_id
    WHERE p.order_id = ${id}
    ORDER BY p.paid_at, p.id
  `;

  return Response.json({
    payments,
    paid_total: Number(order.paid_amount),
    due_amount: Number(order.due_amount),
    total_amount: Number(order.total_amount),
  });
}
