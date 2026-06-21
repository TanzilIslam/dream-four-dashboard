import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  // Per-partner P&L
  const partners = await sql`
    SELECT
      u.id   AS partner_id,
      u.name AS partner_name,

      COALESCE((
        SELECT SUM(o.total_amount)
        FROM orders o
        WHERE o.partner_id = u.id AND o.status IN ('delivered','paid')
          AND (${from ?? null}::date IS NULL OR DATE(o.delivered_at) >= ${from ?? null})
          AND (${to ?? null}::date   IS NULL OR DATE(o.delivered_at) <= ${to ?? null})
      ), 0) AS revenue,

      COALESCE((
        SELECT SUM(pr.actual_total)
        FROM purchase_requests pr
        WHERE pr.partner_id = u.id AND pr.status = 'completed'
          AND (${from ?? null}::date IS NULL OR pr.purchased_at >= ${from ?? null})
          AND (${to ?? null}::date   IS NULL OR pr.purchased_at <= ${to ?? null})
      ), 0) AS stock_cost,

      COALESCE((
        SELECT SUM(e.amount)
        FROM expenses e
        WHERE e.partner_id = u.id
          AND (${from ?? null}::date IS NULL OR e.date >= ${from ?? null})
          AND (${to ?? null}::date   IS NULL OR e.date <= ${to ?? null})
      ), 0) AS expenses

    FROM users u
    WHERE ${user.role === "admin" ? sql`u.role = 'partner'` : sql`u.id = ${user.id}`}
    ORDER BY u.name ASC
  `;

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

  const enriched = partners.map((p) => {
    const revenue = Number(p.revenue);
    const stockCost = Number(p.stock_cost);
    const expenses = Number(p.expenses);
    const net = revenue - stockCost - expenses;
    return { ...p, revenue, stock_cost: stockCost, expenses, net };
  });

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
