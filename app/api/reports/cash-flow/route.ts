import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  // For admin: per-partner breakdown. For partner: just their own.
  const rows = await sql`
    SELECT
      u.id   AS partner_id,
      u.name AS partner_name,

      -- Stock invested (personal money)
      COALESCE((
        SELECT SUM(actual_total) FROM purchase_requests pr
        WHERE pr.partner_id = u.id AND pr.status = 'completed' AND pr.from_personal = true
          AND (${from}::date IS NULL OR pr.purchased_at >= ${from ?? null})
          AND (${to}::date IS NULL   OR pr.purchased_at <= ${to ?? null})
      ), 0) AS personal_invested,

      -- Total stock cost
      COALESCE((
        SELECT SUM(actual_total) FROM purchase_requests pr
        WHERE pr.partner_id = u.id AND pr.status = 'completed'
          AND (${from}::date IS NULL OR pr.purchased_at >= ${from ?? null})
          AND (${to}::date IS NULL   OR pr.purchased_at <= ${to ?? null})
      ), 0) AS total_invested,

      -- Cash collected from orders
      COALESCE((
        SELECT SUM(o.paid_amount) FROM orders o
        WHERE o.partner_id = u.id AND o.status IN ('delivered','paid')
          AND (${from}::date IS NULL OR DATE(o.delivered_at) >= ${from ?? null})
          AND (${to}::date IS NULL   OR DATE(o.delivered_at) <= ${to ?? null})
      ), 0) AS cash_collected,

      -- Cash remitted
      COALESCE((
        SELECT SUM(cr.amount) FROM cash_remittances cr
        WHERE cr.partner_id = u.id AND cr.status = 'acknowledged'
          AND (${from}::date IS NULL OR DATE(cr.submitted_at) >= ${from ?? null})
          AND (${to}::date IS NULL   OR DATE(cr.submitted_at) <= ${to ?? null})
      ), 0) AS cash_remitted,

      -- Expenses
      COALESCE((
        SELECT SUM(e.amount) FROM expenses e
        WHERE e.partner_id = u.id
          AND (${from}::date IS NULL OR e.date >= ${from ?? null})
          AND (${to}::date IS NULL   OR e.date <= ${to ?? null})
      ), 0) AS expenses,

      -- Outstanding dues owed by their customers
      COALESCE((
        SELECT SUM(o.due_amount) FROM orders o
        WHERE o.partner_id = u.id AND o.status NOT IN ('cancelled')
      ), 0) AS outstanding_due

    FROM users u
    WHERE ${user.role === "admin" ? sql`u.role = 'partner'` : sql`u.id = ${user.id}`}
    ORDER BY u.name ASC
  `;

  // cash_in_hand = cash_collected - cash_remitted - expenses
  const enriched = rows.map((r) => ({
    ...r,
    cash_in_hand: Number(r.cash_collected) - Number(r.cash_remitted) - Number(r.expenses),
  }));

  return Response.json(enriched);
}
