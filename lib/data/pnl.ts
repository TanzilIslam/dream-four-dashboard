import { sql } from "@/lib/db";

type DateRange = { from: string | null; to: string | null };

/** Filter to select which users are included in the P&L query. */
type UserFilter = "all-partners" | { partnerId: number };

export async function getPartnerPnL({ from, to }: DateRange, filter: UserFilter) {
  const partners =
    filter === "all-partners"
      ? await sql`
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
              WHERE pr.partner_id = u.id AND pr.status = 'purchased'
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
        `
      : await sql`
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
              WHERE pr.partner_id = u.id AND pr.status = 'purchased'
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
          WHERE u.id = ${filter.partnerId}
          ORDER BY u.name ASC
        `;

  return partners.map((p) => {
    const revenue = Number(p.revenue);
    const stockCost = Number(p.stock_cost);
    const expenses = Number(p.expenses);
    const net = revenue - stockCost - expenses;
    return { ...p, revenue, stock_cost: stockCost, expenses, net };
  });
}
