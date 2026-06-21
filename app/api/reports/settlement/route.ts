import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// GET /api/reports/settlement?from=&to=
// Computes P&L and profit split: tech share 7.5%, remainder split equally among partners
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

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
    WHERE u.role = 'partner'
    ORDER BY u.name ASC
  `;

  const rows = partners.map((p) => {
    const revenue = Number(p.revenue);
    const stockCost = Number(p.stock_cost);
    const expenses = Number(p.expenses);
    const net = revenue - stockCost - expenses;
    return { ...p, revenue, stock_cost: stockCost, expenses, net };
  });

  const totalNet = rows.reduce((s, p) => s + p.net, 0);
  const techShare = totalNet * 0.075;
  const partnerPool = totalNet - techShare;
  const partnerCount = rows.length || 1;
  const perPartner = partnerPool / partnerCount;

  const settlement = rows.map((p) => ({
    ...p,
    payout: perPartner,
  }));

  return Response.json({
    settlement,
    summary: {
      total_net: totalNet,
      tech_share: techShare,
      partner_pool: partnerPool,
      partner_count: partnerCount,
      per_partner: perPartner,
    },
  });
}
