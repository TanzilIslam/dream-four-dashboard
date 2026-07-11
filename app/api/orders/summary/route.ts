import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const url = new URL(request.url);
  const productId = url.searchParams.get("product_id");

  const pid = productId && productId !== "all" ? Number(productId) : null;
  const productFilter = pid !== null ? sql`AND o.product_id = ${pid}` : sql``;

  const partnerFilter = user.role === "admin" ? sql`` : sql`AND o.partner_id = ${user.id}`;

  const [row] = await sql`
    SELECT
      COALESCE(SUM(o.total_amount), 0) AS total,
      COALESCE(SUM(o.paid_amount),  0) AS paid,
      COALESCE(SUM(o.due_amount),   0) AS due
    FROM orders o
    WHERE o.status IN ('delivered', 'paid')  -- FULFILLED: see lib/order-status.ts
    ${productFilter}
    ${partnerFilter}
  `;

  return Response.json({
    total: Number(row.total),
    paid: Number(row.paid),
    due: Number(row.due),
  });
}
