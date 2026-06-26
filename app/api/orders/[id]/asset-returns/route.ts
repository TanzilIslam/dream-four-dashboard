import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

async function getOrder(id: number) {
  const [order] = await sql`SELECT * FROM orders WHERE id = ${id}`;
  return order ?? null;
}

function canAccess(user: { id: number; role: string }, order: Record<string, unknown>) {
  return user.role === "admin" || order.partner_id === user.id;
}

// GET /api/orders/[id]/asset-returns
// Returns assets sent with the order and all returns so far
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const { id } = await params;
  const order = await getOrder(Number(id));
  if (!order) return Response.json({ error: "Not found" }, { status: 404 });
  if (!canAccess(user, order)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const sent = await sql`
    SELECT oa.*, pa.name AS asset_name
    FROM order_assets oa
    JOIN product_assets pa ON pa.id = oa.asset_id
    WHERE oa.order_id = ${id}
  `;

  const returned = await sql`
    SELECT oar.*, pa.name AS asset_name, u.name AS created_by_name
    FROM order_asset_returns oar
    JOIN product_assets pa ON pa.id = oar.asset_id
    LEFT JOIN users u ON u.id = oar.created_by
    WHERE oar.order_id = ${id}
    ORDER BY oar.returned_at, oar.id
  `;

  return Response.json({ sent, returned });
}
