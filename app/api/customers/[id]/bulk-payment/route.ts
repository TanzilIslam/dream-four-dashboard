import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { bulkPaymentSchema } from "@/lib/schemas/bulk-payment";

// POST /api/customers/[id]/bulk-payment
// Auto-allocates a single lump-sum payment across the customer's DELIVERED orders
// that still carry a due amount, oldest order first (by ordered_at, then id).
//
// Safety model:
//   - Admin only.
//   - Runs inside ONE Postgres transaction that first takes a per-customer
//     advisory lock (serializes concurrent collections for the same customer),
//     then performs allocation + payment inserts + order updates in a SINGLE
//     atomic data-modifying CTE (all-or-nothing, one consistent snapshot).
//   - LEAST(due_amount, ...) makes it structurally impossible to overpay any
//     order. A CTE guard writes NOTHING unless the amount fits within total due,
//     so an over-payment is rejected without touching any row.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isInteger(customerId) || customerId <= 0) {
    return Response.json({ error: "Invalid customer" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bulkPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const [customer] = await sql`SELECT id FROM customers WHERE id = ${customerId}`;
  if (!customer) {
    return Response.json({ error: "Customer not found" }, { status: 404 });
  }

  // Round to 2 decimals to avoid floating-point drift before it reaches SQL.
  const amount = Math.round(parsed.data.amount * 100) / 100;
  const paidAt = parsed.data.paid_at;
  const note = "Bulk payment";

  const results = await sql.transaction([
    // Serialize concurrent bulk collections for this customer (released at tx end).
    sql`SELECT pg_advisory_xact_lock(${customerId})`,
    // Allocation + inserts + updates, atomically, oldest order first.
    sql`
      WITH due_orders AS (
        SELECT
          o.id,
          o.partner_id,
          o.customer_id,
          o.total_amount,
          o.paid_amount,
          o.due_amount,
          COALESCE(
            SUM(o.due_amount) OVER (
              ORDER BY o.ordered_at ASC, o.id ASC
              ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ),
            0
          ) AS due_before
        FROM orders o
        WHERE o.customer_id = ${customerId}
          AND o.status = 'delivered'
          AND o.due_amount > 0
      ),
      totals AS (
        SELECT COALESCE(SUM(due_amount), 0)::numeric AS total_due FROM due_orders
      ),
      alloc AS (
        SELECT
          d.*,
          LEAST(d.due_amount, GREATEST(0, ${amount}::numeric - d.due_before)) AS pay_amount
        FROM due_orders d
        -- Guard: allocate NOTHING unless the whole amount fits within total due.
        WHERE (SELECT total_due FROM totals) >= ${amount}::numeric
      ),
      to_pay AS (
        SELECT * FROM alloc WHERE pay_amount > 0
      ),
      ins AS (
        INSERT INTO payments (partner_id, customer_id, order_id, amount, payment_method, paid_at, note)
        SELECT partner_id, customer_id, id, pay_amount, NULL, ${paidAt}::timestamptz, ${note}
        FROM to_pay
        RETURNING id
      ),
      upd AS (
        UPDATE orders o SET
          paid_amount = o.paid_amount + t.pay_amount,
          due_amount  = GREATEST(0, o.total_amount - (o.paid_amount + t.pay_amount)),
          collection  = o.paid_amount + t.pay_amount,
          status      = CASE
                          WHEN (o.total_amount - (o.paid_amount + t.pay_amount)) <= 0 THEN 'paid'
                          ELSE o.status
                        END
        FROM to_pay t
        WHERE o.id = t.id
        RETURNING o.id
      )
      SELECT
        (SELECT total_due FROM totals)::float8              AS total_due,
        (SELECT COUNT(*) FROM to_pay)::int                  AS orders_paid,
        (SELECT COALESCE(SUM(pay_amount), 0) FROM to_pay)::float8 AS total_allocated
    `,
  ]);

  const row = (results[1] as Array<Record<string, unknown>>)[0];
  const totalDue = Number(row.total_due);
  const ordersPaid = Number(row.orders_paid);
  const totalAllocated = Number(row.total_allocated);

  // Nothing was written -> figure out why and reject cleanly.
  if (ordersPaid === 0) {
    if (totalDue <= 0) {
      return Response.json(
        { error: "This customer has no delivered orders with an outstanding due." },
        { status: 400 }
      );
    }
    return Response.json(
      {
        error: `Amount ৳${amount.toFixed(2)} is more than the total due ৳${totalDue.toFixed(2)}. Enter ৳${totalDue.toFixed(2)} or less.`,
        total_due: totalDue,
      },
      { status: 400 }
    );
  }

  return Response.json({
    orders_paid: ordersPaid,
    total_allocated: totalAllocated,
    total_due: totalDue,
  });
}
