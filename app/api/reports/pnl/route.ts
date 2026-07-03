import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getPartnerPnL } from "@/lib/data/pnl";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  // Per-partner P&L
  const enriched = await getPartnerPnL(
    { from, to },
    user.role === "admin" ? "all-partners" : { partnerId: user.id }
  );

  // Per-area P&L (admin only)
  const areas =
    user.role === "admin"
      ? await sql`
    SELECT
      a.id   AS area_id,
      a.name AS area_name,
      COALESCE(SUM(o.total_amount), 0)  AS revenue,
      COUNT(DISTINCT o.customer_id)     AS customer_count,
      COUNT(o.id)                       AS order_count
    FROM areas a
    LEFT JOIN orders o ON o.area_id = a.id AND o.status IN ('delivered','paid')
      AND (${from ?? null}::date IS NULL OR DATE(o.delivered_at) >= ${from ?? null})
      AND (${to ?? null}::date   IS NULL OR DATE(o.delivered_at) <= ${to ?? null})
    WHERE a.is_active = true
    GROUP BY a.id, a.name
    ORDER BY revenue DESC
  `
      : [];

  const totals = enriched.reduce(
    (acc, p) => ({
      revenue: acc.revenue + p.revenue,
      stock_cost: acc.stock_cost + p.stock_cost,
      expenses: acc.expenses + p.expenses,
      net: acc.net + p.net,
    }),
    { revenue: 0, stock_cost: 0, expenses: 0, net: 0 }
  );

  return Response.json({ partners: enriched, areas, totals });
}
